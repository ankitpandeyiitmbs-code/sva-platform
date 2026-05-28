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

    // Support custom date range (startDate/endDate) OR days-based range
    const { startDate, endDate } = req.query as any
    let where: any = { orgId }
    if (channel) where.channel = channel
    if (startDate && endDate) {
      where.orderedAt = { gte: new Date(startDate), lte: new Date(endDate) }
    } else {
      where.orderedAt = { gte: since }
    }

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
    const totalUnits = items.reduce((s, i) => s + i.quantity, 0)
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

  // GET /orders/profit — P&L by date range for a channel
  app.get('/profit', async (req: any, reply: any) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { channel, startDate, endDate } = req.query as any
    const orgId = req.user.orgId
    const { WALMART_COSTS } = await import('../lib/walmart-costs')

    const where: any = { orgId, items: { some: {} } }
    if (channel) where.channel = channel
    if (startDate && endDate) {
      where.orderedAt = { gte: new Date(startDate), lte: new Date(endDate) }
    } else {
      const since = new Date(); since.setDate(since.getDate() - 30)
      where.orderedAt = { gte: since }
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: { select: { sku: true, quantity: true, unitPrice: true, total: true } } },
    })

    const skuMap = new Map<string, any>()
    let totalRevenue = 0, totalCogs = 0, totalFees = 0, totalProfit = 0
    const dayMap = new Map<string, { revenue: number; profit: number }>()

    for (const order of orders) {
      const day = order.orderedAt.toISOString().slice(0, 10)
      if (!dayMap.has(day)) dayMap.set(day, { revenue: 0, profit: 0 })

      for (const item of order.items) {
        const costs = WALMART_COSTS[item.sku]
        const qty = item.quantity
        const revenue = Number(item.total)
        const cogs = costs ? costs.cogs * qty : 0
        const refFee = costs ? costs.refFee * qty : 0
        const fulfillmentFee = costs ? costs.fulfillmentFee * qty : 0
        const totalItemFees = costs ? costs.totalFees * qty : 0
        const netPayout = revenue - totalItemFees
        const netProfit = netPayout - cogs

        totalRevenue += revenue
        totalCogs += cogs
        totalFees += totalItemFees
        totalProfit += netProfit

        const d = dayMap.get(day)!
        d.revenue += revenue
        d.profit += netProfit

        const existing = skuMap.get(item.sku)
        if (!existing) {
          skuMap.set(item.sku, { sku: item.sku, units: qty, revenue, cogs, refFee, fulfillmentFee, totalFees: totalItemFees, netPayout, netProfit, hasCosts: !!costs })
        } else {
          existing.units += qty; existing.revenue += revenue; existing.cogs += cogs
          existing.refFee += refFee; existing.fulfillmentFee += fulfillmentFee
          existing.totalFees += totalItemFees; existing.netPayout += netPayout; existing.netProfit += netProfit
        }
      }
    }

    const chart = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, revenue: +v.revenue.toFixed(2), profit: +v.profit.toFixed(2) }))

    const products = Array.from(skuMap.values())
      .sort((a: any, b: any) => b.netProfit - a.netProfit)
      .map((p: any) => ({
        ...p,
        revenue: +p.revenue.toFixed(2), cogs: +p.cogs.toFixed(2),
        refFee: +p.refFee.toFixed(2), fulfillmentFee: +p.fulfillmentFee.toFixed(2),
        totalFees: +p.totalFees.toFixed(2), netPayout: +p.netPayout.toFixed(2),
        netProfit: +p.netProfit.toFixed(2),
        margin: p.revenue > 0 ? +((p.netProfit / p.revenue) * 100).toFixed(1) : 0,
      }))

    return reply.send({
      success: true,
      data: {
        summary: {
          revenue: +totalRevenue.toFixed(2), cogs: +totalCogs.toFixed(2),
          totalFees: +totalFees.toFixed(2), netProfit: +totalProfit.toFixed(2),
          margin: totalRevenue > 0 ? +((totalProfit / totalRevenue) * 100).toFixed(1) : 0,
          orderCount: orders.length,
          coveredSkus: products.filter((p: any) => p.hasCosts).length,
          totalSkus: products.length,
        },
        chart,
        products,
      },
    })
  })

}
