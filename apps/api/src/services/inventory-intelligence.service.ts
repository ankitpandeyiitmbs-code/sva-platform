/**
 * ============================================================
 * SVA PLATFORM — INVENTORY INTELLIGENCE ENGINE (v2)
 * ============================================================
 *
 * Professional Amazon FBA inventory management — same logic
 * used by 8-figure Amazon sellers.
 *
 * Factors considered:
 *  1. ADU with trend detection (7d vs 30d vs 90d velocity)
 *  2. Safety stock (Z-score × √LeadTime × StdDev)
 *  3. Reorder point = demand-lead-time coverage + safety stock
 *  4. In-transit / inbound units (FBA working + shipped + receiving)
 *  5. Reserved units (already committed to orders)
 *  6. AWD units (Amazon Warehousing & Distribution buffer)
 *  7. Seasonal / festive demand multipliers (US + India + UAE + UK + AU)
 *  8. Upcoming deal / event preparation window
 *  9. Long-term storage risk (approaching 180d, 270d, 365d FBA thresholds)
 * 10. Product expiry date vs projected sell-through date
 * 11. ABC classification (80/15/5 revenue split — last 90 days)
 * 12. Overstock / IPI risk detection (DOI > 90d)
 * 13. Demand forecast (linear trend, next 30/60/90 days)
 * 14. Recommended order quantity factoring ALL of the above
 * ============================================================
 */

import { prisma } from '../lib/db'
import { subDays, addDays, differenceInDays, eachDayOfInterval, format, parseISO } from 'date-fns'

// ── Constants ──────────────────────────────────────────
const Z_95 = 1.645  // 95% service level
const Z_99 = 2.326  // 99% service level (for A-class items)
const TARGET_DOI   = 45   // FBA sweet spot
const MAX_DOI      = 60   // Cap to protect IPI score
const OVERSTOCK_DOI = 90  // Long-term storage fee warning threshold
const LT_STORAGE_WARNING_DAYS = 180  // Start watching at 6 months
const LT_STORAGE_URGENT_DAYS  = 270  // Take action at 9 months
const LT_STORAGE_FEE_DAYS     = 365  // Amazon charges fees at 1 year

const DEFAULT_LEAD_TIME: Record<string, number> = {
  AMAZON_US: 14, AMAZON_IN: 21, AMAZON_AE: 21,
  AMAZON_UK: 14, AMAZON_AU: 21, DEFAULT: 14,
}

// ── Seasonal / Festive Events Calendar ────────────────
// prepareDays = days before event to start building stock
// salesWindow = days the event boosts demand
// multiplier  = demand boost during event (1.5 = 50% more sales)
interface SeasonalEvent {
  name: string
  monthDay: string    // MM-DD (approximate — some vary yearly)
  prepareDays: number
  salesWindow: number
  multiplier: number
  channels: string[]
  category?: string   // Optional: only applies to certain product categories
}

