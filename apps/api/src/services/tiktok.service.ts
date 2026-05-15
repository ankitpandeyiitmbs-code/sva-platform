import crypto from 'crypto'
import axios from 'axios'
import { prisma } from '../lib/db'

const APP_KEY = process.env.TIKTOK_APP_KEY!
const APP_SECRET = process.env.TIKTOK_APP_SECRET!
const AUTH_BASE = 'https://auth.tiktok-shops.com'
const API_BASE = 'https://open-api.tiktokshop.com'

// ── Signature ─────────────────────────────────────────
function generateSign(path: string, params: Record<string, string | number>): string {
  const entries = Object.entries(params)
    .filter(([k]) => k !== 'sign' && k !== 'access_token')
    .sort(([a], [b]) => a.localeCompare(b))

  let input = path
  for (const [k, v] of entries) {
    input += k + String(v)
  }

  return crypto
    .createHmac('sha256', APP_SECRET)
    .update(APP_SECRET + input + APP_SECRET)
    .digest('hex')
}

// ── Signed API request ────────────────────────────────
async function apiRequest(
  method: 'GET' | 'POST',
  path: string,
  accessToken: string,
  shopId: string,
  queryParams: Record<string, string | number> = {},
  body: any = null
) {
  const timestamp = Math.floor(Date.now() / 1000)
  const params: Record<string, string | number> = {
    ...queryParams,
    app_key: APP_KEY,
    shop_id: shopId,
    timestamp,
    version: '202309',
  }
  const sign = generateSign(path, params)

  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries({ ...params, sign, access_token: accessToken }).map(([k, v]) => [k, String(v)]))
  )

  const res = await axios({
    method,
    url: `${API_BASE}${path}?${qs}`,
    data: body ?? undefined,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  })
  return res.data
}

// ── OAuth: generate auth URL ──────────────────────────
export function getAuthUrl(state: string): string {
  return `${AUTH_BASE}/oauth/authorize?app_key=${APP_KEY}&state=${encodeURIComponent(state)}`
}

// ── OAuth: exchange code for tokens ──────────────────
export async function exchangeCode(authCode: string) {
  const res = await axios.post(`${AUTH_BASE}/api/v2/token/get`, {
    app_key: APP_KEY,
    app_secret: APP_SECRET,
    auth_code: authCode,
    grant_type: 'authorized_code',
  })
  if (res.data.code !== 0) throw new Error(res.data.message || 'Token exchange failed')
  return res.data.data as {
    access_token: string
    refresh_token: string
    access_token_expire_in: number
    refresh_token_expire_in: number
    open_id: string
    seller_name: string
    seller_base_region: string
    user_type: number
  }
}

// ── OAuth: refresh access token ───────────────────────
export async function refreshAccessToken(refreshToken: string) {
  const res = await axios.post(`${AUTH_BASE}/api/v2/token/refresh`, {
    app_key: APP_KEY,
    app_secret: APP_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  if (res.data.code !== 0) throw new Error(res.data.message || 'Token refresh failed')
  return res.data.data
}

// ── Get authorized shops ──────────────────────────────
export async function getShops(accessToken: string) {
  const timestamp = Math.floor(Date.now() / 1000)
  const params: Record<string, string | number> = { app_key: APP_KEY, timestamp, version: '202309' }
  const sign = generateSign('/authorization/202309/shops', params)
  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    sign,
    access_token: accessToken,
  })
  const res = await axios.get(`${API_BASE}/authorization/202309/shops?${qs}`)
  return res.data?.data?.shops ?? []
}

// ── Save connection to DB ─────────────────────────────
export async function saveConnection(orgId: string, tokenData: any, shopId: string, shopName: string) {
  const existing = await prisma.channelConfig.findFirst({ where: { orgId, channel: 'TIKTOK_SHOP' } })
  const credentials = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    shop_id: shopId,
    shop_name: shopName,
    access_token_expire_in: tokenData.access_token_expire_in,
    refresh_token_expire_in: tokenData.refresh_token_expire_in,
    connected_at: new Date().toISOString(),
  }
  if (existing) {
    return prisma.channelConfig.update({
      where: { id: existing.id },
      data: { credentials, status: 'CONNECTED', displayName: `TikTok Shop — ${shopName}`, syncEnabled: true },
    })
  }
  return prisma.channelConfig.create({
    data: {
      orgId, channel: 'TIKTOK_SHOP', displayName: `TikTok Shop — ${shopName}`,
      status: 'CONNECTED', credentials, syncEnabled: true,
    },
  })
}

