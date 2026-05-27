import type { FastifyInstance } from 'fastify'
import { syncOrders, syncInventory, getStatus, validateCredentials } from '../services/walmart.service'
import { prisma } from '../lib/db'

export async function walmartRoutes(app: FastifyInstance) {
  // GET /walmart/status
  app.get('/status', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const status = await getStatus(req.user.orgId)
    return reply.send({ success: true, data: status ?? { status: 'DISCONNECTED' } })
  })

  // POST /walmart/validate — test credentials before saving
  app.post('/validate', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { clientId, clientSecret } = req.body as { clientId: string; clientSecret: string }
    if (!clientId || !clientSecret) {
      return reply.code(400).send({ success: false, message: 'clientId and clientSecret are required' })
    }
    const valid = await validateCredentials(clientId, clientSecret)
    if (!valid) {
      return reply.code(400).send({ success: false, message: 'Invalid Walmart credentials — check your Client ID and Secret' })
    }
    return reply.send({ success: true, message: 'Credentials valid' })
  })

  // POST /walmart/sync — sync orders + inventory
  app.post('/sync', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    try {
      const [orders, inventory] = await Promise.all([
        syncOrders(req.user.orgId),
        syncInventory(req.user.orgId),
      ])
      return reply.send({ success: true, data: { orders, inventory } })
    } catch (err: any) {
      app.log.error(err)
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // DELETE /walmart/disconnect
  app.delete('/disconnect', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    await prisma.channelConfig.updateMany({
      where: { orgId: req.user.orgId, channel: 'WALMART' },
      data: { status: 'DISCONNECTED', credentials: {} },
    })
    return reply.send({ success: true, message: 'Walmart disconnected' })
  })
}