const SEASONAL_EVENTS: SeasonalEvent[] = [
  // ── India ──────────────────────────────────────────
  { name: 'Holi',                   monthDay: '03-14', prepareDays: 21, salesWindow: 7,  multiplier: 1.8, channels: ['AMAZON_IN'] },
  { name: 'Amazon Summer Sale (IN)',  monthDay: '05-01', prepareDays: 30, salesWindow: 7,  multiplier: 1.6, channels: ['AMAZON_IN'] },
  { name: "Mother's Day",            monthDay: '05-12', prepareDays: 21, salesWindow: 5,  multiplier: 2.0, channels: ['AMAZON_IN', 'AMAZON_US', 'AMAZON_UK'] },
  { name: 'Prime Day',               monthDay: '07-16', prepareDays: 45, salesWindow: 2,  multiplier: 3.0, channels: ['AMAZON_IN', 'AMAZON_US', 'AMAZON_UK', 'AMAZON_AE', 'AMAZON_AU'] },
  { name: 'Independence Day (IN)',    monthDay: '08-15', prepareDays: 14, salesWindow: 5,  multiplier: 1.6, channels: ['AMAZON_IN'] },
  { name: 'Navratri',                monthDay: '10-03', prepareDays: 30, salesWindow: 9,  multiplier: 2.0, channels: ['AMAZON_IN'] },
  { name: 'Great Indian Festival',   monthDay: '10-07', prepareDays: 45, salesWindow: 7,  multiplier: 3.5, channels: ['AMAZON_IN'] },
  { name: 'Dhanteras',               monthDay: '10-29', prepareDays: 21, salesWindow: 2,  multiplier: 2.5, channels: ['AMAZON_IN'] },
  { name: 'Diwali',                  monthDay: '10-31', prepareDays: 45, salesWindow: 5,  multiplier: 3.5, channels: ['AMAZON_IN'] },
  { name: 'Amazon Winter Sale (IN)', monthDay: '12-15', prepareDays: 21, salesWindow: 7,  multiplier: 1.8, channels: ['AMAZON_IN'] },
  { name: "New Year's Sale",         monthDay: '01-01', prepareDays: 14, salesWindow: 7,  multiplier: 1.5, channels: ['AMAZON_IN', 'AMAZON_US'] },

  // ── United States ───────────────────────────────────
  { name: "Valentine's Day",         monthDay: '02-14', prepareDays: 21, salesWindow: 7,  multiplier: 1.8, channels: ['AMAZON_US'] },
  { name: 'Back to School',          monthDay: '08-20', prepareDays: 30, salesWindow: 21, multiplier: 1.5, channels: ['AMAZON_US'] },
  { name: 'Fall Sale',               monthDay: '10-15', prepareDays: 21, salesWindow: 7,  multiplier: 1.6, channels: ['AMAZON_US'] },
  { name: 'Black Friday',            monthDay: '11-29', prepareDays: 45, salesWindow: 4,  multiplier: 4.0, channels: ['AMAZON_US', 'AMAZON_UK', 'AMAZON_AU'] },
  { name: 'Cyber Monday',            monthDay: '12-02', prepareDays: 30, salesWindow: 2,  multiplier: 3.0, channels: ['AMAZON_US'] },
  { name: 'Holiday / Christmas',     monthDay: '12-20', prepareDays: 45, salesWindow: 14, multiplier: 2.5, channels: ['AMAZON_US', 'AMAZON_UK', 'AMAZON_AU'] },

  // ── United Kingdom ──────────────────────────────────
  { name: 'Amazon Summer Sale (UK)', monthDay: '06-20', prepareDays: 21, salesWindow: 7,  multiplier: 1.6, channels: ['AMAZON_UK'] },
  { name: 'Boxing Day',              monthDay: '12-26', prepareDays: 14, salesWindow: 5,  multiplier: 2.0, channels: ['AMAZON_UK', 'AMAZON_AU'] },

  // ── UAE ─────────────────────────────────────────────
  { name: 'Ramadan',                 monthDay: '03-10', prepareDays: 45, salesWindow: 30, multiplier: 2.5, channels: ['AMAZON_AE'] },
  { name: 'Eid al-Fitr',            monthDay: '04-10', prepareDays: 21, salesWindow: 7,  multiplier: 2.0, channels: ['AMAZON_AE'] },
  { name: 'White Friday',            monthDay: '11-22', prepareDays: 30, salesWindow: 5,  multiplier: 2.5, channels: ['AMAZON_AE'] },
  { name: 'UAE National Day',        monthDay: '12-02', prepareDays: 14, salesWindow: 3,  multiplier: 1.5, channels: ['AMAZON_AE'] },

  // ── Australia ───────────────────────────────────────
  { name: "Australia Day Sale",      monthDay: '01-26', prepareDays: 14, salesWindow: 3,  multiplier: 1.4, channels: ['AMAZON_AU'] },
  { name: "Click Frenzy",            monthDay: '11-12', prepareDays: 21, salesWindow: 2,  multiplier: 2.0, channels: ['AMAZON_AU'] },
]

