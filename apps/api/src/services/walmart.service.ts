import axios from 'axios'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/db'

const TOKEN_URL = 'https://marketplace.walmartapis.com/v3/token'
const BASE_URL  = 'https://marketplace.walmartapis.com/v3'

// ── Token cache ───────────────────────────────────────
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const cached = tokenCache.get(clientId)
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await axios.post(
    TOKEN_URL,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'WM_SVC.NAME': 'SVA Platform',
        'WM_QOS.CORRELATION_ID': randomUUID(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      timeout: 10000,
    }
  )

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
  const res = await axios({
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
    timeout: 30000,
  })
  return res.data
}

// ── Normalise orderLine: Walmart returns object when 1 line, array when many ──
function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

// ── Get all ship nodes (seller-fulfilled + WFS) ────────
async function getShipNodes(clientId: string, clientSecret: string): Promise<string[]> {
  try {
    const data = await walmartRequest('GET', '/settings/shipping/nodes', clientId, clientSecret)
    const nodes = toArray(data?.list?.member ?? data?.shipNode ?? data)
    const nodeIds = nodes
      .map((n: any) => n.shipNodeId ?? n.id ?? n.shipNode)
      .filter(Boolean)
    return nodeIds.length > 0 ? nodeIds : ['SELLER_FULFILLED']
  } catch {
    // If ship nodes API fails, return sentinel meaning "no filter" (all nodes)
    return []
  }
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

// ── Fetch all orders for a single ship node (paginated) ──
async function fetchOrdersForNode(
  clientId: string,
  clientSecret: string,
  createdStartDate: string,
  shipNode?: string
): Promise<any[]> {
  const collected: any[] = []
  let nextCursor: string | undefined

  do {
    const params: Record<string, any> = { createdStartDate, limit: 200 }
    if (nextCursor) params.nextCursor = nextCursor
    if (shipNode)   params.shipNode   = shipNode

    const data = await walmartRequest('GET', '/orders', clientId, clientSecret, params)
    const orders = toArray(data?.list?.elements?.order)
    const cursor = data?.list?.meta?.nextCursor

    collected.push(...orders)
    nextCursor = cursor && typeof cursor === 'string' && cursor.trim() !== '' ? cursor : undefined
  } while (nextCursor)

  return collected
}

// ── Sync orders (all ship nodes, 180 days) ─────────────
export async function syncOrders(orgId: string) {
  const { config, creds } = await getChannelCreds(orgId)
  const { clientId, clientSecret } = creds
  const createdStartDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()

  // Get all ship nodes so we capture WFS + seller-fulfilled
  const shipNodes = await getShipNodes(clientId, clientSecret)
  
  // Collect from all nodes (or no-filter call if nodes lookup failed)
  const allOrdersMap = new Map<string, any>() // dedup by purchaseOrderId

  if (shipNodes.length === 0) {
    // No ship node filter — get everything
    const orders = await fetchOrdersForNode(clientId, clientSecret, createdStartDate)
    for (const o of orders) allOrdersMap.set(o.purchaseOrderId, o)
  } else {
    // Fetch per node AND also one call without shipNode to catch anything missed
    const [noNodeOrders, ...nodeResults] = await Promise.allSettled([
      fetchOrdersForNode(clientId, clientSecret, createdStartDate), // no shipNode filter
      ...shipNodes.map(node => fetchOrdersForNode(clientId, clientSecret, createdStartDate, node))
    ])

    const allBatches = [noNodeOrders, ...nodeResults]
    for (const result of allBatches) {
      if (result.status === 'fulfilled') {
        for (const o of result.value) allOrdersMap.set(o.purchaseOrderId, o)
      }
    }
  }

  const allOrders = Array.from(allOrdersMap.values())
  let totalSynced = 0

  for (const o of allOrders) {
    const channelOrderId = o.purchaseOrderId
    const existing = await prisma.order.findFirst({ where: { orgId, channelOrderId } })
    if (existing) continue

    // Normalise line items (object OR array)
    const lineItems = toArray(o.orderLines?.orderLine)
    
    // Sum all PRODUCT charges across all lines
    const total = lineItems.reduce((sum: number, line: any) => {
      const charges = toArray(line.charges?.charge)
      const productCharge = charges.find((c: any) => c.chargeType === 'PRODUCT' || c.chargeName === 'ItemPrice')
                          ?? charges[0]
      const unitPrice = parseFloat(productCharge?.chargeAmount?.amount ?? '0')
      const qty       = parseInt(line.orderLineQuantity?.amount ?? '1', 10)
      return sum + unitPrice * qty
    }, 0)

    const postalAddr   = o.shippingInfo?.postalAddress
    const shippingAddress = postalAddr
      ? { name: postalAddr.name, line1: postalAddr.address1, line2: postalAddr.address2 ?? '',
          city: postalAddr.city, state: postalAddr.stateOrProvince ?? postalAddr.state,
          zip: postalAddr.postalCode, country: postalAddr.country }
      : undefined

    const firstLineStatus = toArray(o.orderLines?.orderLine)[0]?.orderLineStatuses?.orderLineStatus
    const topStatus = toArray(firstLineStatus)[0]?.status ?? 'Created'

    await prisma.order.create({
      data: {
        orgId,
        orderNumber:       `WMT-${channelOrderId.slice(-8)}`,
        channel:           'WALMART',
        channelOrderId,
        status:            mapOrderStatus(topStatus),
        fulfillmentStatus: mapFulfillmentStatus(topStatus),
        paymentStatus:     'PAID',
        currency:          'USD',
        subtotal:          total,
        tax:               0,
        shipping:          0,
        total,
        cogs:              0,
        shippingAddress,
        orderedAt:         new Date(typeof o.orderDate === 'number' ? o.orderDate : parseInt(o.orderDate)),
        items: {
          create: lineItems.map((line: any) => {
            const charges = toArray(line.charges?.charge)
            const productCharge = charges.find((c: any) => c.chargeType === 'PRODUCT' || c.chargeName === 'ItemPrice')
                                ?? charges[0]
            const unitPrice = parseFloat(productCharge?.chargeAmount?.amount ?? '0')
            const qty       = parseInt(line.orderLineQuantity?.amount ?? '1', 10)
            return {
              sku:       line.item?.sku ?? 'UNKNOWN',
              name:      line.item?.productName ?? 'Walmart Product',
              quantity:  qty,
              unitPrice,
              unitCost:  0,
              total:     unitPrice * qty,
            }
          }),
        },
      },
    })
    totalSynced++
  }

  await prisma.channelConfig.update({
    where: { id: config.id },
    data:  { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS' },
  })

  return { synced: totalSynced, totalFromWalmart: allOrders.length }
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
      } catch { /* skip individual SKU failure */ }

      const existing = await prisma.product.findFirst({ where: { orgId, sku } })

      if (!existing) {
        const created = await prisma.product.create({
          data: {
            orgId, sku,
            name:     item.productName ?? sku,
            isActive: item.lifecycleStatus === 'ACTIVE',
            customFields: {
              walmartItemId:   item.wpid,
              publishStatus:   item.publishedStatus,
              source:          'WALMART',
              lastWalmartSync: new Date().toISOString(),
            },
          },
        })
        await prisma.inventoryItem.create({
          data: { orgId, productId: created.id, channel: 'WALMART', quantity },
        })
        totalSynced++
      } else {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            customFields: {
              ...((existing.customFields as any) ?? {}),
              walmartItemId:   item.wpid,
              publishStatus:   item.publishedStatus,
              source:          'WALMART',
              lastWalmartSync: new Date().toISOString(),
            },
          },
        })
        const invItem = await prisma.inventoryItem.findFirst({
          where: { productId: existing.id, channel: 'WALMART' },
        })
        if (invItem) {
          await prisma.inventoryItem.update({ where: { id: invItem.id }, data: { quantity, updatedAt: new Date() } })
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

// ── Status mappers ─────────────────────────────────────
function mapOrderStatus(status: string): string {
  const map: Record<string, string> = {
    Created: 'PENDING', Acknowledged: 'PROCESSING', Shipped: 'SHIPPED',
    Delivered: 'DELIVERED', Cancelled: 'CANCELLED', Refund: 'COMPLETED',
    'Partially Shipped': 'PROCESSING',
  }
  return map[status] ?? 'PENDING'
}

function mapFulfillmentStatus(status: string): string {
  const map: Record<string, string> = {
    Created: 'UNFULFILLED', Acknowledged: 'UNFULFILLED', Shipped: 'FULFILLED',
    'Partially Shipped': 'PARTIAL', Delivered: 'FULFILLED', Cancelled: 'UNFULFILLED',
  }
  return map[status] ?? 'UNFULFILLED'
}
