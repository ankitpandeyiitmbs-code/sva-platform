import { prisma } from '../lib/db'
import { subDays, subMonths, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, format } from 'date-fns'

export type Period = '7d' | '30d' | '90d' | '12m' | 'mtd' | 'ytd' | 'custom'

export interface DateRange { from: Date; to: Date }

export function resolvePeriod(period: Period, from?: string, to?: string): DateRange {
  const now = new Date()
  switch (period) {
    case '7d':  return { from: subDays(now, 7), to: now }
    case '30d': return { from: subDays(now, 30), to: now }
    case '90d': return { from: subDays(now, 90), to: now }
    case '12m': return { from: subMonths(now, 12), to: now }
    case 'mtd': return { from: startOfMonth(now), to: now }
    case 'ytd': return { from: startOfYear(now), to: now }
    case 'custom': return { from: new Date(from!), to: new Date(to!) }
  }
}

export function previousPeriod(range: DateRange): DateRange {
  const diff = range.to.getTime() - range.from.getTime()
  return { from: new Date(range.from.getTime() - diff), to: new Date(range.from.getTime()) }
}

export class AnalyticsService {
  // ── Revenue & Orders ──────────────────────────────────
  async getRevenueStats(orgId: string, range: DateRange) {
    const prev = previousPeriod(range)

    const [current, previous] = await Promise.all([
      prisma.order.aggregate({
        where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: { notIn: ['CANCELLED'] } },
        _sum: { total: true, cogs: true },
        _count: { id: true },
        _avg: { total: true },
      }),
      prisma.order.aggregate({
        where: { orgId, orderedAt: { gte: prev.from, lte: prev.to }, status: { notIn: ['CANCELLED'] } },
        _sum: { total: true, cogs: true },
        _count: { id: true },
        _avg: { total: true },
      }),
    ])