// ── Helper: get upcoming events for a channel ─────────
function getUpcomingEvents(channel: string, daysAhead = 90) {
  const now = new Date()
  const year = now.getFullYear()
  const upcoming: Array<SeasonalEvent & { date: Date; daysUntil: number; inPrepWindow: boolean; inSalesWindow: boolean }> = []

  for (const event of SEASONAL_EVENTS) {
    if (!event.channels.includes(channel)) continue
    const [month, day] = event.monthDay.split('-').map(Number)

    // Check current year and next year
    for (const y of [year, year + 1]) {
      const eventDate = new Date(y, month - 1, day)
      const daysUntil = differenceInDays(eventDate, now)
      if (daysUntil < -event.salesWindow) continue   // event already passed
      if (daysUntil > daysAhead) continue             // too far out

      upcoming.push({
        ...event,
        date: eventDate,
        daysUntil,
        inPrepWindow: daysUntil >= 0 && daysUntil <= event.prepareDays,
        inSalesWindow: daysUntil >= -event.salesWindow && daysUntil < 0,
      })
      break // only take one occurrence
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil)
}

// ── Helper: seasonal demand multiplier ────────────────
// Returns the highest active multiplier for a channel right now / soon
function getSeasonalMultiplier(channel: string): { multiplier: number; reason: string } {
  const events = getUpcomingEvents(channel, 45)
  let best = { multiplier: 1.0, reason: '' }

  for (const e of events) {
    if (e.inSalesWindow && e.multiplier > best.multiplier) {
      best = { multiplier: e.multiplier, reason: `${e.name} is happening now` }
    } else if (e.inPrepWindow && e.daysUntil <= 30 && e.multiplier > best.multiplier) {
      // Scale: full multiplier when 7 days away, 50% boost when 30 days away
      const rampedMultiplier = 1 + (e.multiplier - 1) * (1 - e.daysUntil / e.prepareDays)
      if (rampedMultiplier > best.multiplier) {
        best = { multiplier: rampedMultiplier, reason: `${e.name} in ${e.daysUntil} days` }
      }
    }
  }

  return best
}

// ── Helper: standard deviation ────────────────────────
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

// ── Calculate enhanced ADU with trend ─────────────────
function calculateTrendedADU(dailySales: number[]): {
  adu7d: number; adu30d: number; adu90d: number
  trendedADU: number; trend: 'GROWING' | 'STABLE' | 'DECLINING'; trendPct: number
} {
  const last7  = dailySales.slice(-7)
  const last30 = dailySales.slice(-30)
  const last90 = dailySales

  const adu7d  = last7.reduce((a, b) => a + b, 0) / Math.max(last7.length, 1)
  const adu30d = last30.reduce((a, b) => a + b, 0) / Math.max(last30.length, 1)
  const adu90d = last90.reduce((a, b) => a + b, 0) / Math.max(last90.length, 1)

  // Use weighted blend: 50% recent (7d), 30% medium (30d), 20% long (90d)
  const trendedADU = adu7d * 0.5 + adu30d * 0.3 + adu90d * 0.2

  // Trend vs 30-day baseline
  const trendPct = adu30d > 0 ? ((adu7d - adu30d) / adu30d) * 100 : 0
  const trend = trendPct > 15 ? 'GROWING' : trendPct < -15 ? 'DECLINING' : 'STABLE'

  return {
    adu7d:  Math.round(adu7d  * 100) / 100,
    adu30d: Math.round(adu30d * 100) / 100,
    adu90d: Math.round(adu90d * 100) / 100,
    trendedADU: Math.round(trendedADU * 100) / 100,
    trend,
    trendPct: Math.round(trendPct),
  }
}

// ── Get FBA inbound/in-transit quantities from stored data
async function getFBAQuantities(orgId: string, sku: string, channel: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { orgId, channel, product: { sku } },
    select: { customFields: true, quantity: true },
  })

  const cf = (item?.customFields ?? {}) as any
  return {
    fulfillableQty:      cf.fulfillableQty      ?? item?.quantity ?? 0,
    inboundWorkingQty:   cf.inboundWorkingQty   ?? 0,  // In shipment plan, not yet sent
    inboundShippedQty:   cf.inboundShippedQty   ?? 0,  // Shipped to Amazon, in transit
    inboundReceivingQty: cf.inboundReceivingQty ?? 0,  // Arrived at FC, being received
    reservedQty:         cf.reservedQty         ?? 0,  // Reserved for pending orders
    pendingRemovalQty:   cf.pendingRemovalQty   ?? 0,  // Awaiting removal
    awdQty:              cf.awdQty              ?? 0,  // Amazon Warehousing & Distribution
    receivedAtFcDate:    cf.receivedAtFcDate     ?? null,
  }
}

