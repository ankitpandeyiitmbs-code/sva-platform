import axios from 'axios'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/db'

const TOKEN_URL = 'https://marketplace.walmartapis.com/v3/token'
const BASE_URL  = 'https://marketplace.walmartapis.com/v3'

// ── Token cache ────────────────────────────────────────
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const cached = tokenCache.get(clientId)
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  console.log(`[getToken] firing axios.post to ${TOKEN_URL}`)
  let res: any
  try {
    res = await Promise.race([
      axios.post(TOKEN_URL, new URLSearchParams({ grant_type: 'client_credentials' }), {
        headers: {
          Authorization: `Basic ${credentials}`,
          'WM_SVC.NAME': 'SVA Platform',
          'WM_QOS.CORRELATION_ID': randomUUID(),
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      }),
      new Promise<never>((_, rej) => setTimeout(() => { console.log('[getToken] TIMEOUT at 12s'); rej(new Error('token timeout')) }, 12000))
    ])
    console.log(`[getToken] response received, status=${res.status}`)
  } catch (e: any) {
    console.log(`[getToken] ERROR: ${e.message}`)
    throw e
  }
  const { access_token, expires_in } = res.data
  tokenCache.set(clientId, { token: access_token, expiresAt: Date.now() + (expires_in ?? 900) * 1000 })
  return access_token
}

