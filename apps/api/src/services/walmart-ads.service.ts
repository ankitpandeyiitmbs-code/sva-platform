/**
 * Walmart Sponsored Products (Walmart Connect) — daily spend sync.
 *
 * Auth: reuses the marketplace clientId/secret (same OAuth token endpoint).
 * Advertising data is accessed via https://advertising.walmartapis.com/v1/
 * scoped by advertiserId.
 *
 * Flow:
 *  1. Request an Item Performance snapshot report (async)
 *  2. Poll status until COMPLETED
 *  3. Download the CSV
 *  4. Upsert rows into AdSpend table (one row per day × campaign × item)
 */
import axios from 'axios'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/db'
import { env } from '../utils/env'

const TOKEN_URL  = 'https://marketplace.walmartapis.com/v3/token'
const ADS_BASE   = 'https://advertising.walmartapis.com/v1'

// Reuse same token cache pattern as walmart.service.ts
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getAdsAccessToken(): Promise<string> {
  const clientId     = env.WALMART_CLIENT_ID
  const clientSecret = env.WALMART_CLIENT_SECRET
  const cached = tokenCache.get(clientId)
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await axios.post(TOKEN_URL, new URLSearchParams({ grant_type: 'client_credentials' }), {
    headers: {
      Authorization:        `Basic ${credentials}`,
      'WM_SVC.NAME':         'SVA Platform',
      'WM_QOS.CORRELATION_ID': randomUUID(),
      'Content-Type':        'application/x-www-form-urlencoded',
      Accept:               'application/json',
    },
    timeout: 15_000,
  })
  const { access_token, expires_in } = res.data
  tokenCache.set(clientId, { token: access_token, expiresAt: Date.now() + (expires_in ?? 900) * 1000 })
  return access_token
}

async function adsRequest(method: 'GET' | 'POST', path: string, body?: any, params?: any) {
  const token = await getAdsAccessToken()
  const res = await axios({
    method,
    url: `${ADS_BASE}${path}`,
    headers: {
      'WM_SEC.ACCESS_TOKEN':   token,
      'WM_SVC.NAME':            'Walmart Marketplace',
      'WM_QOS.CORRELATION_ID':  randomUUID(),
      'WM_CONSUMER.CHANNEL.TYPE': '0f3e4dd4-0514-4346-b39d-af0e00ea066d',
      Accept:                  'application/json',
      'Content-Type':          'application/json',
    },
    data: body,
    params,
    timeout: 30_000,
  })
  return res.data
}

/**
 * Request an Item Performance snapshot report.
 * Returns the snapshotId we'll poll for completion.
 */
async function requestItemPerformanceReport(
  advertiserId: string,
  startDate: string,  // YYYY-MM-DD
  endDate:   string,
): Promise<string> {
  // POST /v1/advertiser/{advertiserId}/snapshotReport
  const data = await adsRequest('POST', `/advertiser/${advertiserId}/snapshotReport`, {
    reportType:  'itemPerformance',
    reportDate:  startDate,
    startDate,
    endDate,
    format:      'CSV',
  })
  // Response shape: { snapshotId: "...", reportRequestStatus: "PENDING", ... }
  return data.snapshotId ?? data.reportId
}

interface ReportStatus {
  status:       string                  // PENDING | IN_PROGRESS | COMPLETED | FAILED
  downloadUrl?: string
}

async function checkReportStatus(advertiserId: string, snapshotId: string): Promise<ReportStatus> {
  // GET /v1/advertiser/{advertiserId}/snapshotReport/{snapshotId}
  const data = await adsRequest('GET', `/advertiser/${advertiserId}/snapshotReport/${snapshotId}`)
  return {
    status:      (data.reportRequestStatus ?? data.status ?? '').toUpperCase(),
    downloadUrl:  data.downloadUrl ?? data.url,
  }
}

async function downloadReportCsv(url: string): Promise<string> {
  const res = await axios.get(url, { responseType: 'text', timeout: 60_000 })
  return res.data as string
}

/**
 * Parse the Walmart CSV. Schema varies by report type but for itemPerformance
 * we expect at minimum: date, campaignId, campaignName, itemId, sku?, adSpend,
 * impressions, clicks, attributedSales, attributedSalesUnits
 */