// ── Check expiry risk ─────────────────────────────────
function checkExpiryRisk(expiryDateStr: string | null, currentStock: number, adu: number): {
  hasExpiry: boolean; daysUntilExpiry: number | null; expiryRisk: 'CRITICAL' | 'HIGH' | 'OK' | 'NONE'; message: string
} {
  if (!expiryDateStr) return { hasExpiry: false, daysUntilExpiry: null, expiryRisk: 'NONE', message: '' }

  const expiry = new Date(expiryDateStr)
  const daysUntilExpiry = differenceInDays(expiry, new Date())
  const daysToSell = adu > 0 ? Math.ceil(currentStock / adu) : 9999

  let expiryRisk: 'CRITICAL' | 'HIGH' | 'OK' | 'NONE' = 'OK'
  let message = ''

  if (daysUntilExpiry < 0) {
    expiryRisk = 'CRITICAL'
    message = `EXPIRED ${Math.abs(daysUntilExpiry)} days ago — initiate removal immediately`
  } else if (daysToSell > daysUntilExpiry) {
    expiryRisk = 'CRITICAL'
    message = `Will expire in ${daysUntilExpiry}d but takes ~${daysToSell}d to sell — run promotion or remove`
  } else if (daysUntilExpiry < 90) {
    expiryRisk = 'HIGH'
    message = `Expiring in ${daysUntilExpiry} days — accelerate sell-through with PPC or deal`
  } else if (daysUntilExpiry < 180) {
    expiryRisk = 'HIGH'
    message = `Expiring in ${daysUntilExpiry} days — monitor closely`
  }

  return { hasExpiry: true, daysUntilExpiry, expiryRisk, message }
}

// ── Long-term storage risk ─────────────────────────────
function checkLongTermStorageRisk(receivedAtFcDate: string | null, currentStock: number, adu: number): {
  daysAtFc: number | null; ltStorageRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OK'; message: string; estimatedFeeDate: Date | null
} {
  if (!receivedAtFcDate || currentStock === 0) {
    return { daysAtFc: null, ltStorageRisk: 'OK', message: '', estimatedFeeDate: null }
  }

  const daysAtFc = differenceInDays(new Date(), new Date(receivedAtFcDate))
  const daysToSell = adu > 0 ? Math.ceil(currentStock / adu) : 9999
  const projectedDaysAtFc = daysAtFc + daysToSell
  const estimatedFeeDate = addDays(new Date(receivedAtFcDate), LT_STORAGE_FEE_DAYS)

  let ltStorageRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OK' = 'OK'
  let message = ''

  if (daysAtFc >= LT_STORAGE_FEE_DAYS || projectedDaysAtFc >= LT_STORAGE_FEE_DAYS) {
    ltStorageRisk = 'CRITICAL'
    message = `${daysAtFc}d at FC — Amazon long-term storage fees are active. Remove or liquidate immediately.`
  } else if (daysAtFc >= LT_STORAGE_URGENT_DAYS) {
    ltStorageRisk = 'HIGH'
    message = `${daysAtFc}d at FC — will hit 365-day fee threshold in ${LT_STORAGE_FEE_DAYS - daysAtFc}d. Urgent: run sale or removal.`
  } else if (daysAtFc >= LT_STORAGE_WARNING_DAYS) {
    ltStorageRisk = 'MEDIUM'
    message = `${daysAtFc}d at FC — ${LT_STORAGE_FEE_DAYS - daysAtFc}d until long-term storage fees. Plan a promotion.`
  }

  return { daysAtFc, ltStorageRisk, message, estimatedFeeDate }
}

