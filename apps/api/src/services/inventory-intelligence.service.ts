/**
 * Inventory Intelligence Engine
 *
 * Implements professional Amazon FBA inventory management logic used by top sellers:
 *
 * 1. ADU  — Average Daily Units (velocity-based, last 30 days)
 * 2. Safety Stock — Z-score × √LeadTime × StdDev(daily sales)
 * 3. Reorder Point — (ADU × LeadTime) + SafetyStock
 * 4. Recommended Order Qty — targets 45-day DOI (sweet spot for FBA to avoid long-term storage fees)
 * 5. ABC Classification — A (top 80% revenue), B (next 15%), C (bottom 5%)
 * 6. Overstock Detection — DOI > 90 days flags long-term storage fee risk
 * 7. Auto-update reorder points after every Amazon sync
 */

import { prisma } from '../lib/db'
import { subDays, eachDayOfInterval, format } from 'date-fns'

// ── Service level Z-scores ─────────────────────────────
const Z_SCORE: Record<string, number> = {
  '90': 1.282,
  '95': 1.645,
  '98': 2.054,
  '99': 2.326,
}

// ── Target Days of Inventory for FBA ──────────────────
// 45 days = Amazon sweet spot: enough buffer, avoids long-term storage fees (>365d)
// IPI (Inventory Performance Index) penalises excess, so we cap at 60d
const TARGET_DOI = 45
const MAX_DOI = 60        // Cap order to avoid overstocking
const OVERSTOCK_DOI = 90  // Flag for long-term storage fee risk (FBA charges after 365d but 90d is a good warning)

// ── Default lead times by channel ─────────────────────
const DEFAULT_LEAD_TIME: Record<string, number> = {
  AMAZON_US: 14,
  AMAZON_IN: 21,
  AMAZON_AE: 21,
  AMAZON_UK: 14,
  AMAZON_AU: 21,
  DEFAULT: 14,
}

// ── Standard deviation helper ──────────────────────────
function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

// ── Get daily sales for a SKU ──────────────────────────
async function getDailySales(orgId: string, sku: string, days: number): Promise<number[]> {
  const from = subDays(new Date(), days)
  const items = await prisma.orderItem.findMany({
    where: {
      sku,
      order: { orgId, orderedAt: { gte: from }, status: { notIn: ['CANCELLED'] } },
    },
    select: { quantity: true, order: { select: { orderedAt: true } } },
  })

  const interval = eachDayOfInterval({ start: from, end: new Date() })
  const dailyMap: Record<string, number> = {}
  interval.forEach((d) => { dailyMap[format(d, 'yyyy-MM-dd')] = 0 })

  items.forEach((item) => {
    const key = format(new Date(item.order.orderedAt), 'yyyy-MM-dd')
    if (dailyMap[key] !== undefined) dailyMap[key] += item.quantity
  })

  return Object.values(dailyMap)
}

// ── Core: calculate recommendation for one SKU+channel ─
export async function calculateSkuRecommendation(
  orgId: string,
  sku: string,
  channel: string,
  currentStock: number,
  serviceLevel: '90' | '95' | '98' | '99' = '95'
) {
  // 1. Get daily sales velocity (last 30 days)
  const dailySales = await getDailySales(orgId, sku, 30)
  const totalUnits = dailySales.reduce((a, b) => a + b, 0)
  const adu = totalUnits / 30  // Average Daily Units

  // 2. Get lead time
  const supplier = await prisma.inventoryItem.findFirst({
    where: { orgId, channel, product: { sku } },
    include: { product: true },
  })
  const leadTime = DEFAULT_LEAD_TIME[channel] ?? DEFAULT_LEAD_TIME.DEFAULT

  // 3. Safety Stock = Z × √LeadTime × StdDev(dailySales)
  const z = Z_SCORE[serviceLevel]
  const sigma = stdDev(dailySales)
  const safetyStock = Math.ceil(z * Math.sqrt(leadTime) * sigma)
  const minSafetyStock = Math.ceil(adu * 7) // Minimum: 1 week of sales
  const finalSafetyStock = Math.max(safetyStock, minSafetyStock)

  // 4. Reorder Point = (ADU × LeadTime) + SafetyStock
  const reorderPoint = Math.ceil(adu * leadTime + finalSafetyStock)

  // 5. Days of Inventory = Current Stock / ADU
  const doi = adu > 0 ? Math.round(currentStock / adu) : currentStock > 0 ? 999 : 0

  // 6. Recommended Order Quantity
  // Target: 45-day stock level (FBA sweet spot)
  // Cap at 60-day to protect IPI score
  const targetStock = Math.ceil(adu * TARGET_DOI)
  const maxStock = Math.ceil(adu * MAX_DOI)
  const rawOrderQty = Math.max(0, targetStock - currentStock)
  const recommendedOrderQty = Math.min(rawOrderQty, maxStock - currentStock)

  // 7. Urgency classification
  let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OK' | 'OVERSTOCK'
  if (adu === 0 && currentStock === 0) urgency = 'OK'
  else if (currentStock === 0) urgency = 'CRITICAL'
  else if (doi <= 7) urgency = 'CRITICAL'
  else if (doi <= 14) urgency = 'HIGH'
  else if (doi <= 30) urgency = 'MEDIUM'
  else if (doi <= TARGET_DOI) urgency = 'LOW'
  else if (doi >= OVERSTOCK_DOI) urgency = 'OVERSTOCK'
  else urgency = 'OK'

  // 8. Should we reorder?
  const shouldReorder = currentStock <= reorderPoint && recommendedOrderQty > 0

  return {
    sku,
    channel,
    currentStock,
    adu: Math.round(adu * 100) / 100,
    leadTime,
    safetyStock: finalSafetyStock,
    reorderPoint,
    doi,
    recommendedOrderQty: Math.max(0, recommendedOrderQty),
    targetStock,
    urgency,
    shouldReorder,
    totalUnits30d: totalUnits,
  }
}