function parseAdsCsv(csv: string): Array<{
  date:        string
  campaignId:  string
  campaignName: string
  itemId:      string
  sku:         string | null
  spend:       number
  impressions: number
  clicks:      number
  units:       number
  revenue:     number
}> {
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []

  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const idx = (name: string) => header.findIndex(h => h === name.toLowerCase())

  // Try multiple naming conventions Walmart has used
  const dateIdx        = idx('date') !== -1 ? idx('date') : idx('reportdate')
  const campIdIdx      = idx('campaignid')
  const campNameIdx    = idx('campaignname')
  const itemIdIdx      = idx('itemid') !== -1 ? idx('itemid') : idx('item_id')
  const skuIdx         = idx('sku')
  const spendIdx       = idx('adspend') !== -1 ? idx('adspend') : idx('spend') !== -1 ? idx('spend') : idx('cost')
  const impressionsIdx = idx('impressions')
  const clicksIdx      = idx('clicks')
  const salesIdx       = idx('attributedsales') !== -1 ? idx('attributedsales') : idx('attributedsalesrevenue') !== -1 ? idx('attributedsalesrevenue') : idx('directattributedsales')
  const unitsIdx       = idx('attributedunits') !== -1 ? idx('attributedunits') : idx('attributedunitssold') !== -1 ? idx('attributedunitssold') : idx('directattributedsalesunits')

  const rows: any[] = []
  for (let i = 1; i < lines.length; i++) {
    // Naive CSV parse (Walmart reports don't typically quote fields with commas)
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    rows.push({
      date:         cols[dateIdx]        ?? '',
      campaignId:   cols[campIdIdx]      ?? '',
      campaignName: cols[campNameIdx]    ?? '',
      itemId:       cols[itemIdIdx]      ?? '',
      sku:          skuIdx !== -1 ? (cols[skuIdx] ?? null) : null,
      spend:        Number(cols[spendIdx]       ?? 0) || 0,
      impressions:  Number(cols[impressionsIdx] ?? 0) || 0,
      clicks:       Number(cols[clicksIdx]      ?? 0) || 0,
      revenue:      Number(cols[salesIdx]       ?? 0) || 0,
      units:        Number(cols[unitsIdx]       ?? 0) || 0,
    })
  }
  return rows
}

async function pollUntilComplete(advertiserId: string, snapshotId: string, maxWaitMs = 180_000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const s = await checkReportStatus(advertiserId, snapshotId)
    if (s.status === 'COMPLETED' && s.downloadUrl) return s.downloadUrl
    if (s.status === 'FAILED') throw new Error(`Walmart ads report ${snapshotId} FAILED`)
    await new Promise(r => setTimeout(r, 5_000))  // poll every 5s
  }
  throw new Error(`Walmart ads report ${snapshotId} timed out after ${maxWaitMs / 1000}s`)
}

/**
 * Main entry: sync ad spend for a date window.
 * Default: last 30 days.
 */
export async function syncWalmartAdSpend(
  orgId: string,
  startDate?: string,
  endDate?: string,
): Promise<{ rows: number; spend: number; from: string; to: string }> {
  const advertiserId = env.WALMART_ADVERTISER_ID
  if (!advertiserId) throw new Error('WALMART_ADVERTISER_ID not configured')

  // Default window: yesterday-back-30-days through yesterday (Walmart reports lag 1 day)
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const since     = new Date(); since.setDate(since.getDate() - 31)
  const start = startDate ?? since.toISOString().slice(0, 10)
  const end   = endDate   ?? yesterday.toISOString().slice(0, 10)

  // 1. Request the report
  const snapshotId = await requestItemPerformanceReport(advertiserId, start, end)

  // 2. Poll until ready
  const downloadUrl = await pollUntilComplete(advertiserId, snapshotId)

  // 3. Download CSV
  const csv = await downloadReportCsv(downloadUrl)

  // 4. Parse
  const rows = parseAdsCsv(csv)

  // 5. Upsert each row (SKU mapping: prefer CSV's sku column, fallback to null)
  let inserted = 0
  let totalSpend = 0
  for (const r of rows) {
    if (!r.date) continue
    const date = new Date(r.date + 'T00:00:00Z')
    const sku  = r.sku || null

    await prisma.adSpend.upsert({
      where: {
        orgId_date_channel_campaignId_itemId: {
          orgId,
          date,
          channel:    'WALMART',
          campaignId: r.campaignId || '',
          itemId:     r.itemId     || '',
        },
      },
      create: {
        orgId,
        date,
        channel:           'WALMART',
        campaignId:        r.campaignId   || null,
        campaignName:      r.campaignName || null,
        itemId:            r.itemId       || null,
        sku,
        spend:             r.spend,
        impressions:       r.impressions,
        clicks:            r.clicks,
        attributedUnits:   r.units,
        attributedRevenue: r.revenue,
      },
      update: {
        campaignName:      r.campaignName || null,
        sku,
        spend:             r.spend,
        impressions:       r.impressions,
        clicks:            r.clicks,
        attributedUnits:   r.units,
        attributedRevenue: r.revenue,
      },
    })
    inserted++
    totalSpend += r.spend
  }

  return { rows: inserted, spend: +totalSpend.toFixed(2), from: start, to: end }
}