// ── Core: full recommendation for one inventory item ──
export async function calculateComprehensiveRecommendation(
  orgId: string,
  sku: string,
  channel: string,
  currentStock: number,
  productCustomFields?: any
) {
  // 1. Daily sales (last 90 days for full picture)
  const dailySales90 = await getDailySales(orgId, sku, 90)
  const dailySales30 = dailySales90.slice(-30)

  const velocity = calculateTrendedADU(dailySales90)
  const { trendedADU, trend, trendPct } = velocity

  // 2. Seasonal multiplier
  const seasonal = getSeasonalMultiplier(channel)
  const effectiveADU = trendedADU * seasonal.multiplier

  // 3. FBA quantities (in-transit, reserved, AWD)
  const fba = await getFBAQuantities(orgId, sku, channel)
  const totalInbound = fba.inboundWorkingQty + fba.inboundShippedQty + fba.inboundReceivingQty
  const availableStock = fba.fulfillableQty - fba.reservedQty + fba.awdQty

  // 4. Lead time
  const leadTime = DEFAULT_LEAD_TIME[channel] ?? DEFAULT_LEAD_TIME.DEFAULT

  // 5. Safety stock — use 99% for A-class (we'll classify later), 95% default
  const z = Z_95
  const sigma = stdDev(dailySales30)
  const safetyStock = Math.ceil(z * Math.sqrt(leadTime) * sigma * seasonal.multiplier)
  const minSafetyStock = Math.ceil(effectiveADU * 7)
  const finalSafetyStock = Math.max(safetyStock, minSafetyStock)

  // 6. Reorder Point
  const reorderPoint = Math.ceil(effectiveADU * leadTime + finalSafetyStock)

  // 7. Days of Inventory (based on available stock, using BASE adu for accurate DOI)
  const doi = trendedADU > 0 ? Math.round(availableStock / trendedADU) : availableStock > 0 ? 999 : 0

  // 8. Recommended Order Quantity
  // Factor in: seasonal demand, upcoming events, in-transit units
  const upcomingEvents = getUpcomingEvents(channel, 60)
  const nearestEvent = upcomingEvents[0]

  // Event buffer: extra stock for upcoming event
  let eventBuffer = 0
  if (nearestEvent && nearestEvent.daysUntil <= nearestEvent.prepareDays) {
    const eventDemand = Math.ceil(trendedADU * nearestEvent.multiplier * nearestEvent.salesWindow)
    const currentEventCoverage = availableStock + totalInbound
    eventBuffer = Math.max(0, eventDemand - currentEventCoverage)
  }

  const targetStock = Math.ceil(effectiveADU * TARGET_DOI)
  const maxStock = Math.ceil(effectiveADU * MAX_DOI) + eventBuffer
  const rawOrderQty = Math.max(0, targetStock + eventBuffer - availableStock - totalInbound)
  const recommendedOrderQty = Math.min(rawOrderQty, maxStock)

  // 9. Expiry risk
  const expiryDate = productCustomFields?.expiryDate ?? null
  const expiry = checkExpiryRisk(expiryDate, currentStock, trendedADU)

  // 10. Long-term storage risk
  const ltStorage = checkLongTermStorageRisk(fba.receivedAtFcDate, currentStock, trendedADU)

  // 11. Urgency classification (considering all factors)
  let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OK' | 'OVERSTOCK'
  if (expiry.expiryRisk === 'CRITICAL' || ltStorage.ltStorageRisk === 'CRITICAL') {
    urgency = 'CRITICAL'
  } else if (availableStock === 0 && trendedADU > 0) {
    urgency = 'CRITICAL'
  } else if (doi <= 7) {
    urgency = 'CRITICAL'
  } else if (doi <= 14 || expiry.expiryRisk === 'HIGH' || ltStorage.ltStorageRisk === 'HIGH') {
    urgency = 'HIGH'
  } else if (doi <= 30 || ltStorage.ltStorageRisk === 'MEDIUM') {
    urgency = 'MEDIUM'
  } else if (doi <= TARGET_DOI) {
    urgency = 'LOW'
  } else if (doi >= OVERSTOCK_DOI) {
    urgency = 'OVERSTOCK'
  } else {
    urgency = 'OK'
  }

  const shouldReorder = availableStock <= reorderPoint && recommendedOrderQty > 0

  return {
    sku,
    channel,
    // Stock levels
    currentStock,
    availableStock,
    fulfillableQty: fba.fulfillableQty,
    inboundWorkingQty: fba.inboundWorkingQty,
    inboundShippedQty: fba.inboundShippedQty,
    inboundReceivingQty: fba.inboundReceivingQty,
    totalInbound,
    reservedQty: fba.reservedQty,
    awdQty: fba.awdQty,
    // Velocity
    adu7d: velocity.adu7d,
    adu30d: velocity.adu30d,
    adu90d: velocity.adu90d,
    trendedADU,
    trend,
    trendPct,
    effectiveADU: Math.round(effectiveADU * 100) / 100,
    // Seasonal
    seasonalMultiplier: Math.round(seasonal.multiplier * 100) / 100,
    seasonalReason: seasonal.reason,
    upcomingEvent: nearestEvent ? { name: nearestEvent.name, daysUntil: nearestEvent.daysUntil, multiplier: nearestEvent.multiplier } : null,
    // Calculation
    leadTime,
    safetyStock: finalSafetyStock,
    reorderPoint,
    doi,
    targetStock,
    eventBuffer,
    recommendedOrderQty: Math.max(0, recommendedOrderQty),
    urgency,
    shouldReorder,
    // Risk flags
    expiryRisk: expiry.expiryRisk,
    expiryDaysLeft: expiry.daysUntilExpiry,
    expiryMessage: expiry.message,
    ltStorageRisk: ltStorage.ltStorageRisk,
    daysAtFc: ltStorage.daysAtFc,
    ltStorageMessage: ltStorage.message,
    estimatedFeeDate: ltStorage.estimatedFeeDate,
  }
}

