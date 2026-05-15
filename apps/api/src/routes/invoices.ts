import type { FastifyInstance } from 'fastify'
import { prisma } from '@sva/db'

export async function invoiceRoutes(app: FastifyInstance) {
  // ── Invoices ──────────────────────────────────────────
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { status, type, page = '1', limit = '50' } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { orgId: req.user.orgId }
    if (status) where.status = status
    if (type) where.type = type
    const [data, total] = await Promise.all([
      prisma.invoice.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.invoice.count({ where }),
    ])
    return reply.send({ success: true, data, total, totalPages: Math.ceil(total / parseInt(limit)) })
  })

  app.get('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const invoice = await prisma.invoice.findFirst({ where: { id, orgId: req.user.orgId } })
    if (!invoice) return reply.code(404).send({ success: false })
    return reply.send({ success: true, data: invoice })
  })

  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const body = req.body as any
    const count = await prisma.invoice.count({ where: { orgId: req.user.orgId } })
    const invoiceNumber = body.type === 'QUOTE'
      ? `QTE-${String(count + 1).padStart(5, '0')}`
      : `INV-${String(count + 1).padStart(5, '0')}`
    const invoice = await prisma.invoice.create({
      data: { ...body, orgId: req.user.orgId, invoiceNumber },
    })
    return reply.code(201).send({ success: true, data: invoice })
  })

  app.patch('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const body = req.body as any
    if (body.status === 'PAID' && !body.paidAt) body.paidAt = new Date()
    const invoice = await prisma.invoice.update({ where: { id }, data: body })
    return reply.send({ success: true, data: invoice })
  })

  app.delete('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.invoice.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Expenses ──────────────────────────────────────────
  app.get('/expenses', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { category, page = '1', limit = '50' } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { orgId: req.user.orgId }
    if (category) where.category = category
    const [data, total] = await Promise.all([
      prisma.expense.findMany({ where, skip, take: parseInt(limit), orderBy: { date: 'desc' } }),
      prisma.expense.count({ where }),
    ])
    return reply.send({ success: true, data, total, totalPages: Math.ceil(total / parseInt(limit)) })
  })

  app.post('/expenses', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const expense = await prisma.expense.create({ data: { ...(req.body as any), orgId: req.user.orgId } })
    return reply.code(201).send({ success: true, data: expense })
  })

  app.patch('/expenses/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const expense = await prisma.expense.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: expense })
  })

  app.delete('/expenses/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.expense.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Finance summary ───────────────────────────────────
  app.get('/summary', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const orgId = req.user.orgId
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const [invoiceSummary, expenseSummary, overdueCount, paidMtd] = await Promise.all([
      prisma.invoice.aggregate({
        where: { orgId },
        _sum: { total: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { orgId },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.count({
        where: { orgId, status: { in: ['SENT', 'OVERDUE'] }, dueDate: { lt: now } },
      }),
      prisma.invoice.aggregate({
        where: { orgId, status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { total: true },
      }),
    ])

    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: { orgId },
      _sum: { amount: true },
    })

    const revenueByMonth = await prisma.invoice.groupBy({
      by: ['createdAt'],
      where: { orgId, status: 'PAID', createdAt: { gte: startOfYear } },
      _sum: { total: true },
    })

    return reply.send({
      success: true,
      data: {
        totalInvoiced: Number(invoiceSummary._sum.total ?? 0),
        totalExpenses: Number(expenseSummary._sum.amount ?? 0),
        invoiceCount: invoiceSummary._count,
        expenseCount: expenseSummary._count,
        overdueCount,
        paidMtd: Number(paidMtd._sum.total ?? 0),
        expensesByCategory: expensesByCategory.map((e) => ({
          category: e.category,
          amount: Number(e._sum.amount ?? 0),
        })),
      },
    })
  })
}
