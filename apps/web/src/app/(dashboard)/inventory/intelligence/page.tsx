'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatNumber, formatCurrency, cn } from '@/lib/utils'
import {
  ArrowLeft, RefreshCw, Loader2, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Package, Zap, BarChart3, Info, Calendar, Clock, Shield, FlameKindling
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

// ── Config maps ───────────────────────────────────────
const URGENCY = {
  CRITICAL:  { label: 'Critical',  dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' },
  HIGH:      { label: 'High',      dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400' },
  MEDIUM:    { label: 'Medium',    dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  LOW:       { label: 'Low',       dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' },
  OK:        { label: 'OK',        dot: 'bg-emerald-500',badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' },
  OVERSTOCK: { label: 'Overstock', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400' },
}

const TREND_ICON = {
  GROWING:  { icon: TrendingUp,   color: 'text-emerald-500' },
  STABLE:   { icon: Minus,        color: 'text-muted-foreground' },
  DECLINING:{ icon: TrendingDown, color: 'text-red-500' },
}

const CHANNEL_LABELS: Record<string, string> = {
  AMAZON_US: 'Amazon US', AMAZON_IN: 'Amazon IN', AMAZON_AE: 'Amazon AE',
  AMAZON_UK: 'Amazon UK', AMAZON_AU: 'Amazon AU',
}

const CHANNELS = Object.keys(CHANNEL_LABELS)

const LT_RISK = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  HIGH:     'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
  MEDIUM:   'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  OK:       'bg-emerald-100 text-emerald-700',
}

type TabKey = 'restock' | 'abc' | 'overstock' | 'events' | 'expiry' | 'storage'

export default function InventoryIntelligencePage() {
  const [tab, setTab] = useState<TabKey>('restock')
  const [channelFilter, setChannelFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [editExpiry, setEditExpiry] = useState<{ sku: string; value: string } | null>(null)
  const qc = useQueryClient()

  // ── Queries ───────────────────────────────────────
  const { data: recData, isLoading: recLoading, refetch: refetchRec } = useQuery({
    queryKey: ['intelligence', 'recommendations', channelFilter],
    queryFn: () => api.get(`/inventory/intelligence/recommendations${channelFilter ? `?channel=${channelFilter}` : ''}`).then(r => r.data.data),
    enabled: tab === 'restock',
  })
  const { data: abcData = [], isLoading: abcLoading } = useQuery({
    queryKey: ['intelligence', 'abc'],
    queryFn: () => api.get('/inventory/intelligence/abc').then(r => r.data.data),
    enabled: tab === 'abc',
  })
  const { data: overstockData = [], isLoading: overstockLoading } = useQuery({
    queryKey: ['intelligence', 'overstock'],
    queryFn: () => api.get('/inventory/intelligence/overstock').then(r => r.data.data),
    enabled: tab === 'overstock',
  })
  const { data: eventsData = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['intelligence', 'events'],
    queryFn: () => api.get('/inventory/intelligence/events').then(r => r.data.data),
    enabled: tab === 'events',
  })
  const { data: expiryData = [], isLoading: expiryLoading } = useQuery({
    queryKey: ['intelligence', 'expiry'],
    queryFn: () => api.get('/inventory/intelligence/expiry').then(r => r.data.data),
    enabled: tab === 'expiry',
  })
  const { data: storageData = [], isLoading: storageLoading } = useQuery({
    queryKey: ['intelligence', 'storage'],
    queryFn: () => api.get('/inventory/intelligence/long-term-storage').then(r => r.data.data),
    enabled: tab === 'storage',
  })

  // ── Mutations ──────────────────────────────────────
  const { mutate: autoUpdate, isPending: updating } = useMutation({
    mutationFn: () => api.post('/inventory/intelligence/auto-update', { channel: channelFilter || undefined }),
    onSuccess: (res) => {
      toast.success(`Reorder points updated for ${res.data.data.updated} SKUs`)
      qc.invalidateQueries({ queryKey: ['intelligence'] })
    },
    onError: () => toast.error('Update failed'),
  })

  const { mutate: saveExpiry, isPending: savingExpiry } = useMutation({
    mutationFn: ({ sku, expiryDate }: { sku: string; expiryDate: string }) =>
      api.patch(`/inventory/intelligence/expiry/${encodeURIComponent(sku)}`, { expiryDate }),
    onSuccess: () => {
      toast.success('Expiry date saved')
      setEditExpiry(null)
      qc.invalidateQueries({ queryKey: ['intelligence'] })
    },
    onError: () => toast.error('Failed to save expiry date'),
  })

  const recs = recData?.recommendations ?? []
  const stats = recData?.stats ?? {}
  const filtered = recs.filter((r: any) => !urgencyFilter || r.urgency === urgencyFilter)

  const tabs: { key: TabKey; label: string; icon: any; badge?: number }[] = [
    { key: 'restock',  label: 'Restock',       icon: AlertTriangle, badge: (stats as any).critical },
    { key: 'events',   label: 'Festive Events', icon: Calendar },
    { key: 'abc',      label: 'ABC Analysis',   icon: BarChart3 },
    { key: 'overstock',label: 'Overstock',      icon: Package,       badge: (stats as any).overstock },
    { key: 'expiry',   label: 'Expiry Dates',   icon: Clock,         badge: (stats as any).expiryRisk },
    { key: 'storage',  label: 'LT Storage',     icon: Shield,        badge: (stats as any).ltRisk },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/inventory" className="rounded-lg border p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Inventory Intelligence
          </h1>
          <p className="text-xs text-muted-foreground">Trend-aware · Seasonal · In-transit · Expiry · Long-term storage · ABC</p>
        </div>
        <button onClick={() => autoUpdate()} disabled={updating}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {updating ? 'Updating...' : 'Auto-Update Reorder Points'}
        </button>
      </div>

      {/* Formula Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900 p-4">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5">
            <p className="font-semibold">Smart Order Formula</p>
            <p><strong>Effective ADU</strong> = Weighted(7d×50% + 30d×30% + 90d×20%) × Seasonal Multiplier</p>
            <p><strong>Safety Stock</strong> = 1.645 × √LeadTime × StdDev(daily sales) × Seasonal Multiplier</p>
            <p><strong>Reorder Point</strong> = (Effective ADU × Lead Time) + Safety Stock</p>
            <p><strong>Order Qty</strong> = Target 45-day stock + Event Buffer − In-transit − AWD stock (capped 60d IPI limit)</p>
          </div>
        </div>
      </div>

      {/* KPI Summary Row */}
      {tab === 'restock' && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: 'Critical',  key: 'critical',  u: 'CRITICAL' },
            { label: 'High',      key: 'high',      u: 'HIGH' },
            { label: 'Medium',    key: 'medium',    u: 'MEDIUM' },
            { label: 'Overstock', key: 'overstock', u: 'OVERSTOCK' },
            { label: 'Expiry ⚠',  key: 'expiryRisk',u: '' },
            { label: 'LT Risk',   key: 'ltRisk',    u: '' },
          ].map((s) => {
            const dot = URGENCY[s.u as keyof typeof URGENCY]?.dot ?? 'bg-muted-foreground/40'
            const active = urgencyFilter === s.u
            return (
              <button key={s.key}
                onClick={() => s.u ? setUrgencyFilter(active ? '' : s.u) : null}
                className={cn('rounded-xl border p-3 text-left transition-all hover:shadow-sm', active && 'ring-2 ring-primary', !s.u && 'cursor-default')}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn('h-2 w-2 rounded-full', dot)} />
                  <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                </div>
                <p className="text-2xl font-bold">{recLoading ? '—' : (stats as any)[s.key] ?? 0}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Tab Bar + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {!!t.badge && t.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
        {tab === 'restock' && (
          <>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Amazon Channels</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
            </select>
            <button onClick={() => refetchRec()} className="rounded-lg border p-1.5 hover:bg-muted">
              <RefreshCw className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* ── RESTOCK RECOMMENDATIONS ─────────────────────── */}
      {tab === 'restock' && (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/40 text-xs">
              <tr>
                {['SKU / Product','Channel','Fulfillable','Inbound','AWD','Reserved','ADU (trend)','DOI','Safety Stock','ROP','Order Qty','Season','Urgency'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recLoading ? (
                [...Array(6)].map((_, i) => <tr key={i} className="border-t">{[...Array(13)].map((_, j) => <td key={j} className="px-3 py-3"><div className="h-3 rounded bg-muted animate-pulse w-14" /></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-16 text-center">
                  <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No data yet — connect Amazon and sync.</p>
                </td></tr>
              ) : filtered.map((r: any) => {
                const urg = URGENCY[r.urgency as keyof typeof URGENCY] ?? URGENCY.OK
                const TrendIcon = TREND_ICON[r.trend as keyof typeof TREND_ICON]?.icon ?? Minus
                const trendColor = TREND_ICON[r.trend as keyof typeof TREND_ICON]?.color ?? ''
                return (
                  <tr key={`${r.sku}-${r.channel}`}
                    className={cn('border-t hover:bg-muted/20 transition-colors',
                      r.urgency === 'CRITICAL' && 'bg-red-50/40 dark:bg-red-950/10')}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-xs leading-tight">{r.productName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{r.sku}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                    <td className="px-3 py-3 font-bold tabular-nums">{r.fulfillableQty}</td>
                    <td className="px-3 py-3 text-xs tabular-nums">
                      {r.totalInbound > 0
                        ? <span className="text-blue-600 font-medium">+{r.totalInbound}</span>
                        : <span className="text-muted-foreground">—</span>}
                      {r.inboundShippedQty > 0 && <span className="block text-[10px] text-muted-foreground">{r.inboundShippedQty} shipped</span>}
                      {r.inboundReceivingQty > 0 && <span className="block text-[10px] text-muted-foreground">{r.inboundReceivingQty} receiving</span>}
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums text-violet-600">{r.awdQty > 0 ? r.awdQty : '—'}</td>
                    <td className="px-3 py-3 text-xs tabular-nums text-muted-foreground">{r.reservedQty > 0 ? r.reservedQty : '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <TrendIcon className={cn('h-3 w-3', trendColor)} />
                        <span className="font-medium text-xs">{r.trendedADU}/d</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">7d:{r.adu7d} · 30d:{r.adu30d}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('font-bold tabular-nums text-sm',
                        r.doi <= 7 ? 'text-red-600' : r.doi <= 14 ? 'text-orange-600' :
                        r.doi <= 30 ? 'text-amber-600' : r.doi >= 90 ? 'text-violet-600' : 'text-emerald-600')}>
                        {r.doi === 999 ? '∞' : `${r.doi}d`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground tabular-nums">{r.safetyStock}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground tabular-nums">{r.reorderPoint}</td>
                    <td className="px-3 py-3">
                      {r.recommendedOrderQty > 0
                        ? <span className="font-bold text-primary">{formatNumber(r.recommendedOrderQty)}</span>
                        : <span className="text-muted-foreground">—</span>}
                      {r.eventBuffer > 0 && <span className="block text-[10px] text-amber-600">+{r.eventBuffer} event</span>}
                    </td>
                    <td className="px-3 py-3">
                      {r.seasonalMultiplier > 1 ? (
                        <div>
                          <span className="text-xs text-amber-600 font-medium">{r.seasonalMultiplier.toFixed(1)}×</span>
                          <p className="text-[10px] text-muted-foreground leading-tight max-w-[120px]">{r.seasonalReason}</p>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', urg.badge)}>{urg.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── FESTIVE EVENTS ───────────────────────────────── */}
      {tab === 'events' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-900 p-4 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <FlameKindling className="h-4 w-4" /> How event stock planning works
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              When an event enters its preparation window, the intelligence engine automatically adds an event buffer to your order recommendations.
              Buffer = (ADU × event multiplier × sales window days) − current available stock.
            </p>
          </div>

          {eventsLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> :
          eventsData.length === 0 ? (
            <div className="rounded-xl border p-12 text-center">
              <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No connected Amazon channels yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {eventsData.map((event: any, i: number) => {
                const daysLeft = event.daysUntil
                const isLive = daysLeft < 0
                const inPrep = daysLeft >= 0 && daysLeft <= event.prepareDays
                return (
                  <div key={i} className={cn('rounded-xl border p-4 space-y-2',
                    isLive && 'border-red-300 bg-red-50/50 dark:bg-red-950/10',
                    inPrep && !isLive && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10')}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{event.name}</p>
                        <p className="text-xs text-muted-foreground">{CHANNEL_LABELS[event.channel] ?? event.channel}</p>
                      </div>
                      {isLive
                        ? <span className="shrink-0 rounded-full bg-red-500 text-white px-2 py-0.5 text-xs font-bold animate-pulse">LIVE</span>
                        : inPrep
                        ? <span className="shrink-0 rounded-full bg-amber-500 text-white px-2 py-0.5 text-xs font-bold">PREP</span>
                        : <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{daysLeft}d away</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="font-bold text-base">{event.multiplier}×</p>
                        <p className="text-muted-foreground">Demand boost</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="font-bold text-base">{event.salesWindow}d</p>
                        <p className="text-muted-foreground">Sales window</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="font-bold text-base">{event.prepareDays}d</p>
                        <p className="text-muted-foreground">Prep window</p>
                      </div>
                    </div>
                    {inPrep && (
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        ⚡ Restock recommendations are boosted for this event
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABC CLASSIFICATION ───────────────────────────── */}
      {tab === 'abc' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {['A','B','C'].map((cls) => {
              const count = abcData.filter((d: any) => d.class === cls).length
              const revenue = abcData.filter((d: any) => d.class === cls).reduce((s: number, d: any) => s + d.revenue, 0)
              const clsConfig = { A: { border: 'border-l-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-400', desc: '80% revenue — max attention, 99% service level' }, B: { border: 'border-l-blue-500', bg: 'bg-blue-100 dark:bg-blue-950/50', text: 'text-blue-700 dark:text-blue-400', desc: 'Next 15% revenue — moderate attention' }, C: { border: 'border-l-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600', desc: 'Bottom 5% revenue — minimal attention' } }[cls]!
              return (
                <div key={cls} className={cn('rounded-xl border border-l-4 p-4', clsConfig.border)}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center font-bold', clsConfig.bg, clsConfig.text)}>{cls}</span>
                    <div><p className="text-2xl font-bold">{count} <span className="text-sm font-normal text-muted-foreground">SKUs</span></p></div>
                  </div>
                  <p className="text-sm font-semibold">${revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{clsConfig.desc}</p>
                </div>
              )
            })}
          </div>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>{['Class','SKU','Revenue (90d)','Units','Cumulative %'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>)}</tr>
              </thead>
              <tbody>
                {abcLoading ? [...Array(5)].map((_,i) => <tr key={i} className="border-t">{[...Array(5)].map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-16" /></td>)}</tr>)
                : abcData.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No sales data yet.</td></tr>
                : abcData.map((item: any, i: number) => {
                  const c = { A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400', B: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400', C: 'bg-gray-100 text-gray-600 dark:bg-gray-800' }[item.class as 'A'|'B'|'C']
                  return (
                    <tr key={i} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3"><span className={cn('rounded px-2 py-0.5 text-xs font-bold', c)}>{item.class}</span></td>
                      <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                      <td className="px-4 py-3 font-semibold">${item.revenue.toFixed(0)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.units}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${item.cumulativeRevenuePct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{item.cumulativeRevenuePct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── OVERSTOCK ────────────────────────────────────── */}
      {tab === 'overstock' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 dark:bg-violet-950/10 dark:border-violet-900 p-4 text-xs text-violet-700 dark:text-violet-400">
            <strong>FBA IPI Score Note:</strong> Amazon penalises excess inventory. Target 45-day DOI.
            Items above 90 days risk long-term storage fees after 365 days at FC.
          </div>
          {overstockLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> :
          overstockData.length === 0 ? (
            <div className="rounded-xl border p-12 text-center">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">No overstock issues — all within 90-day DOI</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>{['SKU','Channel','Stock','DOI','Excess Units','Recommended Action'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {overstockData.map((item: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3"><p className="font-medium text-xs">{item.productName}</p><p className="font-mono text-[10px] text-muted-foreground">{item.sku}</p></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{CHANNEL_LABELS[item.channel] ?? item.channel}</td>
                      <td className="px-4 py-3 font-bold text-violet-600">{item.currentStock}</td>
                      <td className="px-4 py-3 font-bold text-violet-600">{item.doi === 999 ? '∞' : `${item.doi}d`}</td>
                      <td className="px-4 py-3 text-muted-foreground">~{item.excessUnits}</td>
                      <td className="px-4 py-3 text-xs max-w-xs"><span className={item.doi > 180 ? 'text-red-600' : 'text-amber-600'}>{item.action}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── EXPIRY DATES ─────────────────────────────────── */}
      {tab === 'expiry' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-orange-200 bg-orange-50/50 dark:bg-orange-950/10 dark:border-orange-900 p-4 text-xs text-orange-700 dark:text-orange-300">
            <strong>For SVA Organics products (oils, natural products):</strong> Set expiry dates below so the engine can alert you
            when stock may not sell before it expires. Critical when DOI &gt; days until expiry.
          </div>
          {expiryLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> :
          expiryData.length === 0 ? (
            <div className="rounded-xl border p-12 text-center">
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">No expiry risk products</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Set expiry dates on products to enable this analysis</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>{['SKU','Stock','DOI','Days to Expiry','Risk','Action / Message','Set Expiry'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {expiryData.map((item: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3"><p className="font-medium text-xs">{item.productName}</p><p className="font-mono text-[10px] text-muted-foreground">{item.sku}</p></td>
                      <td className="px-4 py-3 font-bold">{item.currentStock}</td>
                      <td className="px-4 py-3 tabular-nums">{item.doi === 999 ? '∞' : `${item.doi}d`}</td>
                      <td className="px-4 py-3">
                        <span className={cn('font-bold', item.expiryDaysLeft <= 0 ? 'text-red-600' : item.expiryDaysLeft < 90 ? 'text-orange-600' : 'text-amber-600')}>
                          {item.expiryDaysLeft <= 0 ? 'EXPIRED' : `${item.expiryDaysLeft}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium',
                          item.expiryRisk === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}>
                          {item.expiryRisk}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs text-orange-700 dark:text-orange-400">{item.expiryMessage}</td>
                      <td className="px-4 py-3">
                        {editExpiry?.sku === item.sku ? (
                          <div className="flex items-center gap-1">
                            <input type="date" value={editExpiry.value}
                              onChange={e => setEditExpiry({ sku: item.sku, value: e.target.value })}
                              className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary w-32" />
                            <button onClick={() => saveExpiry({ sku: item.sku, expiryDate: editExpiry.value })}
                              disabled={savingExpiry} className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50">
                              {savingExpiry ? '...' : 'Save'}
                            </button>
                            <button onClick={() => setEditExpiry(null)} className="rounded border px-2 py-1 text-xs hover:bg-muted">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditExpiry({ sku: item.sku, value: '' })}
                            className="rounded border px-2 py-1 text-xs hover:bg-muted">Set Date</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LONG-TERM STORAGE ────────────────────────────── */}
      {tab === 'storage' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center text-xs">
            {[
              { days: '180d', label: 'Monitor', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
              { days: '270d', label: 'Take Action', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' },
              { days: '365d', label: 'Fees Active', color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
            ].map(s => (
              <div key={s.days} className={cn('rounded-xl border p-3', s.color)}>
                <p className="text-lg font-bold">{s.days}</p>
                <p className="font-medium">{s.label}</p>
                <p className="text-xs opacity-70">at Amazon FC</p>
              </div>
            ))}
          </div>
          {storageLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> :
          storageData.length === 0 ? (
            <div className="rounded-xl border p-12 text-center">
              <Shield className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">No long-term storage risk detected</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>{['SKU','Channel','Stock','Days at FC','Risk','Est. Fee Date','Action'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {storageData.map((item: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3"><p className="font-medium text-xs">{item.productName}</p><p className="font-mono text-[10px] text-muted-foreground">{item.sku}</p></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{CHANNEL_LABELS[item.channel] ?? item.channel}</td>
                      <td className="px-4 py-3 font-bold">{item.currentStock}</td>
                      <td className="px-4 py-3">
                        <span className={cn('font-bold', item.daysAtFc >= 365 ? 'text-red-600' : item.daysAtFc >= 270 ? 'text-orange-600' : 'text-amber-600')}>
                          {item.daysAtFc}d
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', LT_RISK[item.ltStorageRisk as keyof typeof LT_RISK] ?? LT_RISK.OK)}>
                          {item.ltStorageRisk}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {item.estimatedFeeDate ? new Date(item.estimatedFeeDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs">
                        <span className={item.ltStorageRisk === 'CRITICAL' ? 'text-red-600' : item.ltStorageRisk === 'HIGH' ? 'text-orange-600' : 'text-amber-600'}>
                          {item.ltStorageMessage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