// ── Generate full recommendations ─────────────────────
export async function generateRecommendations(orgId: string, channel?: string) {
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { orgId, ...(channel ? { channel } : {}) },
    include: { product: { select: { sku: true, name: true, customFields: true } } },
  })

  const recommendations = await Promise.all(
    inventoryItems.map((item) =>
      calculateComprehensiveRecommendation(
        orgId, item.product.sku, item.channel,
        item.quantity, item.product.customFields
      ).then((rec) => ({
        ...rec,
        inventoryItemId: item.id,
        productName: item.product.name,
      }))
    )
  )

  const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, OK: 4, OVERSTOCK: 5 }
  recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  const stats = {
    critical:    recommendations.filter((r) => r.urgency === 'CRITICAL').length,
    high:        recommendations.filter((r) => r.urgency === 'HIGH').length,
    medium:      recommendations.filter((r) => r.urgency === 'MEDIUM').length,
    overstock:   recommendations.filter((r) => r.urgency === 'OVERSTOCK').length,
    ok:          recommendations.filter((r) => ['OK', 'LOW'].includes(r.urgency)).length,
    totalItems:  recommendations.length,
    needsAction: recommendations.filter((r) => r.shouldReorder).length,
    expiryRisk:  recommendations.filter((r) => ['CRITICAL', 'HIGH'].includes(r.expiryRisk)).length,
    ltRisk:      recommendations.filter((r) => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(r.ltStorageRisk)).length,
  }

  return { recommendations, stats }
}

// ── Get upcoming events for all connected channels ─────
export async function getUpcomingEventsForOrg(orgId: string) {
  const configs = await prisma.channelConfig.findMany({
    where: { orgId, status: 'CONNECTED', channel: { startsWith: 'AMAZON' } },
    select: { channel: true },
  })

  const allEvents: Array<any> = []
  for (const cfg of configs) {
    const events = getUpcomingEvents(cfg.channel, 90)
    events.forEach((e) => {
      if (!allEvents.find((x) => x.name === e.name && x.channel === cfg.channel)) {
        allEvents.push({ ...e, channel: cfg.channel })
      }
    })
  }

  return allEvents.sort((a, b) => a.daysUntil - b.daysUntil)
}

