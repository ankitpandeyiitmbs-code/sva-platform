import type { FastifyInstance } from 'fastify'
import { prisma } from '@sva/db'

export async function customerRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { page = '1', limit = '50', search } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { orgId: req.user.orgId }
    if (search) where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
    ]
    const [data, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.customer.count({ where }),
    ])
    return reply.send({ success: true, data, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) })
  })

  app.get('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const customer = await prisma.customer.findFirst({
      where: { id, orgId: req.user.orgId },
      include: {
        orders: { orderBy: { orderedAt: 'desc' }, take: 20 },
        deals: { orderBy: { createdAt: 'desc' }, take: 10 },
        tickets: { orderBy: { createdAt: 'desc' }, take: 10 },
        activities: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    })
    if (!customer) return reply.code(404).send({ success: false })
    return reply.send({ success: true, data: customer })
  })

  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const data = req.body as any
    const customer = await prisma.customer.create({ data: { ...data, orgId: req.user.orgId } })
    return reply.code(201).send({ success: true, data: customer })
  })

  app.patch('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const customer = await prisma.customer.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: customer })
  })

  app.delete('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.customer.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // GET /customers/segments
  app.get('/segments/list', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const segments = await prisma.customerSegment.findMany({ where: { orgId: req.user.orgId } })
    return reply.send({ success: true, data: segments })
  })
}
