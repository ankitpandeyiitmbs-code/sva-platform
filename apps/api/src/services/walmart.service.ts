import axios from 'axios'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/db'

const TOKEN_URL = 'https://marketplace.walmartapis.com/v3/token'
const BASE_URL  = 'https://marketplace.walmartapis.com/v3'

// ── In-memory token cache (per clientId) ──────────────────
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

// ── Auth: get/refresh access token ───────────────────────
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
  tokenCache.set(clientId, {
    token: access_token,
    expiresAt: Date.now() + (expires_in ?? 900) * 1000,
  })
  return access_token
}

// ── Authenticated request helper ──────────────────────────
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
    timeout: 20000,
  })
  return res.data
}

// ── Get credentials from DB ───────────────────────────────
async function getChannelCreds(orgId: string) {
  const config = await prisma.channelConfig.findFirst({
    where: { orgId, channel: 'WALMART', status: 'CONNECTED' },
  })
  if (!config) throw new Error('Walmart not connected')
  const creds = config.credentials as any
  if (!creds?.clientId || !creds?.clientSecret) throw new Error('Walmart credentials incomplete')
  return { config, creds: creds as { clientId: string; clientSecret: string } }
}

// ── Validate credentials (called before saving) ───────────
export async function validateCredentials(clientId: string, clientSecret: string): Promise<boolean> {
  try {
    await getAccessToken(clientId, clientSecret)
    return true
  } catch {
    return false
  }
}

// ── Sync orders (last 30 days) ────────────────────────────
export async function syncOrders(orgId: string) {
  const { config, creds } = await getChannelCreds(orgId)
  const { clientId, clientSecret } = creds

  const createdStartDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  let nextCursor: string | undefined
  let totalSynced = 0

  do {
    const params: Record<string, any> = { createdStartDate, limit: 200 }
    if (nextCursor) params.nextCursor = nextCursor

    const data = await walmartRequest('GET', '/orders', clientId, clientSecret, params)
    const orders = data?.list?.elements?.order ?? []
    nextCursor = data?.list?.meta?.nextCursor

    for (const o of orders) {
      const channelOrderId = o.purchaseOrderId
      const existing = await prisma.order.findFirst({ where: { orgId, channelOrderId } })
      if (existing) continue

      const lineItems = o.orderLines?.orderLine ?? []
      const total = lineItems.reduce((sum: number, line: any) => {
        return sum + parseFloat(line.charges?.charge?.[0]?.chargeAmount?.amount ?? '0')
      }, 0)

      const postalAddr = o.shippingInfo?.postalAddress
      const shippingAddress = postalAddr
        ? {
            name:    postalAddr.name,
            line1:   postalAddr.address1,
            line2:   postalAddr.address2 ?? '',
            city:    postalAddr.city,
            state:   postalAddr.state,
            zip:     postalAddr.postalCode,
            country: postalAddr.country,
          }
        : undefined

      await prisma.order.create({
        data: {
          orgId,
          orderNumber: `WMT-${channelOrderId.slice(-8)}`,
          channel: 'WALMART',
          channelOrderId,
          status: mapOrderStatus(
            o.orderLines?.orderLine?.[0]?.orderLineStatuses?.orderLineStatus?.[0]?.status ?? 'Created'
          ),
          fulfillmentStatus: mapFulfillmentStatus(
            o.orderLines?.orderLine?.[0]?.orderLineStatuses?.orderLineStatus?.[0]?.status ?? 'Created'
          ),
          paymentStatus: 'PAID',
          currency: 'USD',
          subtotal: total,
          tax: 0,
          shipping: 0,
          total,
          cogs: 0,
          shippingAddress,
          orderedAt: new Date(o.orderDate),
          items: {
            create: lineItems.map((line: any) => ({
              sku:       line.item?.sku ?? line.productInfo?.sku ?? 'UNKNOWN',
              name:      line.item?.productName ?? 'Walmart Product',
              quantity:  parseInt(line.orderLineQuantity?.amount ?? '1', 10),
              unitPrice:
                parseFloat(line.charges?.charge?.[0]?.chargeAmount?.amount ?? '0') /
                Math.max(1, parseInt(line.orderLineQuantity?.amount ?? '1', 10)),
              unitCost: 0,
              total: parseFloat(line.charges?.charge?.[0]?.chargeAmount?.amount ?? '0'),
            })),
          },
        },
      })
      totalSynced++
    }
  } while (nextCursor)

  await prisma.channelConfig.update({
    where: { id: config.id },
    data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS' },
  })

  return { synced: totalSynced }
}

