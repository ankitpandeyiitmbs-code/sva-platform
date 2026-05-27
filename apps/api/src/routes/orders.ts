import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'

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

  // GET /orders/stats — server-side aggregated stats with proper date filter
  app.get('/stats', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { channel, days = '30' } = req.query as any
    const orgId = req.user.orgId
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)

    const where: any = { orgId, orderedAt: { gte: since } }
    if (channel) where.channel = channel

    const [agg, orders, allTime] = await Promise.all([
      prisma.order.aggregate({
        where,
        _sum: { total: true },
        _count: { id: true },
        _avg: { total: true },
      }),
      prisma.order.findMany({
        where,
        select: { orderedAt: true, total: true, status: true },
        orderBy: { orderedAt: 'asc' },
      }),
      prisma.order.aggregate({
        where: { orgId, ...(channel ? { channel } : {}) },
        _sum: { total: true },
        _count: { id: true },
      }),
    ])

    const pending = orders.filter(o => ['PENDING','PROCESSING'].includes(o.status)).length

    const byDay: Record<string, number> = {}
    for (const o of orders) {
      const day = o.orderedAt.toISOString().slice(0, 10)
      byDay[day] = (byDay[day] ?? 0) + Number(o.total ?? 0)
    }
    const chart = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }))

    const items = await prisma.orderItem.findMany({
      where: { order: where },
      select: { sku: true, name: true, quantity: true, total: true },
    })
    const skuMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    for (const item of items) {
      if (!skuMap[item.sku]) skuMap[item.sku] = { name: item.name, qty: 0, revenue: 0 }
      skuMap[item.sku].qty     += item.quantity
      skuMap[item.sku].revenue += Number(item.total ?? 0)
    }
    const topSkus = Object.entries(skuMap)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 8)
      .map(([sku, v]) => ({ sku, ...v }))

    return reply.send({
      success: true,
      data: {
        period:     parseInt(days),
        revenue:    Number(agg._sum.total ?? 0),
        orderCount: agg._count.id,
        aov:        Number(agg._avg.total ?? 0),
        pending,
        chart,
        topSkus,
        allTime: {
          revenue:    Number(allTime._sum.total ?? 0),
          orderCount: allTime._count.id,
        },
      },
    })
  })
}

// ── Stats endpoint ─────────────────────────────────────────────
// GET /orders/stats?channel=WALMART&days=30
// Returns accurate server-side computed stats with proper date filtering