// ── Sync orders ───────────────────────────────────────
export async function syncOrders(orgId: string) {
  const config = await prisma.channelConfig.findFirst({ where: { orgId, channel: 'TIKTOK_SHOP', status: 'CONNECTED' } })
  if (!config) throw new Error('TikTok Shop not connected')

  const creds = config.credentials as any
  const accessToken: string = creds.access_token
  const shopId: string = creds.shop_id

  // Fetch orders from last 30 days
  const fromDate = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
  const toDate = Math.floor(Date.now() / 1000)

  let pageToken = ''
  let totalSynced = 0

  do {
    const body: any = {
      create_time_ge: fromDate,
      create_time_lt: toDate,
      page_size: 50,
    }
    if (pageToken) body.page_token = pageToken

    const data = await apiRequest('POST', '/order/202309/orders/search', accessToken, shopId, {}, body)
    const orders = data?.data?.orders ?? []
    pageToken = data?.data?.next_page_token ?? ''

    for (const o of orders) {
      const existing = await prisma.order.findFirst({
        where: { orgId, channelOrderId: o.id },
      })
      if (existing) continue

      const total = Number(o.payment?.total_amount ?? 0) / 100
      const shipping = Number(o.payment?.shipping_fee ?? 0) / 100
      const tax = Number(o.payment?.tax ?? 0) / 100

      await prisma.order.create({
        data: {
          orgId,
          orderNumber: `TT-${o.id.slice(-8)}`,
          channel: 'TIKTOK_SHOP',
          channelOrderId: o.id,
          status: mapOrderStatus(o.status),
          fulfillmentStatus: mapFulfillmentStatus(o.fulfillment_type),
          paymentStatus: o.payment_status === 'PAID' ? 'PAID' : 'PENDING',
          currency: o.currency ?? 'USD',
          subtotal: Math.max(0, total - shipping - tax),
          tax,
          shipping,
          total,
          cogs: 0,
          shippingAddress: o.recipient_address ?? null,
          orderedAt: new Date(o.create_time * 1000),
          items: {
            create: (o.line_items ?? []).map((item: any) => ({
              sku: item.seller_sku ?? item.product_id,
              name: item.product_name ?? 'TikTok Product',
              quantity: item.quantity ?? 1,
              unitPrice: Number(item.sale_price ?? 0) / 100,
              unitCost: 0,
              total: (Number(item.sale_price ?? 0) / 100) * (item.quantity ?? 1),
            })),
          },
        },
      })
      totalSynced++
    }
  } while (pageToken)

  // Update last sync time
  await prisma.channelConfig.update({
    where: { id: config.id },
    data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS' },
  })

  return { synced: totalSynced }
}

// ── Sync products ─────────────────────────────────────
export async function syncProducts(orgId: string) {
  const config = await prisma.channelConfig.findFirst({ where: { orgId, channel: 'TIKTOK_SHOP', status: 'CONNECTED' } })
  if (!config) throw new Error('TikTok Shop not connected')

  const creds = config.credentials as any
  const accessToken: string = creds.access_token
  const shopId: string = creds.shop_id

  let pageToken = ''
  let totalSynced = 0

  do {
    const params: Record<string, string | number> = { page_size: 50 }
    if (pageToken) params.page_token = pageToken

    const data = await apiRequest('GET', '/product/202309/products', accessToken, shopId, params)
    const products = data?.data?.products ?? []
    pageToken = data?.data?.next_page_token ?? ''

    for (const p of products) {
      const sku = p.skus?.[0]?.seller_sku ?? p.id
      const existing = await prisma.product.findFirst({ where: { orgId, sku } })

      if (!existing) {
        const created = await prisma.product.create({
          data: {
            orgId,
            sku,
            name: p.title ?? 'TikTok Product',
            description: p.description,
            category: p.category_chains?.[0]?.name,
            imageUrls: (p.main_images ?? []).map((img: any) => img.url).filter(Boolean),
            isActive: p.status === 'ACTIVATE',
            customFields: { tiktok_id: p.id, source: 'TIKTOK_SHOP' },
          },
        })
        // Create inventory entry
        if (p.skus?.[0]?.inventory) {
          await prisma.inventoryItem.create({
            data: {
              orgId,
              productId: created.id,
              channel: 'TIKTOK_SHOP',
              quantity: p.skus[0].inventory?.[0]?.quantity ?? 0,
              costPrice: p.skus?.[0]?.price?.original_price
                ? Number(p.skus[0].price.original_price) / 100
                : null,
            },
          })
        }
        totalSynced++
      } else {
        // Update inventory
        const invItem = await prisma.inventoryItem.findFirst({ where: { productId: existing.id, channel: 'TIKTOK_SHOP' } })
        const qty = p.skus?.[0]?.inventory?.[0]?.quantity ?? 0
        if (invItem) {
          await prisma.inventoryItem.update({ where: { id: invItem.id }, data: { quantity: qty } })
        }
      }
    }
  } while (pageToken)

  return { synced: totalSynced }
}

// ── Status helpers ─────────────────────────────────────
function mapOrderStatus(status: string): string {
  const map: Record<string, string> = {
    UNPAID: 'PENDING',
    AWAITING_SHIPMENT: 'PROCESSING',
    AWAITING_COLLECTION: 'PROCESSING',
    IN_TRANSIT: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    PARTIALLY_RETURNED: 'COMPLETED',
    IN_CANCEL: 'CANCELLED',
  }
  return map[status] ?? 'PENDING'
}

function mapFulfillmentStatus(type: string): string {
  const map: Record<string, string> = {
    AWAITING_SHIPMENT: 'UNFULFILLED',
    IN_TRANSIT: 'PARTIAL',
    DELIVERED: 'FULFILLED',
    COMPLETED: 'FULFILLED',
  }
  return map[type] ?? 'UNFULFILLED'
}
