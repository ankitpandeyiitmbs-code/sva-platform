import type { FastifyInstance } from 'fastify'
import { syncOrders, syncInventory, getStatus } from '../services/amazon.service'

const AMAZON_CHANNELS = ['AMAZON_US', 'AMAZON_IN', 'AMAZON_AE', 'AMAZON_UK', 'AMAZON_AU']

export async function amazonRoutes(app: FastifyInstance) {
  // GET /amazon/status — all Amazon channels status
  app.get('/status', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const statuses: Record<string, any> = {}
    for (const channel of AMAZON_CHANNELS) {
      statuses[channel] = await getStatus(req.user.orgId, channel)
    }
    return reply.send({ success: true, data: statuses })
  })

  // POST /amazon/:channel/sync — sync specific channel
  app.post('/:channel/sync', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { channel } = req.params as { channel: string }

    if (!AMAZON_CHANNELS.includes(channel)) {
      return reply.code(400).send({ success: false, message: 'Invalid Amazon channel' })
    }

    try {
      const [orders, inventory] = await Promise.all([
        syncOrders(req.user.orgId, channel),
        syncInventory(req.user.orgId, channel),
      ])
      return reply.send({ success: true, data: { orders, inventory } })
    } catch (err: any) {
      app.log.error(err)
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // POST /amazon/sync-all — sync all connected Amazon channels
  app.post('/sync-all', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const results: Record<string, any> = {}

    for (const channel of AMAZON_CHANNELS) {
      try {
        const [orders, inventory] = await Promise.all([
          syncOrders(req.user.orgId, channel),
          syncInventory(req.user.orgId, channel),
        ])
        results[channel] = { success: true, orders, inventory }
      } catch (err: any) {
        results[channel] = { success: false, error: err.message }
      }
    }

    return reply.send({ success: true, data: results })
  })
}
