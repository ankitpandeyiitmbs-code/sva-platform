/**
 * Customer Sync Service
 * Builds/updates customer records from order shipping address data.
 * Walmart orders don't include buyer email — we deduplicate by (name, zip).
 */
import { prisma } from '../lib/db'

function normalizeName(name: string): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function dedupeKey(addr: any): string {
  const name = normalizeName(addr?.name ?? '')
  const zip  = (addr?.zip ?? addr?.postalCode ?? '').replace(/\s/g, '').toLowerCase()
  return `${name}||${zip}`
}

/**
 * Backfill customer records from all existing orders.
 * Safe to run multiple times — upserts by (name, zip).
 */
export async function backfillCustomers(orgId: string): Promise<{ created: number; updated: number; linked: number }> {
  // Load all orders that have a shippingAddress
  const orders = await prisma.order.findMany({
    where: { orgId },
    select: {
      id: true,
      channel: true,
      total: true,
      orderedAt: true,
      customerId: true,
      shippingAddress: true,
    },
    orderBy: { orderedAt: 'asc' },
  })

  // Group orders by deduplication key
  const grouped = new Map<string, typeof orders>()
  for (const order of orders) {
    const addr = order.shippingAddress as any
    if (!addr?.name) continue
    const key = dedupeKey(addr)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(order)
  }

  let created = 0
  let updated = 0
  let linked  = 0

  for (const [, customerOrders] of grouped) {
    const addr     = customerOrders[0].shippingAddress as any
    const channel  = customerOrders[0].channel
    const ltv      = customerOrders.reduce((s, o) => s + Number(o.total), 0)
    const count    = customerOrders.length
    const aov      = count > 0 ? ltv / count : 0
    const lastOrderAt = customerOrders.reduce((latest, o) =>
      o.orderedAt > latest ? o.orderedAt : latest, customerOrders[0].orderedAt)

    // Split name into first / last
    const parts = (addr.name ?? '').trim().split(/\s+/)
    const firstName = parts[0] ?? ''
    const lastName  = parts.slice(1).join(' ') || undefined

    // Find existing customer: match by (first+last name, zip, orgId)
    const zip    = addr.zip ?? addr.postalCode ?? ''
    const existing = await prisma.customer.findFirst({
      where: {
        orgId,
        firstName,
        lastName: lastName ?? null,
        postalCode: zip || undefined,
      },
    })

    let customerId: string

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          ltv:              ltv,
          totalOrders:      count,
          averageOrderValue: aov,
          lastOrderAt,
          // fill in address fields if missing
          city:       existing.city    ?? addr.city,
          country:    existing.country ?? addr.country,
          postalCode: existing.postalCode ?? zip,
          address:    existing.address ?? addr.line1,
          sourceChannel: existing.sourceChannel ?? channel,
        },
      })
      customerId = existing.id
      updated++
    } else {
      const newCustomer = await prisma.customer.create({
        data: {
          orgId,
          firstName,
          lastName,
          ltv,
          totalOrders:       count,
          averageOrderValue: aov,
          lastOrderAt,
          city:         addr.city,
          country:      addr.country,
          postalCode:   zip,
          address:      addr.line1,
          sourceChannel: channel,
          source:       channel,
          isActive:     true,
        },
      })
      customerId = newCustomer.id
      created++
    }

    // Link all unlinked orders to this customer
    const unlinked = customerOrders.filter(o => !o.customerId)
    if (unlinked.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: unlinked.map(o => o.id) } },
        data:  { customerId },
      })
      linked += unlinked.length
    }
  }

  return { created, updated, linked }
}

/**
 * Upsert a single customer from a just-synced order.
 * Called after each new order is created during sync.
 */
export async function upsertCustomerFromOrder(
  orgId: string,
  orderId: string,
  addr: { name?: string; city?: string; country?: string; zip?: string; line1?: string },
  channel: string,
  total: number,
  orderedAt: Date,
): Promise<void> {
  if (!addr?.name) return

  const parts     = addr.name.trim().split(/\s+/)
  const firstName = parts[0] ?? ''
  const lastName  = parts.slice(1).join(' ') || undefined
  const zip       = addr.zip ?? ''

  const existing = await prisma.customer.findFirst({
    where: {
      orgId,
      firstName,
      lastName: lastName ?? null,
      postalCode: zip || undefined,
    },
  })

  let customerId: string

  if (existing) {
    const newTotal  = Number(existing.ltv) + total
    const newCount  = existing.totalOrders + 1
    await prisma.customer.update({
      where: { id: existing.id },
      data: {
        ltv:              newTotal,
        totalOrders:      newCount,
        averageOrderValue: newTotal / newCount,
        lastOrderAt:      orderedAt > (existing.lastOrderAt ?? new Date(0)) ? orderedAt : existing.lastOrderAt,
      },
    })
    customerId = existing.id
  } else {
    const created = await prisma.customer.create({
      data: {
        orgId, firstName, lastName,
        ltv: total, totalOrders: 1, averageOrderValue: total,
        lastOrderAt: orderedAt,
        city: addr.city, country: addr.country, postalCode: zip,
        address: addr.line1,
        sourceChannel: channel, source: channel, isActive: true,
      },
    })
    customerId = created.id
  }

  await prisma.order.update({ where: { id: orderId }, data: { customerId } })
}
