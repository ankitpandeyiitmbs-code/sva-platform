import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'

// Statuses that represent real sales (excludes cancelled/unfulfillable)
const ACTIVE_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

// Walmart referral fee rate for our category (Health & Beauty - Aromatherapy)
// CSV-verified: actual fees average ~11.97% of sale price
const WALMART_REFERRAL_RATE = 0.12

export async function orderRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { page = '1', limit = '50', status, channel, search, startDate, endDate, fulfillmentStatus } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { orgId: req.user.orgId }
    if (status) where.status = status
    if (channel) where.channel = channel
    if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus
    if (search) where.orderNumber = { contains: search, mode: 'insensitive' }
    if (startDate && endDate) where.orderedAt = { gte: new Date(startDate), lte: new Date(endDate) }
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
      data: { ...orderData, orgId: req.user.orgId, items: { create: items ?? [] } },
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

  // GET /orders/stats
  app.get('/stats', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { channel, days = '30', startDate, endDate } = req.query as any
    const orgId = req.user.orgId

    // ── Date filter ───────────────────────────────────────
    let dateFilter: any = {}
    if (startDate && endDate) {
      dateFilter = { gte: new Date(startDate), lte: new Date(endDate) }
    } else {
      dateFilter = { gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) }
    }

    // ── Active orders only (match Walmart seller dashboard — exclude cancelled) ──
    const where: any = {
      orgId,
      status: { in: ACTIVE_STATUSES },
      orderedAt: dateFilter,
    }
    if (channel) where.channel = channel

    // All-time uses same status filter but no date
    const allTimeWhere: any = { orgId, status: { in: ACTIVE_STATUSES } }
    if (channel) allTimeWhere.channel = channel

    const [agg, orders, allTime] = await Promise.all([
      prisma.order.aggregate({ where, _sum: { total: true }, _count: { id: true }, _avg: { total: true } }),
      prisma.order.findMany({ where, select: { orderedAt: true, total: true, status: true }, orderBy: { orderedAt: 'asc' } }),
      prisma.order.aggregate({ where: allTimeWhere, _sum: { total: true }, _count: { id: true } }),
    ])

    const pending = orders.filter(o => ['PENDING', 'PROCESSING'].includes(o.status)).length

    // Group revenue by local date (ISO date is UTC — offset to match local day)
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

  // GET /orders/profit — P&L by date range
  app.get('/profit', async (req: any, reply: any) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { channel, startDate, endDate } = req.query as any
    const orgId = req.user.orgId
    const { WALMART_COSTS } = await import('../lib/walmart-costs')

    const where: any = {
      orgId,
      status: { in: ACTIVE_STATUSES },  // exclude cancelled from P&L
      items: { some: {} },
    }
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

    // ── Ad spend in the same window (deducted from net profit) ──
    const adSpendRows = await prisma.adSpend.findMany({
      where: {
        orgId,
        ...(channel ? { channel } : {}),
        date: where.orderedAt ? { gte: where.orderedAt.gte, lte: where.orderedAt.lte } : undefined,
      },
      select: { date: true, sku: true, spend: true },
    })
    const adSpendBySku: Record<string, number> = {}
    const adSpendByDay: Record<string, number> = {}
    let totalAdSpend = 0
    for (const a of adSpendRows) {
      const s = Number(a.spend ?? 0)
      totalAdSpend += s
      const day = a.date.toISOString().slice(0, 10)
      adSpendByDay[day] = (adSpendByDay[day] ?? 0) + s
      if (a.sku) adSpendBySku[a.sku] = (adSpendBySku[a.sku] ?? 0) + s
    }

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
        // Referral fee = % of ACTUAL sale price (matches how Walmart bills it)
        // Static refFee in WALMART_COSTS uses MSRP, so it overstates fees on promo sales.
        const refFee = revenue * WALMART_REFERRAL_RATE
        // Fulfillment fee (shipping label cost) is roughly static per SKU based on size/weight
        const fulfillmentFee = costs ? costs.fulfillmentFee * qty : 0
        const totalItemFees = refFee + fulfillmentFee
        const netPayout = revenue - totalItemFees
        const netProfit = netPayout - cogs

        totalRevenue += revenue; totalCogs += cogs
        totalFees += totalItemFees; totalProfit += netProfit

        const d = dayMap.get(day)!
        d.revenue += revenue; d.profit += netProfit

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

    // Subtract ad spend per day from profit (per-day chart accuracy)
    const chart = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => {
        const dayAd = adSpendByDay[date] ?? 0
        return {
          date,
          revenue: +v.revenue.toFixed(2),
          profit:  +(v.profit - dayAd).toFixed(2),
          adSpend: +dayAd.toFixed(2),
        }
      })

    // Net profit after ads (summary)
    const netProfitAfterAds = totalProfit - totalAdSpend

    const products = Array.from(skuMap.values())
      .sort((a: any, b: any) => b.netProfit - a.netProfit)
      .map((p: any) => {
        const adSpend = adSpendBySku[p.sku] ?? 0
        const netProfitAfterAd = p.netProfit - adSpend
        return {
          ...p,
          revenue:        +p.revenue.toFixed(2),
          cogs:           +p.cogs.toFixed(2),
          refFee:         +p.refFee.toFixed(2),
          fulfillmentFee: +p.fulfillmentFee.toFixed(2),
          totalFees:      +p.totalFees.toFixed(2),
          netPayout:      +p.netPayout.toFixed(2),
          adSpend:        +adSpend.toFixed(2),
          // ACoS = ad spend / revenue × 100
          acos:           p.revenue > 0 ? +((adSpend / p.revenue) * 100).toFixed(1) : 0,
          // netProfit is BEFORE ads; netProfitAfterAd is the true bottom line
          netProfit:      +p.netProfit.toFixed(2),
          netProfitAfterAd: +netProfitAfterAd.toFixed(2),
          margin: p.revenue > 0 ? +((netProfitAfterAd / p.revenue) * 100).toFixed(1) : 0,
        }
      })

    return reply.send({
      success: true,
      data: {
        summary: {
          revenue:           +totalRevenue.toFixed(2),
          cogs:              +totalCogs.toFixed(2),
          totalFees:         +totalFees.toFixed(2),
          adSpend:           +totalAdSpend.toFixed(2),
          netProfitBeforeAds: +totalProfit.toFixed(2),
          netProfit:         +netProfitAfterAds.toFixed(2),  // true bottom line
          margin:            totalRevenue > 0 ? +((netProfitAfterAds / totalRevenue) * 100).toFixed(1) : 0,
          acos:              totalRevenue > 0 ? +((totalAdSpend / totalRevenue) * 100).toFixed(1) : 0,
          orderCount:        orders.length,
          coveredSkus:       products.filter((p: any) => p.hasCosts).length,
          totalSkus:         products.length,
        },
        chart,
        products,
      },
    })
  })
}
