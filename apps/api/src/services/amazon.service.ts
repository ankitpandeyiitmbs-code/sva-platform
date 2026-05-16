import axios from 'axios'
import { prisma } from '../lib/db'

const LWA_URL = 'https://api.amazon.com/auth/o2/token'

// ── Marketplace configs ───────────────────────────────
const MARKETPLACE: Record<string, { endpoint: string; marketplaceId: string; currency: string }> = {
  AMAZON_US: { endpoint: 'https://sellingpartnerapi-na.amazon.com', marketplaceId: 'ATVPDKIKX0DER', currency: 'USD' },
  AMAZON_UK: { endpoint: 'https://sellingpartnerapi-eu.amazon.com', marketplaceId: 'A1F83G8C2ARO7P', currency: 'GBP' },
  AMAZON_AE: { endpoint: 'https://sellingpartnerapi-eu.amazon.com', marketplaceId: 'A2VIGQ35RCS4UG', currency: 'AED' },
  AMAZON_IN: { endpoint: 'https://sellingpartnerapi-fe.amazon.com', marketplaceId: 'A21TJRUUN4KGV', currency: 'INR' },
  AMAZON_AU: { endpoint: 'https://sellingpartnerapi-fe.amazon.com', marketplaceId: 'A39IBJ37TRP1C6', currency: 'AUD' },
}

// ── LWA token refresh ─────────────────────────────────
async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await axios.post(
    LWA_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
  )
  return res.data.access_token
}

