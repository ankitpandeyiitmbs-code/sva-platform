import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'
import { backfillCustomers } from '../services/customer-sync.service'

export async function customerRoutes(app: FastifyInstance) {
  // GET /customers/stats — KPI summary
  app.get('/stats', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const orgId = req.user.orgId
    const [total, active, topLtv, repeatCount] = await Promise.all([
      prisma.customer.count({ where: { orgId } }),
      prisma.customer.count({ where: { orgId, isActive: true } }),
      prisma.customer.aggregate({ where: { orgId }, _avg: { ltv: true }, _sum: { ltv: true } }),
      prisma.customer.count({ where: { orgId, totalOrders: { gte: 2 } } }),
    ])
    return reply.send({
      success: true,
      data: {
        total,
        active,
        avgLtv: Number(topLtv._avg.ltv ?? 0),
        totalRevenue: Number(topLtv._sum.ltv ?? 0),
        repeatRate: total > 0 ? Math.round((repeatCount / total) * 100) : 0,
      },
    })
  })

  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { page = '1', limit = '50', search, channel, tier, sort = 'createdAt' } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { orgId: req.user.orgId }
    if (search) where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
    ]
    if (channel) where.sourceChannel = channel
    if (tier) where.loyaltyTier = tier

    const orderBy: any =
      sort === 'ltv' ? { ltv: 'desc' } :
      sort === 'orders' ? { totalOrders: 'desc' } :
      sort === 'lastOrder' ? { lastOrderAt: 'desc' } :
      { createdAt: 'desc' }

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where, skip, take: parseInt(limit), orderBy,
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          company: true, avatarUrl: true, sourceChannel: true, source: true,
          ltv: true, totalOrders: true, averageOrderValue: true,
          loyaltyTier: true, loyaltyPoints: true, leadScore: true,
          tags: true, country: true, city: true, isActive: true,
          lastOrderAt: true, createdAt: true,
        },
      }),
      prisma.customer.count({ where }),
    ])
    return reply.send({ success: true, data, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) })
  })

  // POST /customers/backfill — build customer records from all existing orders
  app.post('/backfill', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    try {
      const result = await backfillCustomers(req.user.orgId)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.code(500).send({ success: false, message: err.message })
    }
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