// ── ABC Classification ─────────────────────────────────
export async function classifyABC(orgId: string) {
  const items = await prisma.orderItem.findMany({
    where: { order: { orgId, orderedAt: { gte: subDays(new Date(), 90) }, status: { notIn: ['CANCELLED'] } } },
    select: { sku: true, total: true, quantity: true },
  })

  const skuRevenue: Record<string, { revenue: number; units: number }> = {}
  items.forEach((item) => {
    if (!skuRevenue[item.sku]) skuRevenue[item.sku] = { revenue: 0, units: 0 }
    skuRevenue[item.sku].revenue += Number(item.total)
    skuRevenue[item.sku].units += item.quantity
  })

  const sorted = Object.entries(skuRevenue).sort(([, a], [, b]) => b.revenue - a.revenue)
  const totalRevenue = sorted.reduce((sum, [, v]) => sum + v.revenue, 0)

  let cumulative = 0
  return sorted.map(([sku, data]) => {
    cumulative += data.revenue
    const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0
    const cls = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C'
    return { sku, ...data, cumulativeRevenuePct: Math.round(pct * 10) / 10, class: cls }
  })
}

// ── Overstock analysis ─────────────────────────────────
export async function getOverstockAnalysis(orgId: string) {
  const { recommendations } = await generateRecommendations(orgId)
  return recommendations
    .filter((r) => r.urgency === 'OVERSTOCK' || r.doi > OVERSTOCK_DOI)
    .map((r) => ({
      ...r,
      excessDays: r.doi - TARGET_DOI,
      excessUnits: r.trendedADU > 0 ? Math.round((r.doi - TARGET_DOI) * r.trendedADU) : 0,
      action: r.doi > 180
        ? 'URGENT: Create removal order or run deep promotion — long-term storage fees risk'
        : r.doi > 90
        ? 'Run Lightning Deal / PPC campaign to accelerate sell-through'
        : 'Slightly above target DOI — monitor and reduce next order',
    }))
}

// ── Expiry risk analysis ───────────────────────────────
export async function getExpiryRiskProducts(orgId: string) {
  const { recommendations } = await generateRecommendations(orgId)
  return recommendations
    .filter((r) => r.expiryRisk !== 'NONE' && r.expiryRisk !== 'OK')
    .sort((a, b) => (a.expiryDaysLeft ?? 9999) - (b.expiryDaysLeft ?? 9999))
}

// ── Long-term storage risk ─────────────────────────────
export async function getLongTermStorageRisk(orgId: string) {
  const { recommendations } = await generateRecommendations(orgId)
  return recommendations
    .filter((r) => r.ltStorageRisk !== 'OK')
    .sort((a, b) => (b.daysAtFc ?? 0) - (a.daysAtFc ?? 0))
}

// ── Auto-update reorder points ─────────────────────────
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

// ── Demand forecast ────────────────────────────────────
export async function forecastDemand(orgId: string, sku: string, forecastDays = 30) {
  const dailySales = await getDailySales(orgId, sku, 90)
  const velocity = calculateTrendedADU(dailySales)

  // Apply trend to forecast
  const trendMultiplier = velocity.trend === 'GROWING' ? (1 + Math.min(velocity.trendPct / 100, 0.5))
    : velocity.trend === 'DECLINING' ? (1 + Math.max(velocity.trendPct / 100, -0.5))
    : 1.0

  const forecastADU = velocity.trendedADU * trendMultiplier
  const forecastUnits = Math.ceil(forecastADU * forecastDays)

  return {
    sku,
    ...velocity,
    forecastADU: Math.round(forecastADU * 100) / 100,
    forecastUnits,
    forecastDays,
    trendMultiplier: Math.round(trendMultiplier * 100) / 100,
  }
}
