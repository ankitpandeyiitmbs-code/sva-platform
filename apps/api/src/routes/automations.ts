import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'

export async function automationRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const automations = await prisma.automation.findMany({ where: { orgId: req.user.orgId }, include: { _count: { select: { runs: true } } }, orderBy: { createdAt: 'desc' } })
    return reply.send({ success: true, data: automations })
  })

  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const automation = await prisma.automation.create({ data: { ...(req.body as any), orgId: req.user.orgId } })
    return reply.code(201).send({ success: true, data: automation })
  })

  app.patch('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const automation = await prisma.automation.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: automation })
  })

  app.delete('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.automation.delete({ where: { id } })
    return reply.send({ success: true })
  })

  app.get('/:id/runs', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const runs = await prisma.automationRun.findMany({ where: { automationId: id }, orderBy: { startedAt: 'desc' }, take: 100 })
    return reply.send({ success: true, data: runs })
  })
}
