import type { FastifyInstance } from 'fastify'
import { prisma } from '@sva/db'

export async function orderRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { page = '1', limit = '50', status, channel, search } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { orgId: req.user.orgId }
    if (status) where.status = status
    if (channel) where.channel = channel
    if (search) where.orderNumber = { contains: search, mode: 'insensitive' }
    const [data, total] = await Promise.all([
      prisma.order.findMany({ where, skip, take: parseInt(limit), include: { customer: { select: { firstName: true, lastName: true, email: true } }, items: true }, orderBy: { orderedAt: 'desc' } }),
      prisma.order.count({ where }),
    ])
    return reply.send({ success: true, data, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) })
  })

  app.get('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const order = await prisma.order.findFirst({ where: { id, orgId: req.user.orgId }, include: { customer: true, items: { include: { product: true } }, returns: true } })
    if (!order) return reply.code(404).send({ success: false })
    return reply.send({ success: true, data: order })
  })

  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { items, ...orderData } = req.body as any
    const order = await prisma.order.create({
      data: {
        ...orderData,
        orgId: req.user.orgId,
        items: { create: items ?? [] },
      },
      include: { items: true },
    })
    return reply.code(201).send({ success: true, data: order })
  })

  app.patch('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const order = await prisma.order.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: order })
  })
}