    const revenue = Number(current._sum.total ?? 0)
    const cogs = Number(current._sum.cogs ?? 0)
    const prevRevenue = Number(previous._sum.total ?? 0)
    const prevOrders = previous._count.id

    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      grossMargin: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
      orders: current._count.id,
      aov: Number(current._avg.total ?? 0),
      changes: {
        revenue: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
        orders: prevOrders > 0 ? ((current._count.id - prevOrders) / prevOrders) * 100 : 0,
        aov: Number(previous._avg.total ?? 0) > 0
          ? ((Number(current._avg.total ?? 0) - Number(previous._avg.total ?? 0)) / Number(previous._avg.total ?? 0)) * 100
          : 0,
      },
    }
  }

  // ── Revenue Time Series ───────────────────────────────
  async getRevenueSeries(orgId: string, range: DateRange, granularity: 'day' | 'week' | 'month' = 'day') {
    const orders = await prisma.order.findMany({
      where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: { notIn: ['CANCELLED'] } },
      select: { total: true, cogs: true, orderedAt: true, channel: true },
      orderBy: { orderedAt: 'asc' },
    })

    // Bucket into time periods
    const buckets: Map<string, { date: string; revenue: number; orders: number; profit: number }> = new Map()

    let intervals: Date[]
    if (granularity === 'day') {
      intervals = eachDayOfInterval(range)
    } else if (granularity === 'week') {
      intervals = eachWeekOfInterval(range)
    } else {
      intervals = eachMonthOfInterval(range)
    }

    const fmt = granularity === 'day' ? 'yyyy-MM-dd' : granularity === 'week' ? 'yyyy-ww' : 'yyyy-MM'
    intervals.forEach((d) => buckets.set(format(d, fmt), { date: format(d, fmt), revenue: 0, orders: 0, profit: 0 }))

    orders.forEach((o) => {
      const key = format(new Date(o.orderedAt), fmt)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.revenue += Number(o.total)
        bucket.orders += 1
        bucket.profit += Number(o.total) - Number(o.cogs)
      }
    })

    return Array.from(buckets.values())
  }

  // ── Revenue by Channel ────────────────────────────────
  async getRevenueByChannel(orgId: string, range: DateRange) {
    const result = await prisma.order.groupBy({
      by: ['channel'],
      where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: { notIn: ['CANCELLED'] } },
      _sum: { total: true, cogs: true },
      _count: { id: true },
      _avg: { total: true },
    })

    return result.map((r) => ({
      channel: r.channel,
      revenue: Number(r._sum.total ?? 0),
      cogs: Number(r._sum.cogs ?? 0),
      profit: Number(r._sum.total ?? 0) - Number(r._sum.cogs ?? 0),
      orders: r._count.id,
      aov: Number(r._avg.total ?? 0),
    })).sort((a, b) => b.revenue - a.revenue)
  }

  // ── Customer Analytics ────────────────────────────────
  async getCustomerStats(orgId: string, range: DateRange) {
    const prev = previousPeriod(range)

    const [newCurrent, newPrev, returning, totalLTV] = await Promise.all([
      prisma.customer.count({ where: { orgId, createdAt: { gte: range.from, lte: range.to } } }),
      prisma.customer.count({ where: { orgId, createdAt: { gte: prev.from, lte: prev.to } } }),
      prisma.customer.count({ where: { orgId, totalOrders: { gte: 2 }, lastOrderAt: { gte: range.from, lte: range.to } } }),
      prisma.customer.aggregate({ where: { orgId }, _sum: { ltv: true }, _avg: { ltv: true } }),
    ])

    // Top customers by LTV
    const topCustomers = await prisma.customer.findMany({
      where: { orgId },
      orderBy: { ltv: 'desc' },
      take: 10,
      select: { id: true, firstName: true, lastName: true, email: true, ltv: true, totalOrders: true, country: true },
    })

    // Geographic distribution
    const byCountry = await prisma.customer.groupBy({
      by: ['country'],
      where: { orgId, country: { not: null } },
      _count: { id: true },
      _sum: { ltv: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    })

    // Repeat purchase rate
    const totalOrdered = await prisma.customer.count({ where: { orgId, totalOrders: { gte: 1 } } })
    const repeatPurchase = totalOrdered > 0 ? (returning / totalOrdered) * 100 : 0

    return {
      newCustomers: { current: newCurrent, previous: newPrev, change: newPrev > 0 ? ((newCurrent - newPrev) / newPrev) * 100 : 0 },
      returningCustomers: returning,
      repeatPurchaseRate: repeatPurchase,
      totalLTV: Number(totalLTV._sum.ltv ?? 0),
      avgLTV: Number(totalLTV._avg.ltv ?? 0),
      topCustomers: topCustomers.map((c) => ({ ...c, ltv: Number(c.ltv) })),
      byCountry: byCountry.map((c) => ({ country: c.country ?? 'Unknown', customers: c._count.id, ltv: Number(c._sum.ltv ?? 0) })),
    }
  }

  // ── Customer Cohort (monthly) ─────────────────────────
  async getCustomerCohorts(orgId: string) {
    const sixMonthsAgo = subMonths(new Date(), 6)
    const customers = await prisma.customer.findMany({
      where: { orgId, createdAt: { gte: sixMonthsAgo } },
      select: { id: true, createdAt: true, totalOrders: true, ltv: true },
    })

    const cohorts: Map<string, { cohort: string; size: number; retained: number; revenue: number }> = new Map()
    customers.forEach((c) => {
      const key = format(new Date(c.createdAt), 'yyyy-MM')
      const bucket = cohorts.get(key) ?? { cohort: key, size: 0, retained: 0, revenue: 0 }
      bucket.size++
      if (c.totalOrders >= 2) bucket.retained++
      bucket.revenue += Number(c.ltv)
      cohorts.set(key, bucket)
    })

    return Array.from(cohorts.values())
      .sort((a, b) => a.cohort.localeCompare(b.cohort))
      .map((c) => ({ ...c, retentionRate: c.size > 0 ? (c.retained / c.size) * 100 : 0 }))
  }

  // ── Inventory Health ──────────────────────────────────
  async getInventoryHealth(orgId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { orgId },
      include: { product: { select: { name: true, sku: true, category: true } }, warehouse: { select: { name: true, type: true } } },
    })

    // Days of inventory calculation (based on last 30d sales velocity)
    const thirtyDaysAgo = subDays(new Date(), 30)
    const salesVelocity = await prisma.orderItem.groupBy({
      by: ['sku'],
      where: { order: { orgId, orderedAt: { gte: thirtyDaysAgo }, status: { notIn: ['CANCELLED'] } } },
      _sum: { quantity: true },
    })
    const velocityMap = new Map(salesVelocity.map((v) => [v.sku, (v._sum.quantity ?? 0) / 30]))

    const enriched = items.map((item) => {
      const dailySales = velocityMap.get(item.product.sku) ?? 0
      const daysOfInventory = dailySales > 0 ? Math.floor(item.quantity / dailySales) : null
      return {
        ...item,
        dailySales,
        daysOfInventory,
        status: item.quantity === 0
          ? 'OUT_OF_STOCK'
          : item.quantity <= item.reorderPoint
          ? 'LOW_STOCK'
          : daysOfInventory !== null && daysOfInventory > 180
          ? 'OVERSTOCKED'
          : 'HEALTHY',
      }
    })

    const summary = {
      total: enriched.length,
      outOfStock: enriched.filter((i) => i.status === 'OUT_OF_STOCK').length,
      lowStock: enriched.filter((i) => i.status === 'LOW_STOCK').length,
      overstocked: enriched.filter((i) => i.status === 'OVERSTOCKED').length,
      healthy: enriched.filter((i) => i.status === 'HEALTHY').length,
    }

    return { items: enriched, summary }
  }

  // ── SKU Performance ───────────────────────────────────
  async getSkuPerformance(orgId: string, range: DateRange) {
    const items = await prisma.orderItem.groupBy({
      by: ['sku', 'name'],
      where: { order: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: { notIn: ['CANCELLED'] } } },
      _sum: { quantity: true, total: true, unitCost: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 50,
    })

    return items.map((i) => ({
      sku: i.sku,
      name: i.name,
      unitsSold: i._sum.quantity ?? 0,
      revenue: Number(i._sum.total ?? 0),
      cogs: Number(i._sum.unitCost ?? 0) * (i._sum.quantity ?? 0),
      orders: i._count.id,
      profit: Number(i._sum.total ?? 0) - Number(i._sum.unitCost ?? 0) * (i._sum.quantity ?? 0),
    }))
  }

  // ── Real-time P&L ─────────────────────────────────────
  async getPnL(orgId: string, range: DateRange) {
    const [revenue, expenses] = await Promise.all([
      prisma.order.aggregate({
        where: { orgId, orderedAt: { gte: range.from, lte: range.to }, status: { notIn: ['CANCELLED'] } },
        _sum: { total: true, cogs: true, shipping: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: { orgId, date: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
    ])

    const grossRevenue = Number(revenue._sum.total ?? 0)
    const cogs = Number(revenue._sum.cogs ?? 0)
    const grossProfit = grossRevenue - cogs
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e._sum.amount ?? 0), 0)
    const netProfit = grossProfit - totalExpenses

    return {
      grossRevenue,
      cogs,
      grossProfit,
      grossMargin: grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0,
      expenses: expenses.map((e) => ({ category: e.category, amount: Number(e._sum.amount ?? 0) })),
      totalExpenses,
      netProfit,
      netMargin: grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0,
    }
  }

  // ── Anomaly Detection ─────────────────────────────────
  async detectAnomalies(orgId: string) {
    const anomalies: Array<{ metric: string; severity: 'warning' | 'critical'; message: string; value: number; expected: number; change: number }> = []
    const now = new Date()

    // Compare today vs same day last week for each channel
    const today = { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) }
    const lastWeekSameDay = { from: startOfDay(subDays(now, 8)), to: endOfDay(subDays(now, 8)) }

    const [todayRevenue, lastWeekRevenue] = await Promise.all([
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: today.from, lte: today.to }, status: { notIn: ['CANCELLED'] } }, _sum: { total: true }, _count: { id: true } }),
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: lastWeekSameDay.from, lte: lastWeekSameDay.to }, status: { notIn: ['CANCELLED'] } }, _sum: { total: true }, _count: { id: true } }),
    ])

    const todayRev = Number(todayRevenue._sum.total ?? 0)
    const lastWeekRev = Number(lastWeekRevenue._sum.total ?? 0)

    if (lastWeekRev > 0) {
      const change = ((todayRev - lastWeekRev) / lastWeekRev) * 100
      if (change < -30) {
        anomalies.push({ metric: 'Daily Revenue', severity: 'critical', message: `Revenue dropped ${Math.abs(change).toFixed(1)}% vs same day last week`, value: todayRev, expected: lastWeekRev, change })
      } else if (change < -15) {
        anomalies.push({ metric: 'Daily Revenue', severity: 'warning', message: `Revenue down ${Math.abs(change).toFixed(1)}% vs same day last week`, value: todayRev, expected: lastWeekRev, change })
      } else if (change > 50) {
        anomalies.push({ metric: 'Daily Revenue', severity: 'warning', message: `Revenue spike: +${change.toFixed(1)}% vs same day last week`, value: todayRev, expected: lastWeekRev, change })
      }
    }

    // Returns spike
    const recentReturns = await prisma.return.count({ where: { order: { orgId }, createdAt: { gte: subDays(now, 7) } } })
    const prevReturns = await prisma.return.count({ where: { order: { orgId }, createdAt: { gte: subDays(now, 14), lt: subDays(now, 7) } } })
    if (prevReturns > 0 && recentReturns / prevReturns > 1.5) {
      anomalies.push({ metric: 'Return Rate', severity: 'warning', message: `Returns up ${((recentReturns / prevReturns - 1) * 100).toFixed(0)}% this week`, value: recentReturns, expected: prevReturns, change: ((recentReturns - prevReturns) / prevReturns) * 100 })
    }

    // Low stock items
    const criticalStock = await prisma.inventoryItem.count({ where: { orgId, quantity: { lte: 5, gt: 0 } } })
    const outOfStock = await prisma.inventoryItem.count({ where: { orgId, quantity: 0 } })
    if (outOfStock > 0) anomalies.push({ metric: 'Out of Stock', severity: 'critical', message: `${outOfStock} SKU${outOfStock > 1 ? 's' : ''} are completely out of stock`, value: outOfStock, expected: 0, change: 100 })
    if (criticalStock > 0) anomalies.push({ metric: 'Critical Stock', severity: 'warning', message: `${criticalStock} SKU${criticalStock > 1 ? 's' : ''} have ≤5 units remaining`, value: criticalStock, expected: 0, change: 100 })

    return anomalies
  }

  // ── KPI Snapshot for AI context ───────────────────────
  async getAiContext(orgId: string) {
    const range = resolvePeriod('30d')
    const prev = previousPeriod(range)

    const [revenue, prevRevenue, customers, inventory, channels] = await Promise.all([
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: range.from }, status: { notIn: ['CANCELLED'] } }, _sum: { total: true }, _count: { id: true } }),
      prisma.order.aggregate({ where: { orgId, orderedAt: { gte: prev.from, lte: prev.to }, status: { notIn: ['CANCELLED'] } }, _sum: { total: true } }),
      prisma.customer.count({ where: { orgId } }),
      prisma.inventoryItem.count({ where: { orgId, quantity: { lte: prisma.inventoryItem.fields.reorderPoint } } }),
      prisma.order.groupBy({ by: ['channel'], where: { orgId, orderedAt: { gte: range.from } }, _sum: { total: true }, orderBy: { _sum: { total: 'desc' } } }),
    ])

    return {
      revenue30d: Number(revenue._sum.total ?? 0),
      prevRevenue30d: Number(prevRevenue._sum.total ?? 0),
      orders30d: revenue._count.id,
      totalCustomers: customers,
      lowStockItems: inventory,
      topChannel: channels[0]?.channel ?? 'N/A',
      channelBreakdown: channels.map((c) => `${c.channel}: $${Number(c._sum.total ?? 0).toFixed(0)}`).join(', '),
    }
  }
}

export const analyticsService = new AnalyticsService()

