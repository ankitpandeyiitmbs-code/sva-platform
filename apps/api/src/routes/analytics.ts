import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'
import { analyticsService, resolvePeriod, type Period } from '../services/analytics.service'
import { randomBytes } from 'crypto'

export async function analyticsRoutes(app: FastifyInstance) {
  // ── Revenue stats + P&L ───────────────────────────────
  app.get('/revenue', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { period = '30d', from, to } = req.query as any
    const range = resolvePeriod(period as Period, from, to)
    const [stats, series, byChannel, pnl] = await Promise.all([
      analyticsService.getRevenueStats(req.user.orgId, range),
      analyticsService.getRevenueSeries(req.user.orgId, range, period === '12m' || period === 'ytd' ? 'month' : period === '90d' ? 'week' : 'day'),
      analyticsService.getRevenueByChannel(req.user.orgId, range),
      analyticsService.getPnL(req.user.orgId, range),
    ])
    return reply.send({ success: true, data: { stats, series, byChannel, pnl, period, range } })
  })

  // ── Customer analytics ────────────────────────────────
  app.get('/customers', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { period = '30d', from, to } = req.query as any
    const range = resolvePeriod(period as Period, from, to)
    const [stats, cohorts] = await Promise.all([
      analyticsService.getCustomerStats(req.user.orgId, range),
      analyticsService.getCustomerCohorts(req.user.orgId),
    ])
    return reply.send({ success: true, data: { stats, cohorts } })
  })

  // ── Inventory health ──────────────────────────────────
  app.get('/inventory', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const health = await analyticsService.getInventoryHealth(req.user.orgId)
    return reply.send({ success: true, data: health })
  })

  // ── SKU performance ───────────────────────────────────
  app.get('/skus', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { period = '30d', from, to } = req.query as any
    const range = resolvePeriod(period as Period, from, to)
    const skus = await analyticsService.getSkuPerformance(req.user.orgId, range)
    return reply.send({ success: true, data: skus })
  })

  // ── Anomaly detection ─────────────────────────────────
  app.get('/anomalies', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const anomalies = await analyticsService.detectAnomalies(req.user.orgId)
    return reply.send({ success: true, data: anomalies })
  })

  // ── Goals / KPI targets ───────────────────────────────
  app.get('/goals', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const goals = await prisma.kpiTarget.findMany({
      where: { orgId: req.user.orgId },
      orderBy: { periodStart: 'desc' },
    })
    // Enrich with actuals
    const enriched = await Promise.all(goals.map(async (g) => {
      let actual = 0
      if (g.metric === 'revenue') {
        const res = await prisma.order.aggregate({ where: { orgId: req.user!.orgId, orderedAt: { gte: g.periodStart, lte: g.periodEnd }, status: { notIn: ['CANCELLED'] } }, _sum: { total: true } })
        actual = Number(res._sum.total ?? 0)
      } else if (g.metric === 'orders') {
        actual = await prisma.order.count({ where: { orgId: req.user!.orgId, orderedAt: { gte: g.periodStart, lte: g.periodEnd }, status: { notIn: ['CANCELLED'] } } })
      } else if (g.metric === 'customers') {
        actual = await prisma.customer.count({ where: { orgId: req.user!.orgId, createdAt: { gte: g.periodStart, lte: g.periodEnd } } })
      } else {
        actual = Number(g.actual)
      }
      const progress = Number(g.target) > 0 ? (actual / Number(g.target)) * 100 : 0
      return { ...g, target: Number(g.target), actual, progress: Math.min(progress, 100) }
    }))
    return reply.send({ success: true, data: enriched })
  })

  app.post('/goals', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const goal = await prisma.kpiTarget.create({ data: { ...(req.body as any), orgId: req.user.orgId } })
    return reply.code(201).send({ success: true, data: goal })
  })

  app.patch('/goals/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const goal = await prisma.kpiTarget.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: goal })
  })

  app.delete('/goals/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.kpiTarget.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Scheduled reports ─────────────────────────────────
  app.get('/reports', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const reports = await prisma.scheduledReport.findMany({ where: { orgId: req.user.orgId }, orderBy: { createdAt: 'desc' } })
    return reply.send({ success: true, data: reports })
  })

  app.post('/reports', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const report = await prisma.scheduledReport.create({ data: { ...(req.body as any), orgId: req.user.orgId, createdBy: req.user.sub } })
    return reply.code(201).send({ success: true, data: report })
  })

  app.patch('/reports/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const report = await prisma.scheduledReport.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: report })
  })

  app.delete('/reports/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.scheduledReport.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Shareable dashboard ───────────────────────────────
  app.post('/dashboards/:id/share', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const token = randomBytes(24).toString('hex')
    const dashboard = await prisma.dashboard.update({
      where: { id },
      data: { isPublic: true, shareToken: token },
    })
    return reply.send({ success: true, data: { shareToken: token, url: `/shared/${token}` } })
  })

  app.delete('/dashboards/:id/share', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.dashboard.update({ where: { id }, data: { isPublic: false, shareToken: null } })
    return reply.send({ success: true })
  })

  // ── Public shared dashboard (no auth) ─────────────────
  app.get('/shared/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    const dashboard = await prisma.dashboard.findUnique({ where: { shareToken: token } })
    if (!dashboard || !dashboard.isPublic) return reply.code(404).send({ success: false })
    // Return limited public data
    const range = resolvePeriod('30d')
    const [stats, series, byChannel] = await Promise.all([
      analyticsService.getRevenueStats(dashboard.orgId, range),
      analyticsService.getRevenueSeries(dashboard.orgId, range, 'day'),
      analyticsService.getRevenueByChannel(dashboard.orgId, range),
    ])
    return reply.send({ success: true, data: { dashboard: { name: dashboard.name, widgets: dashboard.widgets }, stats, series, byChannel } })
  })

  // ── AI insights ───────────────────────────────────────
  app.post('/insights', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { question } = req.body as { question?: string }
    const ctx = await analyticsService.getAiContext(req.user.orgId)
    const anomalies = await analyticsService.detectAnomalies(req.user.orgId)

    const { env } = await import('../utils/env')
    if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY.startsWith('REPLACE_')) {
      const autoInsights = []
      const revenueChange = ctx.prevRevenue30d > 0 ? ((ctx.revenue30d - ctx.prevRevenue30d) / ctx.prevRevenue30d) * 100 : 0
      if (revenueChange < -10) autoInsights.push(`Revenue is down ${Math.abs(revenueChange).toFixed(1)}% vs the previous 30 days. Review channel performance in the Revenue Breakdown tab.`)
      else if (revenueChange > 10) autoInsights.push(`Revenue is up ${revenueChange.toFixed(1)}% vs the previous 30 days — strong growth momentum.`)
      if (ctx.lowStockItems > 0) autoInsights.push(`${ctx.lowStockItems} SKU${ctx.lowStockItems > 1 ? 's are' : ' is'} at or below reorder point. Create purchase orders to avoid stockouts.`)
      if (ctx.topChannel) autoInsights.push(`${ctx.topChannel} is your top-performing channel this period with $${ctx.revenue30d.toLocaleString()} in revenue.`)
      return reply.send({ success: true, data: { insights: autoInsights.length ? autoInsights : ['Connect your sales channels and add orders to see AI-powered insights.'], source: 'rule-based' } })
    }

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
      const prompt = question
        ? `Business context:\n- Revenue (30d): $${ctx.revenue30d.toFixed(0)} (${ctx.prevRevenue30d > 0 ? ((ctx.revenue30d - ctx.prevRevenue30d) / ctx.prevRevenue30d * 100).toFixed(1) : 0}% vs prev)\n- Orders (30d): ${ctx.orders30d}\n- Total customers: ${ctx.totalCustomers}\n- Top channel: ${ctx.topChannel}\n- Channel breakdown: ${ctx.channelBreakdown}\n- Anomalies: ${anomalies.map(a => a.message).join('; ') || 'None detected'}\n\nQuestion: ${question}`
        : `Analyze this e-commerce business data and provide 3-5 concise, actionable insights:\n- Revenue (30d): $${ctx.revenue30d.toFixed(0)} (${ctx.prevRevenue30d > 0 ? ((ctx.revenue30d - ctx.prevRevenue30d) / ctx.prevRevenue30d * 100).toFixed(1) : 0}% vs prev period)\n- Orders: ${ctx.orders30d}, Avg Order Value: $${ctx.orders30d > 0 ? (ctx.revenue30d / ctx.orders30d).toFixed(0) : 0}\n- Customers: ${ctx.totalCustomers} total\n- Top channel: ${ctx.topChannel}\n- Low stock items: ${ctx.lowStockItems}\n- Anomalies: ${anomalies.map(a => a.message).join('; ') || 'None'}\n\nBusiness: SVA Organics (Essential Oils, Carrier Oils, Roll-On Hair Oils). Keep insights concise and actionable.`

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      const insights = text.split('\n').filter((l) => l.trim().length > 10)
      return reply.send({ success: true, data: { insights, source: 'ai' } })
    } catch (err: any) {
      return reply.code(500).send({ success: false, message: err.message })
    }
  })
}
