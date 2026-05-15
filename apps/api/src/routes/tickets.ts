import type { FastifyInstance } from 'fastify'
import { prisma } from '@sva/db'

export async function ticketRoutes(app: FastifyInstance) {
  // ── List tickets ──────────────────────────────────────
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { status, priority, assignedTo, page = '1', limit = '50', search } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { orgId: req.user.orgId }
    if (status) where.status = status
    if (priority) where.priority = priority
    if (assignedTo) where.assignedTo = assignedTo
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [data, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          assignee: { select: { name: true, avatarUrl: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supportTicket.count({ where }),
    ])
    return reply.send({ success: true, data, total, totalPages: Math.ceil(total / parseInt(limit)) })
  })

  // ── Get single ticket ─────────────────────────────────
  app.get('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, orgId: req.user.orgId },
      include: {
        customer: true,
        messages: { orderBy: { createdAt: 'asc' } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    })
    if (!ticket) return reply.code(404).send({ success: false })
    return reply.send({ success: true, data: ticket })
  })

  // ── Create ticket ─────────────────────────────────────
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const count = await prisma.supportTicket.count({ where: { orgId: req.user.orgId } })
    const ticketNumber = `TKT-${String(count + 1).padStart(5, '0')}`
    const ticket = await prisma.supportTicket.create({
      data: { ...(req.body as any), orgId: req.user.orgId, ticketNumber, createdBy: req.user.sub },
    })
    return reply.code(201).send({ success: true, data: ticket })
  })

  // ── Update ticket ─────────────────────────────────────
  app.patch('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const body = req.body as any
    if ((body.status === 'RESOLVED' || body.status === 'CLOSED') && !body.resolvedAt) body.resolvedAt = new Date()
    const ticket = await prisma.supportTicket.update({ where: { id }, data: body })
    return reply.send({ success: true, data: ticket })
  })

  // ── Add message ───────────────────────────────────────
  app.post('/:id/messages', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const body = req.body as any
    const message = await prisma.ticketMessage.create({
      data: { ticketId: id, authorId: req.user.sub, authorType: 'AGENT', ...body },
    })
    if (!body.isInternal) {
      await prisma.supportTicket.update({
        where: { id },
        data: { firstResponseAt: new Date(), status: 'IN_PROGRESS' },
      })
    }
    return reply.code(201).send({ success: true, data: message })
  })

  // ── Support analytics ─────────────────────────────────
  app.get('/analytics/summary', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const orgId = req.user.orgId
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

    const [total, open, resolved, inProgress, byPriority] = await Promise.all([
      prisma.supportTicket.count({ where: { orgId } }),
      prisma.supportTicket.count({ where: { orgId, status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { orgId, status: 'RESOLVED' } }),
      prisma.supportTicket.count({ where: { orgId, status: 'IN_PROGRESS' } }),
      prisma.supportTicket.groupBy({ by: ['priority'], where: { orgId }, _count: true }),
    ])

    const resolvedInPeriod = await prisma.supportTicket.count({
      where: { orgId, status: 'RESOLVED', createdAt: { gte: thirtyDaysAgo } },
    })
    const createdInPeriod = await prisma.supportTicket.count({
      where: { orgId, createdAt: { gte: thirtyDaysAgo } },
    })
    const resolutionRate = createdInPeriod > 0 ? Math.round((resolvedInPeriod / createdInPeriod) * 100) : 0

    return reply.send({
      success: true,
      data: {
        total,
        open,
        resolved,
        inProgress,
        resolutionRate,
        byPriority: Object.fromEntries(byPriority.map((b) => [b.priority, b._count])),
      },
    })
  })
}
