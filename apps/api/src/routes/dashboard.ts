import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'
import { subDays, startOfMonth, endOfMonth, startOfDay } from 'date-fns'

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /dashboard/overview — main KPI cards
  app.get('/overview', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { orgId } = req.user
    const now = new Date()
    const start30 = subDays(now, 30)
    const start60 = subDays(now, 60)

    const [revenueResult, prevRevenueResult, orderCount, prevOrderCount, customerCount] = await Promise.all([
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: start30 }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: start60, lt: start30 }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      prisma.order.count({ where: { orgId, orderedAt: { gte: start30 }, status: { not: 'CANCELLED' } } }),
      prisma.order.count({ where: { orgId, orderedAt: { gte: start60, lt: start30 }, status: { not: 'CANCELLED' } } }),
      prisma.customer.count({ where: { orgId, createdAt: { gte: start30 } } }),
    ])

    const revenue = Number(revenueResult._sum.total ?? 0)
    const prevRevenue = Number(prevRevenueResult._sum.total ?? 0)

    const revenueByChannel = await prisma.order.groupBy({
      by: ['channel'],
      where: { orgId, orderedAt: { gte: start30 }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: { id: true },
    })

    const lowStockItems = await prisma.inventoryItem.findMany({
      where: { orgId, quantity: { lte: prisma.inventoryItem.fields.reorderPoint } },
      include: { product: { select: { name: true, sku: true } } },
      take: 10,
    })

    return reply.send({
      success: true,
      data: {
        revenue: { current: revenue, previous: prevRevenue, change: prevRevenue ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0 },
        orders: { current: orderCount, previous: prevOrderCount, change: prevOrderCount ? ((orderCount - prevOrderCount) / prevOrderCount) * 100 : 0 },
        newCustomers: customerCount,
        revenueByChannel: revenueByChannel.map((r) => ({ channel: r.channel, revenue: Number(r._sum.total ?? 0), orders: r._count.id })),
        lowStock: lowStockItems,
        period: '30d',
      },
    })
  })

  // GET /dashboard/revenue — revenue time series
  app.get('/revenue', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { days = '30' } = req.query as { days?: string }
    const start = subDays(new Date(), parseInt(days))

    const orders = await prisma.order.findMany({
      where: { orgId: req.user.orgId, orderedAt: { gte: start }, status: { not: 'CANCELLED' } },
      select: { total: true, orderedAt: true, channel: true },
      orderBy: { orderedAt: 'asc' },
    })

    return reply.send({ success: true, data: orders })
  })

  // GET /dashboard/kpi-targets
  app.get('/kpi-targets', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const targets = await prisma.kpiTarget.findMany({ where: { orgId: req.user.orgId } })
    return reply.send({ success: true, data: targets })
  })

  // GET /dashboard/list
  app.get('/list', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const dashboards = await prisma.dashboard.findMany({ where: { orgId: req.user.orgId } })
    return reply.send({ success: true, data: dashboards })
  })

  // POST /dashboard
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { name, widgets, layout } = req.body as any
    const dashboard = await prisma.dashboard.create({
      data: { orgId: req.user.orgId, name, widgets: widgets ?? [], layout: layout ?? [], createdBy: req.user.sub },
    })
    return reply.code(201).send({ success: true, data: dashboard })
  })
}