// ── Generate full recommendations for an org ──────────
export async function generateRecommendations(orgId: string, channel?: string) {
  const whereChannel = channel ? { channel } : {}
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { orgId, ...whereChannel },
    include: { product: { select: { sku: true, name: true } } },
  })

  const recommendations = await Promise.all(
    inventoryItems.map((item) =>
      calculateSkuRecommendation(orgId, item.product.sku, item.channel, item.quantity)
        .then((rec) => ({ ...rec, inventoryItemId: item.id, productName: item.product.name }))
    )
  )

  // Sort by urgency priority
  const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, OK: 4, OVERSTOCK: 5 }
  recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  const stats = {
    critical: recommendations.filter((r) => r.urgency === 'CRITICAL').length,
    high: recommendations.filter((r) => r.urgency === 'HIGH').length,
    medium: recommendations.filter((r) => r.urgency === 'MEDIUM').length,
    overstock: recommendations.filter((r) => r.urgency === 'OVERSTOCK').length,
    ok: recommendations.filter((r) => ['OK', 'LOW'].includes(r.urgency)).length,
    totalItems: recommendations.length,
    needsAction: recommendations.filter((r) => r.shouldReorder).length,
  }

  return { recommendations, stats }
}

// ── ABC Classification ─────────────────────────────────
// A = top products making up 80% of revenue (tightest control)
// B = next 15% of revenue
// C = bottom 5% (minimal attention needed)
export async function classifyABC(orgId: string) {
  const items = await prisma.orderItem.findMany({
    where: { order: { orgId, orderedAt: { gte: subDays(new Date(), 90) }, status: { notIn: ['CANCELLED'] } } },
    select: { sku: true, total: true, quantity: true },
  })

  const skuRevenue: Record<string, { revenue: number; units: number; name: string }> = {}
  items.forEach((item) => {
    if (!skuRevenue[item.sku]) skuRevenue[item.sku] = { revenue: 0, units: 0, name: item.sku }
    skuRevenue[item.sku].revenue += Number(item.total)
    skuRevenue[item.sku].units += item.quantity
  })

  const sorted = Object.entries(skuRevenue)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
  const totalRevenue = sorted.reduce((sum, [, v]) => sum + v.revenue, 0)

  let cumulative = 0
  return sorted.map(([sku, data]) => {
    cumulative += data.revenue
    const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0
    const cls = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C'
    return { sku, ...data, cumulativeRevenuePct: Math.round(pct * 10) / 10, class: cls }
  })
}

// ── Auto-update reorder points in DB ──────────────────
// Called after every Amazon sync to keep ROP current
export async function autoUpdateReorderPoints(orgId: string, channel?: string) {
  const { recommendations } = await generateRecommendations(orgId, channel)
  let updated = 0

  for (const rec of recommendations) {
    if (rec.reorderPoint > 0) {
      await prisma.inventoryItem.update({
        where: { id: rec.inventoryItemId },
        data: { reorderPoint: rec.reorderPoint },
      })
      updated++
    }
  }

  return { updated }
}

// ── Overstock analysis ─────────────────────────────────
export async function getOverstockAnalysis(orgId: string) {
  const { recommendations } = await generateRecommendations(orgId)
  const overstocked = recommendations.filter((r) => r.urgency === 'OVERSTOCK' || r.doi > OVERSTOCK_DOI)

  return overstocked.map((r) => ({
    ...r,
    excessDays: r.doi - TARGET_DOI,
    excessUnits: r.adu > 0 ? Math.round((r.doi - TARGET_DOI) * r.adu) : 0,
    action: r.doi > 180
      ? 'URGENT: Create removal order or run promotion to avoid FBA long-term storage fees'
      : r.doi > 90
      ? 'Consider running a sale or Amazon PPC campaign to accelerate sell-through'
      : 'Monitor — slightly above target DOI',
  }))
}

// ── Demand Forecast (simple linear trend) ─────────────
export async function forecastDemand(orgId: string, sku: string, forecastDays = 30) {
  const dailySales = await getDailySales(orgId, sku, 60)

  // Split into two halves to detect trend
  const half = Math.floor(dailySales.length / 2)
  const firstHalf = dailySales.slice(0, half)
  const secondHalf = dailySales.slice(half)
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
  const trendMultiplier = firstAvg > 0 ? secondAvg / firstAvg : 1

  const recentADU = secondAvg
  const forecastADU = recentADU * trendMultiplier
  const forecastUnits = Math.ceil(forecastADU * forecastDays)

  const trend = trendMultiplier > 1.1 ? 'GROWING' : trendMultiplier < 0.9 ? 'DECLINING' : 'STABLE'

  return {
    sku,
    recentADU: Math.round(recentADU * 100) / 100,
    forecastADU: Math.round(forecastADU * 100) / 100,
    forecastUnits,
    forecastDays,
    trend,
    trendMultiplier: Math.round(trendMultiplier * 100) / 100,
  }
}
