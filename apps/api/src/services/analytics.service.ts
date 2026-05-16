import { prisma } from '../lib/db'
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns'

export type Period = '7d' | '30d' | '90d' | '12m' | 'ytd' | 'custom'
export type DateRange = { from: Date; to: Date }

export function resolvePeriod(period: Period, from?: string, to?: string): DateRange {
  const now = new Date()
  if (period === 'custom' && from && to) return { from: new Date(from), to: new Date(to) }
  if (period === '7d') return { from: subDays(now, 7), to: now }
  if (period === '30d') return { from: subDays(now, 30), to: now }
  if (period === '90d') return { from: subDays(now, 90), to: now }
  if (period === '12m') return { from: subDays(now, 365), to: now }
  if (period === 'ytd') return { from: startOfYear(now), to: now }
  return { from: subDays(now, 30), to: now }
}

const VALID_STATUSES = { notIn: ['CANCELLED'] as string[] }

export const analyticsService = {
  // ── Revenue Stats ─────────────────────────────────
  async getRevenueStats(orgId: string, range: DateRange) {
    const prev = { from: subDays(range.from, range.to.getTime() - range.from.getTime() > 0 ? Math.round((range.to.getTime() - range.from.getTime()) / 86400000) : 30), to: range.from }

    const [curr, prevR, ordersCount, prevOrders] = await Promise.all([
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: VALID_STATUSES }, _sum: { total: true, cogs: true } }),
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: prev.from, lte: prev.to }, status: VALID_STATUSES }, _sum: { total: true } }),
      prisma.order.count({ where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: VALID_STATUSES } }),
      prisma.order.count({ where: { orgId, orderedAt: { gte: prev.from, lte: prev.to }, status: VALID_STATUSES } }),
    ])

    const revenue = Number(curr._sum.total ?? 0)
    const cogs = Number(curr._sum.cogs ?? 0)
    const prevRevenue = Number(prevR._sum.total ?? 0)
    const grossProfit = revenue - cogs
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const aov = ordersCount > 0 ? revenue / ordersCount : 0
    const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0

    return {
      revenue,
      grossProfit,
      grossMargin,
      orders: ordersCount,
      aov,
      changes: {
        revenue: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null,
        orders: prevOrders > 0 ? ((ordersCount - prevOrders) / prevOrders) * 100 : null,
        aov: prevAov > 0 ? ((aov - prevAov) / prevAov) * 100 : null,
      },
    }
  },

  // ── Revenue Series ────────────────────────────────
  async getRevenueSeries(orgId: string, range: DateRange, granularity: 'day' | 'week' | 'month') {
    const orders = await prisma.order.findMany({
      where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: VALID_STATUSES },
      select: { orderedAt: true, total: true, cogs: true },
    })

    let intervals: Date[]
    let fmt: string
    if (granularity === 'day') { intervals = eachDayOfInterval({ start: range.from, end: range.to }); fmt = 'yyyy-MM-dd' }
    else if (granularity === 'week') { intervals = eachWeekOfInterval({ start: range.from, end: range.to }); fmt = 'yyyy-MM-dd' }
    else { intervals = eachMonthOfInterval({ start: range.from, end: range.to }); fmt = 'yyyy-MM' }

    return intervals.map((d) => {
      const key = format(d, fmt)
      const relevant = orders.filter((o) => format(new Date(o.orderedAt), fmt) === key)
      const revenue = relevant.reduce((s, o) => s + Number(o.total), 0)
      const cogs = relevant.reduce((s, o) => s + Number(o.cogs), 0)
      return { date: key, revenue, profit: revenue - cogs }
    })
  },

  // ── Revenue by Channel ────────────────────────────
  async getRevenueByChannel(orgId: string, range: DateRange) {
    const orders = await prisma.order.groupBy({
      by: ['channel'],
      where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: VALID_STATUSES },
      _sum: { total: true },
      _count: true,
    })
    return orders.map((o) => ({ channel: o.channel, revenue: Number(o._sum.total ?? 0), orders: o._count }))
      .sort((a, b) => b.revenue - a.revenue)
  },

  // ── P&L ───────────────────────────────────────────
  async getPnL(orgId: string, range: DateRange) {
    const [orderAgg, expenses] = await Promise.all([
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: VALID_STATUSES }, _sum: { total: true, cogs: true, tax: true, shipping: true } }),
      prisma.expense.findMany({ where: { orgId, date: { gte: range.from, lte: range.to } } }).catch(() => [] as any[]),
    ])

    const grossRevenue = Number(orderAgg._sum.total ?? 0)
    const cogs = Number(orderAgg._sum.cogs ?? 0)
    const grossProfit = grossRevenue - cogs
    const grossMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0

    const expenseRows = (expenses ?? []).map((e: any) => ({ category: e.category ?? 'Other', amount: Number(e.amount) }))
    const totalExpenses = expenseRows.reduce((s: number, e: any) => s + e.amount, 0)
    const netProfit = grossProfit - totalExpenses
    const netMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0

    return { grossRevenue, cogs, grossProfit, grossMargin, expenses: expenseRows, totalExpenses, netProfit, netMargin }
  },

  // ── Customer Stats ────────────────────────────────
  async getCustomerStats(orgId: string, range: DateRange) {
    const [total, newCustomers, orders] = await Promise.all([
      prisma.customer.count({ where: { orgId } }),
      prisma.customer.count({ where: { orgId, createdAt: { gte: range.from, lte: range.to } } }),
      prisma.order.findMany({ where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: VALID_STATUSES, customerId: { not: null } }, select: { customerId: true, total: true } }),
    ])
    const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0)
    const repeatRate = total > 0 ? (uniqueCustomers / total) * 100 : 0
    return { total, newCustomers, activeCustomers: uniqueCustomers, avgOrderValue: uniqueCustomers > 0 ? revenue / uniqueCustomers : 0, repeatRate }
  },

  // ── Customer Cohorts ──────────────────────────────
  async getCustomerCohorts(orgId: string) {
    const customers = await prisma.customer.findMany({
      where: { orgId },
      select: { id: true, createdAt: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    })
    const cohortMap: Record<string, number> = {}
    customers.forEach((c) => {
      const key = format(new Date(c.createdAt), 'yyyy-MM')
      cohortMap[key] = (cohortMap[key] ?? 0) + 1
    })
    return Object.entries(cohortMap).slice(0, 6).map(([month, count]) => ({ month, count }))
  },

  // ── Inventory Health ──────────────────────────────
  async getInventoryHealth(orgId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { orgId },
      include: { product: { select: { name: true, sku: true } } },
    })
    const total = items.length
    const outOfStock = items.filter((i) => i.quantity === 0).length
    const lowStock = items.filter((i) => i.quantity > 0 && i.reorderPoint !== null && i.quantity <= (i.reorderPoint ?? 0)).length
    const healthy = total - outOfStock - lowStock
    const totalValue = items.reduce((s, i) => s + (i.quantity * Number(i.costPrice ?? 0)), 0)
    const alerts = items
      .filter((i) => i.quantity <= (i.reorderPoint ?? 5))
      .map((i) => ({ id: i.id, sku: i.product.sku, name: i.product.name, quantity: i.quantity, reorderPoint: i.reorderPoint ?? 5, channel: i.channel }))
      .slice(0, 20)
    return { total, outOfStock, lowStock, healthy, totalValue, alerts }
  },

  // ── SKU Performance ───────────────────────────────
  async getSkuPerformance(orgId: string, range: DateRange) {
    const items = await prisma.orderItem.findMany({
      where: { order: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: VALID_STATUSES } },
      select: { sku: true, name: true, quantity: true, total: true, unitCost: true },
    })
    const skuMap: Record<string, { name: string; revenue: number; units: number; cogs: number }> = {}
    items.forEach((i) => {
      if (!skuMap[i.sku]) skuMap[i.sku] = { name: i.name, revenue: 0, units: 0, cogs: 0 }
      skuMap[i.sku].revenue += Number(i.total)
      skuMap[i.sku].units += i.quantity
      skuMap[i.sku].cogs += i.quantity * Number(i.unitCost)
    })
    return Object.entries(skuMap)
      .map(([sku, d]) => ({ sku, ...d, margin: d.revenue > 0 ? ((d.revenue - d.cogs) / d.revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50)
  },

  // ── Anomaly Detection ─────────────────────────────
  async detectAnomalies(orgId: string) {
    const anomalies: { type: string; severity: 'low' | 'medium' | 'high'; message: string }[] = []
    const [today, yesterday, last7, prev7] = await Promise.all([
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }, status: VALID_STATUSES }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: startOfDay(subDays(new Date(), 1)), lte: endOfDay(subDays(new Date(), 1)) }, status: VALID_STATUSES }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: subDays(new Date(), 7), lte: new Date() }, status: VALID_STATUSES }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: subDays(new Date(), 14), lte: subDays(new Date(), 7) }, status: VALID_STATUSES }, _sum: { total: true } }),
    ])
    const todayRev = Number(today._sum.total ?? 0)
    const yestRev = Number(yesterday._sum.total ?? 0)
    if (yestRev > 0 && todayRev < yestRev * 0.3) anomalies.push({ type: 'revenue_drop', severity: 'high', message: `Revenue today is ${((todayRev / yestRev) * 100).toFixed(0)}% of yesterday — possible issue` })
    const last7Rev = Number(last7._sum.total ?? 0)
    const prev7Rev = Number(prev7._sum.total ?? 0)
    if (prev7Rev > 0 && last7Rev < prev7Rev * 0.7) anomalies.push({ type: 'weekly_drop', severity: 'medium', message: `Weekly revenue down ${(((prev7Rev - last7Rev) / prev7Rev) * 100).toFixed(0)}% vs prior week` })
    if (today._count === 0 && new Date().getHours() >= 12) anomalies.push({ type: 'no_orders', severity: 'medium', message: 'No orders received today — check channel connectivity' })
    const lowStockCount = await prisma.inventoryItem.count({ where: { orgId, quantity: { lte: 5 } } })
    if (lowStockCount > 0) anomalies.push({ type: 'low_stock', severity: lowStockCount > 5 ? 'high' : 'low', message: `${lowStockCount} SKU${lowStockCount > 1 ? 's' : ''} critically low on stock` })
    return anomalies
  },

  // ── AI Context ────────────────────────────────────
  async getAiContext(orgId: string) {
    const now = new Date()
    const [rev30, prevRev30, orders30, totalCustomers, channels, lowStock] = await Promise.all([
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: subDays(now, 30) }, status: VALID_STATUSES }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: subDays(now, 60), lte: subDays(now, 30) }, status: VALID_STATUSES }, _sum: { total: true } }),
      prisma.order.count({ where: { orgId, orderedAt: { gte: subDays(now, 30) }, status: VALID_STATUSES } }),
      prisma.customer.count({ where: { orgId } }),
      prisma.order.groupBy({ by: ['channel'], where: { orgId, orderedAt: { gte: subDays(now, 30) }, status: VALID_STATUSES }, _sum: { total: true }, orderBy: { _sum: { total: 'desc' } }, take: 1 }),
      prisma.inventoryItem.count({ where: { orgId, quantity: { lte: 5 } } }),
    ])
    const topChannel = channels[0]?.channel ?? null
    const channelBreakdown = channels.map((c) => `${c.channel}: $${Number(c._sum.total ?? 0).toFixed(0)}`).join(', ')
    return { revenue30d: Number(rev30._sum.total ?? 0), prevRevenue30d: Number(prevRev30._sum.total ?? 0), orders30d: orders30, totalCustomers, topChannel, channelBreakdown, lowStockItems: lowStock }
  },
}
