import type { FastifyInstance } from 'fastify'
import { getAuthUrl, exchangeCode, getShops, saveConnection, syncOrders, syncProducts } from '../services/tiktok.service'
import { prisma } from '../lib/db'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

export async function tiktokRoutes(app: FastifyInstance) {
  // GET /tiktok/connect — returns OAuth URL
  app.get('/connect', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const state = Buffer.from(JSON.stringify({ orgId: req.user.orgId, userId: req.user.sub })).toString('base64url')
    const authUrl = getAuthUrl(state)
    return reply.send({ success: true, data: { authUrl } })
  })

  // GET /tiktok/callback — TikTok redirects here after auth
  app.get('/callback', { config: { skipAuth: true } as any }, async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string }

    if (!code || !state) {
      return reply.redirect(`${FRONTEND_URL}/settings?tiktok=error&reason=missing_params`)
    }

    try {
      const { orgId } = JSON.parse(Buffer.from(state, 'base64url').toString())
      const tokenData = await exchangeCode(code)
      const shops = await getShops(tokenData.access_token)
      const shop = shops[0]
      if (!shop) throw new Error('No shop found')

      await saveConnection(orgId, tokenData, shop.id ?? shop.shop_id, shop.name ?? shop.shop_name ?? 'TikTok Shop')

      // Trigger initial sync in background
      syncOrders(orgId).catch(() => {})
      syncProducts(orgId).catch(() => {})

      return reply.redirect(`${FRONTEND_URL}/settings?tiktok=connected`)
    } catch (err: any) {
      app.log.error(err)
      return reply.redirect(`${FRONTEND_URL}/settings?tiktok=error&reason=${encodeURIComponent(err.message)}`)
    }
  })

  // GET /tiktok/status — connection status
  app.get('/status', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const config = await prisma.channelConfig.findFirst({
      where: { orgId: req.user.orgId, channel: 'TIKTOK_SHOP' },
      select: { status: true, displayName: true, lastSyncAt: true, lastSyncStatus: true, credentials: true },
    })
    if (!config) return reply.send({ success: true, data: { connected: false } })
    const creds = config.credentials as any
    return reply.send({
      success: true,
      data: {
        connected: config.status === 'CONNECTED',
        shopName: creds?.shop_name,
        lastSyncAt: config.lastSyncAt,
        lastSyncStatus: config.lastSyncStatus,
      },
    })
  })

  // POST /tiktok/sync — manual sync trigger
  app.post('/sync', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    try {
      const [orders, products] = await Promise.all([
        syncOrders(req.user.orgId),
        syncProducts(req.user.orgId),
      ])
      return reply.send({ success: true, data: { orders, products } })
    } catch (err: any) {
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // DELETE /tiktok/disconnect
  app.delete('/disconnect', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    await prisma.channelConfig.updateMany({
      where: { orgId: req.user.orgId, channel: 'TIKTOK_SHOP' },
      data: { status: 'DISCONNECTED', credentials: {} },
    })
    return reply.send({ success: true })
  })
}
