import type { FastifyInstance } from 'fastify'
import { prisma } from '@sva/db'

export async function channelRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const channels = await prisma.channelConfig.findMany({ where: { orgId: req.user.orgId } })
    return reply.send({ success: true, data: channels })
  })

  app.put('/:channel', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { channel } = req.params as { channel: string }
    const { credentials, displayName, syncEnabled } = req.body as any
    const config = await prisma.channelConfig.upsert({
      where: { orgId_channel: { orgId: req.user.orgId, channel } },
      update: { credentials, syncEnabled, displayName, status: 'CONNECTED', updatedAt: new Date() },
      create: { orgId: req.user.orgId, channel, displayName: displayName ?? channel, credentials: credentials ?? {}, status: 'CONNECTED' },
    })
    return reply.send({ success: true, data: config })
  })

  app.post('/:channel/sync', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    // Sync job would be queued here via BullMQ
    return reply.send({ success: true, message: 'Sync job queued' })
  })
}