// ── SP-API request helper ─────────────────────────────
async function spRequest(
  method: 'GET' | 'POST',
  endpoint: string,
  path: string,
  accessToken: string,
  params?: Record<string, string>,
  body?: any
) {
  const res = await axios({
    method,
    url: `${endpoint}${path}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
    },
    params,
    data: body,
    timeout: 20000,
  })
  return res.data
}

// ── Get channel credentials from DB ───────────────────
async function getChannelCreds(orgId: string, channel: string) {
  const config = await prisma.channelConfig.findFirst({
    where: { orgId, channel, status: 'CONNECTED' },
  })
  if (!config) throw new Error(`${channel} not connected`)
  const creds = config.credentials as any
  if (!creds?.clientId || !creds?.clientSecret || !creds?.refreshToken) {
    throw new Error(`${channel} credentials incomplete`)
  }
  return { config, creds: creds as { clientId: string; clientSecret: string; refreshToken: string } }
}

// ── Sync orders ───────────────────────────────────────
export async function syncOrders(orgId: string, channel: string) {
  const mkt = MARKETPLACE[channel]
  if (!mkt) throw new Error(`Unknown channel: ${channel}`)

  const { config, creds } = await getChannelCreds(orgId, channel)
  const accessToken = await getAccessToken(creds.clientId, creds.clientSecret, creds.refreshToken)

  const createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  let nextToken: string | undefined
  let totalSynced = 0

  do {
    const params: Record<string, string> = {
      MarketplaceIds: mkt.marketplaceId,
      CreatedAfter: createdAfter,
    }
    if (nextToken) params.NextToken = nextToken

    const data = await spRequest('GET', mkt.endpoint, '/orders/v0/orders', accessToken, params)
    const orders = data?.payload?.Orders ?? []
    nextToken = data?.payload?.NextToken

    for (const o of orders) {
      const existing = await prisma.order.findFirst({ where: { orgId, channelOrderId: o.AmazonOrderId } })
      if (existing) continue

      // Fetch order items
      let lineItems: any[] = []
      try {
        const itemsData = await spRequest(
          'GET', mkt.endpoint,
          `/orders/v0/orders/${o.AmazonOrderId}/orderItems`,
          accessToken
        )
        lineItems = itemsData?.payload?.OrderItems ?? []
      } catch { /* skip if items fail */ }

      const total = parseFloat(o.OrderTotal?.Amount ?? '0')
      const currency = o.OrderTotal?.CurrencyCode ?? mkt.currency

      await prisma.order.create({
        data: {
          orgId,
          orderNumber: `AMZ-${o.AmazonOrderId.slice(-8)}`,
          channel,
          channelOrderId: o.AmazonOrderId,
          status: mapOrderStatus(o.OrderStatus),
          fulfillmentStatus: mapFulfillmentStatus(o.OrderStatus),
          paymentStatus: ['Shipped', 'InvoiceUnconfirmed'].includes(o.OrderStatus) ? 'PAID' : 'PENDING',
          currency,
          subtotal: total,
          tax: 0,
          shipping: 0,
          total,
          cogs: 0,
          shippingAddress: o.ShippingAddress
            ? {
                name: o.ShippingAddress.Name,
                line1: o.ShippingAddress.AddressLine1,
                line2: o.ShippingAddress.AddressLine2 ?? '',
                city: o.ShippingAddress.City,
                state: o.ShippingAddress.StateOrRegion,
                zip: o.ShippingAddress.PostalCode,
                country: o.ShippingAddress.CountryCode,
              }
            : null,
          orderedAt: new Date(o.PurchaseDate),
          items: {
            create: lineItems.map((item: any) => ({
              sku: item.SellerSKU ?? item.ASIN ?? 'UNKNOWN',
              name: item.Title ?? 'Amazon Product',
              quantity: item.QuantityOrdered ?? 1,
              unitPrice: parseFloat(item.ItemPrice?.Amount ?? '0') / Math.max(1, item.QuantityOrdered ?? 1),
              unitCost: 0,
              total: parseFloat(item.ItemPrice?.Amount ?? '0'),
            })),
          },
        },
      })
      totalSynced++
    }
  } while (nextToken)

  await prisma.channelConfig.update({
    where: { id: config.id },
    data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS' },
  })

  return { synced: totalSynced }
}

// ── Sync FBA inventory ────────────────────────────────
export async function syncInventory(orgId: string, channel: string) {
  const mkt = MARKETPLACE[channel]
  if (!mkt) throw new Error(`Unknown channel: ${channel}`)

  const { creds } = await getChannelCreds(orgId, channel)
  const accessToken = await getAccessToken(creds.clientId, creds.clientSecret, creds.refreshToken)

  let nextToken: string | undefined
  let totalSynced = 0

  do {
    const params: Record<string, string> = {
      MarketplaceIds: mkt.marketplaceId,
      granularity: 'Marketplace',
      granularityId: mkt.marketplaceId,
    }
    if (nextToken) params.nextToken = nextToken

    const data = await spRequest('GET', mkt.endpoint, '/fba/inventory/v1/summaries', accessToken, params)
    const items = data?.payload?.inventorySummaries ?? []
    nextToken = data?.pagination?.nextToken

    for (const item of items) {
      const sku = item.sellerSku
      if (!sku) continue

      const existing = await prisma.product.findFirst({ where: { orgId, sku } })

      if (!existing) {
        const created = await prisma.product.create({
          data: {
            orgId,
            sku,
            name: item.productName ?? sku,
            isActive: true,
            customFields: { asin: item.asin, source: channel },
          },
        })
        await prisma.inventoryItem.create({
          data: {
            orgId,
            productId: created.id,
            channel,
            quantity: item.totalQuantity ?? 0,
          },
        })
        totalSynced++
      } else {
        const invItem = await prisma.inventoryItem.findFirst({
          where: { productId: existing.id, channel },
        })
        if (invItem) {
          await prisma.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: item.totalQuantity ?? 0, updatedAt: new Date() },
          })
        } else {
          await prisma.inventoryItem.create({
            data: { orgId, productId: existing.id, channel, quantity: item.totalQuantity ?? 0 },
          })
        }
      }
    }
  } while (nextToken)

  return { synced: totalSynced }
}

// ── Get status ────────────────────────────────────────
export async function getStatus(orgId: string, channel: string) {
  return prisma.channelConfig.findFirst({
    where: { orgId, channel },
    select: { status: true, displayName: true, lastSyncAt: true, lastSyncStatus: true },
  })
}

// ── Status mappers ────────────────────────────────────
function mapOrderStatus(status: string): string {
  const map: Record<string, string> = {
    Pending: 'PENDING',
    PendingAvailability: 'PENDING',
    Unshipped: 'PROCESSING',
    PartiallyShipped: 'PROCESSING',
    Shipped: 'SHIPPED',
    InvoiceUnconfirmed: 'PROCESSING',
    Canceled: 'CANCELLED',
    Unfulfillable: 'CANCELLED',
  }
  return map[status] ?? 'PENDING'
}

function mapFulfillmentStatus(status: string): string {
  const map: Record<string, string> = {
    Pending: 'UNFULFILLED',
    PendingAvailability: 'UNFULFILLED',
    Unshipped: 'UNFULFILLED',
    PartiallyShipped: 'PARTIAL',
    Shipped: 'FULFILLED',
    Canceled: 'UNFULFILLED',
  }
  return map[status] ?? 'UNFULFILLED'
}