// ── Sync inventory / items ────────────────────────────────
export async function syncInventory(orgId: string) {
  const { creds } = await getChannelCreds(orgId)
  const { clientId, clientSecret } = creds

  let nextCursor: string | undefined
  let totalSynced = 0

  do {
    const params: Record<string, any> = { limit: 200 }
    if (nextCursor) params.nextCursor = nextCursor

    const data = await walmartRequest('GET', '/items', clientId, clientSecret, params)
    const items = data?.ItemResponse ?? []
    nextCursor = data?.nextCursor

    for (const item of items) {
      const sku = item.sku
      if (!sku) continue

      // Fetch inventory level for this SKU
      let quantity = 0
      try {
        const inv = await walmartRequest('GET', '/inventory', clientId, clientSecret, { sku })
        quantity = parseInt(inv?.quantity?.amount ?? '0', 10)
      } catch { /* skip if inventory call fails for individual SKU */ }

      const existing = await prisma.product.findFirst({ where: { orgId, sku } })

      if (!existing) {
        const created = await prisma.product.create({
          data: {
            orgId,
            sku,
            name:     item.productName ?? sku,
            isActive: item.lifecycleStatus === 'ACTIVE',
            customFields: {
              walmartItemId:    item.wpid,
              publishStatus:    item.publishedStatus,
              source:           'WALMART',
              lastWalmartSync:  new Date().toISOString(),
            },
          },
        })
        await prisma.inventoryItem.create({
          data: {
            orgId,
            productId: created.id,
            channel:   'WALMART',
            quantity,
          },
        })
        totalSynced++
      } else {
        const existingCf = (existing.customFields as any) ?? {}
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            customFields: {
              ...existingCf,
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
          await prisma.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity, updatedAt: new Date() },
          })
        } else {
          await prisma.inventoryItem.create({
            data: { orgId, productId: existing.id, channel: 'WALMART', quantity },
          })
        }
      }
    }
  } while (nextCursor)

  return { synced: totalSynced }
}

// ── Get connection status ─────────────────────────────────
export async function getStatus(orgId: string) {
  return prisma.channelConfig.findFirst({
    where: { orgId, channel: 'WALMART' },
    select: {
      status: true,
      displayName: true,
      lastSyncAt: true,
      lastSyncStatus: true,
    },
  })
}

// ── Status mappers ────────────────────────────────────────
function mapOrderStatus(status: string): string {
  const map: Record<string, string> = {
    Created:              'PENDING',
    Acknowledged:         'PROCESSING',
    Shipped:              'SHIPPED',
    Delivered:            'DELIVERED',
    Cancelled:            'CANCELLED',
    Refund:               'COMPLETED',
    'Partially Shipped':  'PROCESSING',
  }
  return map[status] ?? 'PENDING'
}

function mapFulfillmentStatus(status: string): string {
  const map: Record<string, string> = {
    Created:              'UNFULFILLED',
    Acknowledged:         'UNFULFILLED',
    Shipped:              'FULFILLED',
    'Partially Shipped':  'PARTIAL',
    Delivered:            'FULFILLED',
    Cancelled:            'UNFULFILLED',
  }
  return map[status] ?? 'UNFULFILLED'
}
