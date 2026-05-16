'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { ArrowLeft, RefreshCw, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, Package, Zap, BarChart3, Info } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  CRITICAL:  { label: 'Critical',  color: 'text-red-700 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-950/50',    dot: 'bg-red-500' },
  HIGH:      { label: 'High',      color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-950/50', dot: 'bg-orange-500' },
  MEDIUM:    { label: 'Medium',    color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/50', dot: 'bg-amber-500' },
  LOW:       { label: 'Low',       color: 'text-blue-700 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-950/50',   dot: 'bg-blue-400' },
  OK:        { label: 'OK',        color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/50', dot: 'bg-emerald-500' },
  OVERSTOCK: { label: 'Overstock', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-950/50', dot: 'bg-violet-500' },
}

const ABC_CONFIG: Record<string, { color: string; bg: string; desc: string }> = {
  A: { color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-950/50', desc: '80% of revenue — tightest control' },
  B: { color: 'text-blue-700',    bg: 'bg-blue-100 dark:bg-blue-950/50',       desc: 'Next 15% — moderate attention' },
  C: { color: 'text-gray-600',    bg: 'bg-gray-100 dark:bg-gray-800',          desc: 'Bottom 5% — minimal attention' },
}

const CHANNELS = ['AMAZON_US', 'AMAZON_IN', 'AMAZON_AE', 'AMAZON_UK', 'AMAZON_AU']
const CHANNEL_LABELS: Record<string, string> = {
  AMAZON_US: 'Amazon US', AMAZON_IN: 'Amazon IN', AMAZON_AE: 'Amazon AE',
  AMAZON_UK: 'Amazon UK', AMAZON_AU: 'Amazon AU',
}

export default function InventoryIntelligencePage() {
  const [tab, setTab] = useState<'restock' | 'abc' | 'overstock'>('restock')
  const [channelFilter, setChannelFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const qc = useQueryClient()

  const { data: recData, isLoading: recLoading, refetch } = useQuery({
    queryKey: ['intelligence', 'recommendations', channelFilter],
    queryFn: () => api.get(`/inventory/intelligence/recommendations${channelFilter ? `?channel=${channelFilter}` : ''}`).then((r) => r.data.data),
    enabled: tab === 'restock',
  })

  const { data: abcData = [], isLoading: abcLoading } = useQuery({
    queryKey: ['intelligence', 'abc'],
    queryFn: () => api.get('/inventory/intelligence/abc').then((r) => r.data.data),
    enabled: tab === 'abc',
  })

  const { data: overstockData = [], isLoading: overstockLoading } = useQuery({
    queryKey: ['intelligence', 'overstock'],
    queryFn: () => api.get('/inventory/intelligence/overstock').then((r) => r.data.data),
    enabled: tab === 'overstock',
  })

  const { mutate: autoUpdate, isPending: updating } = useMutation({
    mutationFn: () => api.post('/inventory/intelligence/auto-update', { channel: channelFilter || undefined }),
    onSuccess: (res) => {
      toast.success(`Updated reorder points for ${res.data.data.updated} SKUs`)
      qc.invalidateQueries({ queryKey: ['intelligence'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: () => toast.error('Failed to update reorder points'),
  })

  const recommendations = recData?.recommendations ?? []
  const stats = recData?.stats ?? {}

  const filtered = recommendations.filter((r: any) => !urgencyFilter || r.urgency === urgencyFilter)

  const tabs = [
    { key: 'restock', label: 'Restock Alerts', icon: AlertTriangle },
    { key: 'abc', label: 'ABC Analysis', icon: BarChart3 },
    { key: 'overstock', label: 'Overstock Risk', icon: Package },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/inventory" className="rounded-lg border p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Inventory Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Amazon FBA-optimised: safety stock, velocity-based reorder points, ABC classification
          </p>
        </div>
        <button onClick={() => autoUpdate()} disabled={updating}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {updating ? 'Updating...' : 'Auto-Update Reorder Points'}
        </button>
      </div>

      {/* Logic explanation banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4 text-sm">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-medium">How this works (Amazon top seller logic)</p>
            <p className="text-xs leading-relaxed">
              <strong>Reorder Point</strong> = (ADU × Lead Time) + Safety Stock &nbsp;|&nbsp;
              <strong>Safety Stock</strong> = 1.645 × √LeadTime × StdDev(daily sales) &nbsp;|&nbsp;
              <strong>Target DOI</strong> = 45 days (FBA sweet spot — avoids long-term storage fees) &nbsp;|&nbsp;
              <strong>Auto-updates</strong> after every Amazon sync
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {tab === 'restock' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Critical', key: 'critical', urgency: 'CRITICAL' },
            { label: 'High',     key: 'high',     urgency: 'HIGH' },
            { label: 'Medium',   key: 'medium',   urgency: 'MEDIUM' },
            { label: 'Overstock',key: 'overstock',urgency: 'OVERSTOCK' },
            { label: 'Healthy',  key: 'ok',       urgency: '' },
          ].map((s) => {
            const cfg = URGENCY_CONFIG[s.urgency] ?? URGENCY_CONFIG.OK
            return (
              <button key={s.key}
                onClick={() => setUrgencyFilter(urgencyFilter === s.urgency ? '' : s.urgency)}
                className={cn('rounded-xl border p-3 text-left transition-all hover:shadow-sm',
                  urgencyFilter === s.urgency && 'ring-2 ring-primary')}>
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-2xl font-bold mt-1">{recLoading ? '—' : (stats as any)[s.key] ?? 0}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <t.icon className="h-4 w-4" />{t.label}
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
            <button onClick={() => refetch()} className="rounded-lg border p-1.5 hover:bg-muted transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* ── Restock Recommendations ─────────────────────── */}
      {tab === 'restock' && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {['SKU / Product', 'Channel', 'In Stock', 'ADU/day', 'DOI', 'Reorder Point', 'Order Qty', 'Urgency'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-t">
                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-16" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No inventory data yet.</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">Connect Amazon and sync to generate recommendations.</p>
                  </td>
                </tr>
              ) : filtered.map((r: any) => {
                const cfg = URGENCY_CONFIG[r.urgency] ?? URGENCY_CONFIG.OK
                return (
                  <tr key={`${r.sku}-${r.channel}`}
                    className={cn('border-t hover:bg-muted/20 transition-colors',
                      r.urgency === 'CRITICAL' && 'bg-red-50/50 dark:bg-red-950/10')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{r.productName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{r.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                    <td className="px-4 py-3">
                      <span className={cn('font-bold', r.currentStock === 0 ? 'text-red-600' : r.currentStock <= r.reorderPoint ? 'text-amber-600' : 'text-foreground')}>
                        {r.currentStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.adu.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('font-bold tabular-nums',
                        r.doi <= 7 ? 'text-red-600' : r.doi <= 14 ? 'text-orange-600' :
                        r.doi <= 30 ? 'text-amber-600' : r.doi >= 90 ? 'text-violet-600' : 'text-emerald-600')}>
                        {r.doi === 999 ? '∞' : `${r.doi}d`}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.reorderPoint}</td>
                    <td className="px-4 py-3">
                      {r.recommendedOrderQty > 0 ? (
                        <span className="font-bold text-primary">{formatNumber(r.recommendedOrderQty)} units</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ABC Classification ───────────────────────────── */}
      {tab === 'abc' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {['A', 'B', 'C'].map((cls) => {
              const cfg = ABC_CONFIG[cls]
              const count = abcData.filter((d: any) => d.class === cls).length
              return (
                <div key={cls} className={cn('rounded-xl border p-4', `border-l-4`, cls === 'A' ? 'border-l-emerald-500' : cls === 'B' ? 'border-l-blue-500' : 'border-l-gray-400')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('h-7 w-7 rounded-lg flex items-center justify-center font-bold text-sm', cfg.bg, cfg.color)}>{cls}</span>
                    <span className="text-2xl font-bold">{count}</span>
                    <span className="text-sm text-muted-foreground">SKUs</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{cfg.desc}</p>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Class', 'SKU', 'Revenue (90d)', 'Units', 'Cumulative %'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {abcLoading ? (
                  [...Array(5)].map((_, i) => <tr key={i} className="border-t">{[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-16" /></td>)}</tr>)
                ) : abcData.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No sales data yet. Sync orders to see ABC classification.</td></tr>
                ) : abcData.map((item: any, i: number) => {
                  const cfg = ABC_CONFIG[item.class]
                  return (
                    <tr key={i} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', cfg.bg, cfg.color)}>{item.class}</span>
                      </td>
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

      {/* ── Overstock Analysis ───────────────────────────── */}
      {tab === 'overstock' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 dark:bg-violet-950/10 dark:border-violet-900 p-4 text-sm">
            <p className="font-medium text-violet-800 dark:text-violet-300">About FBA Overstock</p>
            <p className="text-xs text-violet-700 dark:text-violet-400 mt-1">
              Amazon charges long-term storage fees for units in FBA warehouses over 365 days. Items with DOI &gt; 90 days
              are flagged here. Target 45-day DOI for optimal IPI score and storage cost balance.
            </p>
          </div>

          {overstockLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          ) : overstockData.length === 0 ? (
            <div className="rounded-xl border p-12 text-center">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">No overstock issues detected</p>
              <p className="text-sm text-muted-foreground mt-1">All products are within healthy DOI range</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {['SKU', 'Channel', 'In Stock', 'DOI', 'Excess Units', 'Recommended Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overstockData.map((item: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{CHANNEL_LABELS[item.channel] ?? item.channel}</td>
                      <td className="px-4 py-3 font-bold text-violet-600">{item.currentStock}</td>
                      <td className="px-4 py-3">
                        <span className={cn('font-bold', item.doi > 180 ? 'text-red-600' : 'text-violet-600')}>
                          {item.doi === 999 ? '∞' : `${item.doi}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.excessUnits > 0 ? `~${item.excessUnits}` : '—'}</td>
                      <td className="px-4 py-3 text-xs max-w-[280px]">
                        <span className={cn(item.doi > 180 ? 'text-red-600' : 'text-amber-600')}>
                          {item.action}
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