// ── Authenticated request ──────────────────────────────
async function walmartRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  clientId: string,
  clientSecret: string,
  params?: Record<string, any>,
  body?: any
) {
  const token = await getAccessToken(clientId, clientSecret)
  const apiRequest = axios({
    method,
    url: `${BASE_URL}${path}`,
    headers: {
      'WM_SEC.ACCESS_TOKEN': token,
      'WM_SVC.NAME': 'SVA Platform',
      'WM_QOS.CORRELATION_ID': randomUUID(),
      'WM_CONSUMER.CHANNEL.TYPE': '0f3e4dd4-0514-4346-b39d-af0e00ea066d',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    params,
    data: body,
  })
  const apiTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Walmart API timeout after 25s: ${method} ${path}`)), 25000)
  )
  const res = await Promise.race([apiRequest, apiTimeout])
  return res.data
}

// ── Normalise single item or array ────────────────────
function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

// ── Fetch orders for a specific date window (max 1 page) ──
async function fetchOrdersForWindow(
  clientId: string,
  clientSecret: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  try {
    const data = await walmartRequest('GET', '/orders', clientId, clientSecret, {
      createdStartDate: startDate,
      createdEndDate:   endDate,
      limit:            200,
      // Include ALL order statuses — default may exclude Delivered/older orders
      orderStatuses:    'Created,Acknowledged,Shipped,Delivered,Cancelled',
    })
    const orders = toArray(data?.list?.elements?.order)
    const total  = data?.list?.meta?.totalCount
    console.log(`[fetchWindow] ${startDate.slice(0,10)} → ${endDate.slice(0,10)}: ${orders.length} orders (total=${total})`)
    return orders
  } catch (e: any) {
    console.log(`[fetchWindow] ERROR ${startDate.slice(0,10)}: ${e.message}`)
    return []
  }
}

// ── Fetch ALL orders using 20-day windows (bypasses broken cursor pagination) ──
async function fetchAllOrdersByWindows(
  clientId: string,
  clientSecret: string,
  daysBack: number
): Promise<any[]> {
  const WINDOW_DAYS = 20  // ~8 orders/day × 20 = ~160 per window, safely under 200
  const now  = Date.now()
  const allOrdersMap = new Map<string, any>()

  for (let offset = 0; offset < daysBack; offset += WINDOW_DAYS) {
    const windowEnd   = new Date(now - offset * 24 * 60 * 60 * 1000).toISOString()
    const windowStart = new Date(now - Math.min(offset + WINDOW_DAYS, daysBack) * 24 * 60 * 60 * 1000).toISOString()

    const orders = await fetchOrdersForWindow(clientId, clientSecret, windowStart, windowEnd)

    // Merge lines per purchaseOrderId
    for (const o of orders) {
      const pid = o.purchaseOrderId as string
      if (!allOrdersMap.has(pid)) {
        allOrdersMap.set(pid, { ...o, orderLines: { orderLine: toArray(o.orderLines?.orderLine) } })
      } else {
        const existing = allOrdersMap.get(pid)!
        const lineMap  = new Map(toArray(existing.orderLines?.orderLine).map((l: any) => [l.lineNumber, l]))
        for (const nl of toArray(o.orderLines?.orderLine)) lineMap.set((nl as any).lineNumber, nl)
        existing.orderLines.orderLine = Array.from(lineMap.values())
      }
    }
  }

  return Array.from(allOrdersMap.values())
}

// ── Get credentials ────────────────────────────────────
async function getChannelCreds(orgId: string) {
  const config = await prisma.channelConfig.findFirst({
    where: { orgId, channel: 'WALMART', status: 'CONNECTED' },
  })
  if (!config) throw new Error('Walmart not connected')
  const creds = config.credentials as any
  if (!creds?.clientId || !creds?.clientSecret) throw new Error('Walmart credentials incomplete')
  return { config, creds: creds as { clientId: string; clientSecret: string } }
}

// ── Validate credentials ───────────────────────────────
export async function validateCredentials(clientId: string, clientSecret: string): Promise<boolean> {
  try {
    await getAccessToken(clientId, clientSecret)
    return true
  } catch {
    return false
  }
}

// ── Parse a Walmart order line's total ────────────────
function parseLineTotal(line: any): { unitPrice: number; qty: number; total: number } {
  const charges     = toArray(line.charges?.charge)
  const productCharge = charges.find((c: any) => c.chargeType === 'PRODUCT' || c.chargeName === 'ItemPrice')
                      ?? charges[0]
  const unitPrice = parseFloat(productCharge?.chargeAmount?.amount ?? '0')
  const qty       = parseInt(line.orderLineQuantity?.amount ?? '1', 10)
  return { unitPrice, qty, total: unitPrice * qty }
}

// ── Sync orders (SellerFulfilled + WFS, 180 days) ────
export async function syncOrders(orgId: string) {
  console.log(`[syncOrders] START for org ${orgId}`)
  const { config, creds } = await getChannelCreds(orgId)
  console.log(`[syncOrders] Got creds, fetching from Walmart API...`)
  const { clientId, clientSecret } = creds
  const createdStartDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  console.log(`[syncOrders] Date range start: ${createdStartDate}`)

  // Fetch using 20-day windows to bypass Walmart's broken cursor pagination
  console.log(`[syncOrders] fetching all orders via 20-day windows...`)
  const allOrdersList = await fetchAllOrdersByWindows(clientId, clientSecret, 180)
  console.log(`[syncOrders] total unique orders from Walmart: ${allOrdersList.length}`)

  const sellerResult = { status: 'fulfilled' as const, value: allOrdersList }
  const wfsResult    = { status: 'fulfilled' as const, value: [] as any[] }

  // Walmart API sends one entry PER ORDER LINE (not per purchase order).
  // Multiple lines in one order = same purchaseOrderId, different orderLine entries.
  // We MERGE lines into one order instead of overwriting.
  console.log(`[syncOrders] Walmart fetch done. SellerFulfilled: ${sellerResult.status === 'fulfilled' ? sellerResult.value.length : 'FAILED: ' + (sellerResult as any).reason?.message} | WalmartFulfilled: ${wfsResult.status === 'fulfilled' ? wfsResult.value.length : 'FAILED: ' + (wfsResult as any).reason?.message}`)

  const allOrdersMap = new Map<string, any>()

  for (const result of [sellerResult, wfsResult]) {
    if (result.status !== 'fulfilled') continue
    for (const o of result.value) {
      const pid = o.purchaseOrderId as string
      if (!allOrdersMap.has(pid)) {
        // Clone so we don't mutate the original
        allOrdersMap.set(pid, {
          ...o,
          orderLines: { orderLine: toArray(o.orderLines?.orderLine) }
        })
      } else {
        // Merge new lines into existing order
        const existing = allOrdersMap.get(pid)!
        const existingLines = toArray(existing.orderLines?.orderLine) as any[]
        const newLines      = toArray(o.orderLines?.orderLine)         as any[]
        // Dedup lines by lineNumber
        const lineMap = new Map(existingLines.map((l: any) => [l.lineNumber, l]))
        for (const nl of newLines) lineMap.set(nl.lineNumber, nl)
        existing.orderLines.orderLine = Array.from(lineMap.values())
      }
    }
  }

  const allOrders = Array.from(allOrdersMap.values())

  // Find which channelOrderIds already exist in DB (one query)
  const existingIds = new Set(
    (await prisma.order.findMany({
      where: { orgId, channel: 'WALMART' },
      select: { channelOrderId: true },
    })).map(o => o.channelOrderId)
  )

  console.log(`[syncOrders] Total from Walmart: ${allOrders.length} | Already in DB: ${existingIds.size}`)
  // Only process new orders
  const newOrders = allOrders.filter(o => !existingIds.has(o.purchaseOrderId))
  console.log(`[syncOrders] New orders to insert: ${newOrders.length}`)

  if (newOrders.length === 0) {
    await prisma.channelConfig.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS' },
    })
    return { synced: 0, totalFromWalmart: allOrders.length }
  }

  // Build order rows for bulk insert
  const orderRows = newOrders.map(o => {
    const lineItems  = toArray(o.orderLines?.orderLine)
    const orderTotal = lineItems.reduce((sum, line) => sum + parseLineTotal(line).total, 0)
    const postalAddr = o.shippingInfo?.postalAddress
    const firstLineStatus = toArray(toArray(o.orderLines?.orderLine)[0]?.orderLineStatuses?.orderLineStatus)[0]?.status ?? 'Created'

    return {
      orgId,
      orderNumber:       `WMT-${(o.purchaseOrderId as string).slice(-8)}`,
      channel:           'WALMART' as const,
      channelOrderId:    o.purchaseOrderId as string,
      status:            mapOrderStatus(firstLineStatus),
      fulfillmentStatus: mapFulfillmentStatus(firstLineStatus),
      paymentStatus:     'PAID',
      currency:          'USD',
      subtotal:          orderTotal,
      tax:               0,
      shipping:          0,
      total:             orderTotal,
      cogs:              0,
      shippingAddress:   postalAddr
        ? { name: postalAddr.name, line1: postalAddr.address1, line2: postalAddr.address2 ?? '',
            city: postalAddr.city, state: postalAddr.stateOrProvince ?? postalAddr.state,
            zip: postalAddr.postalCode, country: postalAddr.country }
        : undefined,
      orderedAt: new Date(
        typeof o.orderDate === 'number' ? o.orderDate : parseInt(String(o.orderDate))
      ),
    }
  })

  // Bulk insert all orders at once (skipDuplicates for safety)
  await prisma.order.createMany({ data: orderRows, skipDuplicates: true })

  console.log(`[syncOrders] createMany orders done, loading IDs...`)
  // Now load the created orders to get their IDs, then bulk insert items
  const createdOrders = await prisma.order.findMany({
    where: {
      orgId,
      channel: 'WALMART',
      channelOrderId: { in: newOrders.map(o => o.purchaseOrderId as string) },
    },
    select: { id: true, channelOrderId: true },
  })

  const orderIdMap = new Map(createdOrders.map(o => [o.channelOrderId, o.id]))

  // Build all order item rows
  const itemRows: any[] = []
  for (const o of newOrders) {
    const dbOrderId = orderIdMap.get(o.purchaseOrderId)
    if (!dbOrderId) continue

    for (const line of toArray(o.orderLines?.orderLine)) {
      const { unitPrice, qty, total } = parseLineTotal(line)
      itemRows.push({
        orderId:   dbOrderId,
        sku:       line.item?.sku ?? 'UNKNOWN',
        name:      line.item?.productName ?? 'Walmart Product',
        quantity:  qty,
        unitPrice,
        unitCost:  0,
        total,
      })
    }
  }

  // Bulk insert all items
  if (itemRows.length > 0) {
    await prisma.orderItem.createMany({ data: itemRows, skipDuplicates: true })
  }

  await prisma.channelConfig.update({
    where: { id: config.id },
    data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS' },
  })

  console.log(`[syncOrders] COMPLETE. synced=${newOrders.length} totalFromWalmart=${allOrders.length}`)
  return { synced: newOrders.length, totalFromWalmart: allOrders.length }
}

// ── Sync inventory ─────────────────────────────────────
export async function syncInventory(orgId: string) {
  const { creds } = await getChannelCreds(orgId)
  const { clientId, clientSecret } = creds

  let nextCursor: string | undefined
  let totalSynced = 0

  do {
    const params: Record<string, any> = { limit: 200 }
    if (nextCursor) params.nextCursor = nextCursor

    const data = await walmartRequest('GET', '/items', clientId, clientSecret, params)
    const items = toArray(data?.ItemResponse)
    const cursor = data?.nextCursor
    nextCursor = cursor && typeof cursor === 'string' && cursor.trim() !== '' ? cursor : undefined

    for (const item of items) {
      const sku = item.sku
      if (!sku) continue

      let quantity = 0
      try {
        const inv = await walmartRequest('GET', '/inventory', clientId, clientSecret, { sku })
        quantity   = parseInt(inv?.quantity?.amount ?? '0', 10)
      } catch { /* skip */ }

      const existing = await prisma.product.findFirst({ where: { orgId, sku } })
      const meta = {
        walmartItemId: item.wpid, publishStatus: item.publishedStatus,
        source: 'WALMART', lastWalmartSync: new Date().toISOString(),
      }

      if (!existing) {
        const created = await prisma.product.create({
          data: { orgId, sku, name: item.productName ?? sku, isActive: item.lifecycleStatus === 'ACTIVE', customFields: meta },
        })
        await prisma.inventoryItem.create({ data: { orgId, productId: created.id, channel: 'WALMART', quantity } })
        totalSynced++
      } else {
        await prisma.product.update({
          where: { id: existing.id },
          data: { customFields: { ...((existing.customFields as any) ?? {}), ...meta } },
        })
        const inv = await prisma.inventoryItem.findFirst({ where: { productId: existing.id, channel: 'WALMART' } })
        if (inv) {
          await prisma.inventoryItem.update({ where: { id: inv.id }, data: { quantity, updatedAt: new Date() } })
        } else {
          await prisma.inventoryItem.create({ data: { orgId, productId: existing.id, channel: 'WALMART', quantity } })
        }
      }
    }
  } while (nextCursor)

  return { synced: totalSynced }
}

// ── Get status ─────────────────────────────────────────
export async function getStatus(orgId: string) {
  return prisma.channelConfig.findFirst({
    where:  { orgId, channel: 'WALMART' },
    select: { status: true, displayName: true, lastSyncAt: true, lastSyncStatus: true },
  })
}

function mapOrderStatus(s: string): string {
  return ({ Created:'PENDING', Acknowledged:'PROCESSING', Shipped:'SHIPPED',
    Delivered:'DELIVERED', Cancelled:'CANCELLED', Refund:'COMPLETED',
    'Partially Shipped':'PROCESSING' } as any)[s] ?? 'PENDING'
}
function mapFulfillmentStatus(s: string): string {
  return ({ Created:'UNFULFILLED', Acknowledged:'UNFULFILLED', Shipped:'FULFILLED',
    'Partially Shipped':'PARTIAL', Delivered:'FULFILLED', Cancelled:'UNFULFILLED' } as any)[s] ?? 'UNFULFILLED'
}
