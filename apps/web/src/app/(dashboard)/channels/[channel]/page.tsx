'use client'
export const dynamic = 'force-dynamic'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn, STATUS_COLORS } from '@/lib/utils'
import { useParams, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  RefreshCw, TrendingUp, ShoppingCart, Package, Clock,
  ArrowLeft, Loader2, ChevronRight, AlertTriangle, X, MapPin,
  Calendar, ChevronLeft, ChevronDown,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const CHANNEL_META: Record<string, { label: string; logo: string; color: string }> = {
  WALMART:     { label: 'Walmart',          logo: 'W', color: '#007DC6' },
  AMAZON_US:   { label: 'Amazon US',        logo: 'A', color: '#FF9900' },
  AMAZON_IN:   { label: 'Amazon India',     logo: 'A', color: '#FF9900' },
  AMAZON_AE:   { label: 'Amazon UAE',       logo: 'A', color: '#FF9900' },
  AMAZON_UK:   { label: 'Amazon UK',        logo: 'A', color: '#FF9900' },
  AMAZON_AU:   { label: 'Amazon Australia', logo: 'A', color: '#FF9900' },
  TIKTOK_SHOP: { label: 'TikTok Shop',      logo: 'T', color: '#FE2C55' },
  SHOPIFY:     { label: 'Shopify',          logo: 'S', color: '#96BF48' },
  MYNTRA:      { label: 'Myntra',           logo: 'M', color: '#FF3F6C' },
  FLIPKART:    { label: 'Flipkart',         logo: 'F', color: '#2874F0' },
}

const SYNC_ROUTES: Record<string, string> = {
  WALMART: '/walmart/sync', TIKTOK_SHOP: '/tiktok/sync',
  AMAZON_US: '/amazon/AMAZON_US/sync', AMAZON_IN: '/amazon/AMAZON_IN/sync',
  AMAZON_AE: '/amazon/AMAZON_AE/sync', AMAZON_UK: '/amazon/AMAZON_UK/sync',
  AMAZON_AU: '/amazon/AMAZON_AU/sync',
}

// ── Date range presets ────────────────────────────────
// Use LOCAL midnight so "Yesterday" / "Today" match the user's clock,
// not UTC (which would shift by +5:30 for IST users).
function localDay(offsetDays = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(0, 0, 0, 0)
  return d
}
function localDayEnd(offsetDays = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(23, 59, 59, 999)
  return d
}

const PRESETS = [
  { label: 'Today',         getRange: () => ({ start: localDay(0),    end: localDayEnd(0) }) },
  { label: 'Yesterday',     getRange: () => ({ start: localDay(-1),   end: localDayEnd(-1) }) },
  // Last N days = N complete past days, NOT including today (matches Walmart seller dashboard)
  { label: 'Last 7 days',   getRange: () => ({ start: localDay(-7),   end: localDayEnd(-1) }) },
  { label: 'Last 30 days',  getRange: () => ({ start: localDay(-30),  end: localDayEnd(-1) }) },
  { label: 'This month',    getRange: () => {
    const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0), end: localDayEnd(0) }
  }},
  { label: 'Last month',    getRange: () => {
    const d = new Date()
    const s = new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0)
    const e = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999)
    return { start: s, end: e }
  }},
  { label: 'Last 90 days',  getRange: () => ({ start: localDay(-90),  end: localDayEnd(-1) }) },
  { label: 'Last 180 days', getRange: () => ({ start: localDay(-180), end: localDayEnd(-1) }) },
]

const FULFILLMENT_COLORS: Record<string, string> = {
  UNFULFILLED: 'bg-gray-100 text-gray-700',
  PARTIAL:     'bg-amber-100 text-amber-700',
  FULFILLED:   'bg-emerald-100 text-emerald-700',
}

function DateRangePicker({ start, end, onChange }: { start: Date; end: Date; onChange: (s: Date, e: Date) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Use local date parts for display label (IST-safe)
  const startStr = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`
  const endStr   = `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`
  const label = startStr === endStr ? fmtUTC(start) : `${fmtUTC(start)} – ${fmtUTC(end)}`

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[340px] rounded-xl border bg-background shadow-xl p-4 space-y-3">
          {/* Presets */}
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map(p => {
              const r = p.getRange()
              const active = r.start.toDateString() === start.toDateString() && r.end.toDateString() === end.toDateString()
              return (
                <button key={p.label} onClick={() => { onChange(r.start, r.end); setOpen(false) }}
                  className={cn('rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}>
                  {p.label}
                </button>
              )
            })}
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">From</p>
                <input
                  id="dp-from"
                  type="date"
                  defaultValue={format(start, 'yyyy-MM-dd')}
                  key={start.toISOString()}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">To</p>
                <input
                  id="dp-to"
                  type="date"
                  defaultValue={format(end, 'yyyy-MM-dd')}
                  key={end.toISOString()}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <button onClick={() => {
              const fromEl = document.getElementById('dp-from') as HTMLInputElement
              const toEl   = document.getElementById('dp-to')   as HTMLInputElement
              const s = fromEl?.value
              const e2 = toEl?.value
              if (s && e2 && s <= e2) {
                // Parse as UTC midnight so dates are timezone-independent
                onChange(new Date(s + 'T00:00:00Z'), new Date(e2 + 'T23:59:59Z'))
                setOpen(false)
              }
            }}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
              Apply Custom Range
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
// Use local date components so the label matches the user's calendar (IST-correct)
const fmtUTC = (d: Date) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

export default function ChannelPage() {
  const params  = useParams()
  const router  = useRouter()
  const channel = (params.channel as string).toUpperCase()
  const meta    = CHANNEL_META[channel] ?? { label: channel, logo: channel[0], color: '#6B7280' }
  const qc      = useQueryClient()

  const [tab, setTab]       = useState<'overview' | 'orders' | 'inventory' | 'profit'>('overview')
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter]   = useState('')
  const [orderFulfillment, setOrderFulfillment] = useState('')
  const [orderPage, setOrderPage]     = useState(1)

  // Inventory filters
  const [invSearch, setInvSearch]     = useState('')
  const [invFulfill, setInvFulfill]   = useState('') // WFS | SELLER | ''
  const [invStock, setInvStock]       = useState('') // low | ok | ''
  const [invSort, setInvSort]         = useState('name') // name | qty-asc | qty-desc

  // Date range state — default last 30 days (local timezone, matches Walmart: 30 complete past days)
  const [dateRange, setDateRange] = useState({
    start: localDay(-30),
    end:   localDayEnd(-1),
  })

  const { data: channelConfig } = useQuery({
    queryKey: ['channel-config', channel],
    queryFn: () => api.get('/channels').then(r => (r.data.data as any[]).find(c => c.channel === channel) ?? null),
  })

  // Stats using exact date range
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['channel-stats', channel, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => api.get(`/orders/stats?channel=${channel}&startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`).then(r => r.data.data),
    staleTime: 60_000,
  })

  // Orders table
  const { data: pagedOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['channel-orders', channel, orderPage, search, statusFilter, orderFulfillment, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => {
      const p = new URLSearchParams({ channel, limit: '50', page: String(orderPage) })
      if (search) p.set('search', search)
      if (statusFilter) p.set('status', statusFilter)
      if (orderFulfillment) p.set('fulfillmentStatus', orderFulfillment)
      // Date filter for orders table
      p.set('startDate', dateRange.start.toISOString())
      p.set('endDate', dateRange.end.toISOString())
      return api.get(`/orders?${p}`).then(r => r.data)
    },
    enabled: tab === 'orders',
  })

  const { data: orderDetail } = useQuery({
    queryKey: ['order-detail', selected?.id],
    queryFn: () => api.get(`/orders/${selected.id}`).then(r => r.data.data),
    enabled: !!selected?.id,
  })

  const { data: inventoryData } = useQuery({
    queryKey: ['channel-inventory', channel],
    queryFn: () => api.get('/inventory/products').then(r => r.data.data),
    enabled: tab === 'inventory',
  })

  const { data: profitData, isLoading: profitLoading } = useQuery({
    queryKey: ['channel-profit', channel, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => api.get(`/orders/profit?channel=${channel}&startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`).then(r => r.data.data),
    enabled: tab === 'profit',
    staleTime: 60_000,
  })

  const handleSync = async () => {
    setSyncing(true)
    try {
      const route = SYNC_ROUTES[channel]
      if (!route) { toast.error('Sync not supported for this channel'); return }
      const { data } = await api.post(route)
      const orders = data.data?.orders?.synced ?? data.data?.synced ?? 0
      toast.success(`Sync started — ${orders} new orders`)
      qc.invalidateQueries({ queryKey: ['channel-stats', channel] })
      qc.invalidateQueries({ queryKey: ['channel-orders', channel] })
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const stats = statsData
  const isConnected = channelConfig?.status === 'CONNECTED'
  const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => router.back()} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm"
            style={{ backgroundColor: meta.color }}>
            {meta.logo}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{meta.label}</h1>
            <p className={cn('text-xs font-medium', isConnected ? 'text-green-600' : 'text-muted-foreground')}>
              {isConnected ? '● Connected' : '○ Not connected'}
              {channelConfig?.lastSyncAt && (
                <span className="ml-2 text-muted-foreground font-normal">
                  Last sync {format(new Date(channelConfig.lastSyncAt), 'MMM d, h:mm a')}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Date range picker */}
          <DateRangePicker
            start={dateRange.start}
            end={dateRange.end}
            onChange={(s, e) => setDateRange({ start: s, end: e })}
          />
          {isConnected && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        {(['overview', 'orders', 'inventory', 'profit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}>
{t === 'profit' ? '💰 Profit' : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'orders' && stats && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {stats.allTime?.orderCount?.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: `Revenue (${daysDiff}d)`,
                value: statsLoading ? null : formatCurrency(stats?.revenue ?? 0),
                sub:   statsLoading ? null : `${formatNumber(stats?.orderCount ?? 0)} orders`,
                icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30'
              },
              {
                label: `Units Sold (${daysDiff}d)`,
                value: statsLoading ? null : formatNumber(stats?.totalUnits ?? stats?.orderCount ?? 0),
                sub:   statsLoading ? null : `${formatNumber(stats?.orderCount ?? 0)} orders`,
                icon: Package, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30'
              },
              {
                label: 'Avg Order Value',
                value: statsLoading ? null : formatCurrency(stats?.aov ?? 0),
                sub:   'per order',
                icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30'
              },
              {
                label: 'Pending Orders',
                value: statsLoading ? null : String(stats?.pending ?? 0),
                sub:   'need action',
                icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30',
                alert: (stats?.pending ?? 0) > 0,
              },
            ].map(card => (
              <div key={card.label} className={cn('rounded-xl border p-5', card.alert && 'border-amber-300')}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    {card.value === null
                      ? <div className="mt-1 h-8 w-24 rounded bg-muted animate-pulse" />
                      : <p className="mt-1 text-2xl font-bold">{card.value}</p>
                    }
                    {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
                  </div>
                  <div className={cn('rounded-xl p-2.5', card.bg)}>
                    <card.icon className={cn('h-5 w-5', card.color)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* All-time strip */}
          {stats && (
            <div className="rounded-xl border bg-muted/30 px-5 py-3 flex items-center gap-6 text-sm flex-wrap">
              <span className="text-muted-foreground font-medium">All Time:</span>
              <span><strong>{formatCurrency(stats.allTime?.revenue ?? 0)}</strong> revenue</span>
              <span><strong>{formatNumber(stats.allTime?.orderCount ?? 0)}</strong> orders</span>
              <span className="text-xs text-muted-foreground ml-auto">
                Showing {fmtUTC(dateRange.start)} – {fmtUTC(dateRange.end)} above ↑
              </span>
            </div>
          )}

          {/* Chart + Top Products */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">
                  Revenue — {fmtUTC(dateRange.start)} to {fmtUTC(dateRange.end)}
                </h2>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: meta.color }}>{meta.label}</span>
              </div>
              {statsLoading ? (
                <div className="h-56 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (stats?.chart ?? []).length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats!.chart}>
                      <defs>
                        <linearGradient id={`grad-${channel}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={meta.color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={meta.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }}
                        tickFormatter={d => { const [,m,day] = d.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]} ${parseInt(day)}` }} />
                      <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                        labelFormatter={d => { const [y,m,day]=d.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]} ${parseInt(day)}, ${y}` }} />
                      <Area type="monotone" dataKey="total" stroke={meta.color} strokeWidth={2} fill={`url(#grad-${channel})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No orders in this period</div>
              )}
            </div>

            <div className="rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-4">Top Products by Revenue</h2>
              {statsLoading ? (
                <div className="space-y-3">{[...Array(6)].map((_,i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
              ) : (stats?.topSkus ?? []).length > 0 ? (
                <div className="space-y-3">
                  {stats!.topSkus.map((sku: any, i: number) => (
                    <div key={sku.sku} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{sku.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{sku.sku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold">{formatCurrency(sku.revenue)}</p>
                        <p className="text-xs text-muted-foreground">×{sku.qty}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data in this period</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="flex gap-5">
          <div className={cn('flex-1 space-y-4 min-w-0', selected && 'hidden xl:block')}>
            <div className="flex flex-wrap items-center gap-2">
              <input value={search} onChange={e => { setSearch(e.target.value); setOrderPage(1) }}
                placeholder="Search order #..."
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary flex-1 min-w-[180px] max-w-xs" />
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setOrderPage(1) }}
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Statuses</option>
                {['PENDING','PROCESSING','SHIPPED','DELIVERED','COMPLETED','CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={orderFulfillment} onChange={e => { setOrderFulfillment(e.target.value); setOrderPage(1) }}
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Fulfillment</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="UNFULFILLED">Unfulfilled</option>
                <option value="PARTIAL">Partial</option>
              </select>
              <span className="ml-auto text-sm text-muted-foreground">
                {pagedOrders?.total?.toLocaleString() ?? '…'} orders in period
              </span>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>{['Order #','Status','Fulfillment','Total','Date',''].map(h =>
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {ordersLoading ? [...Array(8)].map((_,i) => (
                    <tr key={i} className="border-t">{[...Array(6)].map((_,j) =>
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-20"/></td>
                    )}</tr>
                  )) : (pagedOrders?.data ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30"/>No orders in this period
                    </td></tr>
                  ) : (pagedOrders?.data ?? []).map((order: any) => (
                    <tr key={order.id} onClick={() => setSelected(order)}
                      className={cn('border-t hover:bg-muted/20 cursor-pointer transition-colors', selected?.id === order.id && 'bg-muted/30')}>
                      <td className="px-4 py-3 font-medium text-primary">{order.orderNumber}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700')}>{order.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs', FULFILLMENT_COLORS[order.fulfillmentStatus] ?? 'bg-gray-100 text-gray-700')}>{order.fulfillmentStatus ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">{formatCurrency(Number(order.total), order.currency)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(order.orderedAt), 'MMM d, yyyy h:mm a')}</td>
                      <td className="px-4 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4"/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagedOrders?.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button disabled={orderPage === 1} onClick={() => setOrderPage(p => p-1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Prev</button>
                <span className="text-sm text-muted-foreground">Page {orderPage} of {pagedOrders.totalPages}</span>
                <button disabled={orderPage === pagedOrders.totalPages} onClick={() => setOrderPage(p => p+1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Next</button>
              </div>
            )}
          </div>

          {selected && (
            <div className="w-full xl:w-[400px] shrink-0 rounded-xl border bg-background flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div><p className="font-semibold">{selected.orderNumber}</p><p className="text-xs text-muted-foreground">{meta.label}</p></div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4"/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Total',       value: formatCurrency(Number(selected.total), selected.currency) },
                    { label: 'Date',        value: format(new Date(selected.orderedAt), 'MMM d, yyyy') },
                    { label: 'Payment',     value: selected.paymentStatus ?? '—' },
                    { label: 'Fulfillment', value: selected.fulfillmentStatus ?? '—' },
                  ].map(f => (
                    <div key={f.label} className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <p className="font-medium mt-0.5 text-sm">{f.value}</p>
                    </div>
                  ))}
                </div>

                {(orderDetail ?? selected)?.shippingAddress && (() => {
                  const a = (orderDetail ?? selected).shippingAddress as any
                  return (
                    <div className="rounded-lg border p-4 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <MapPin className="h-3 w-3"/>Ship To
                      </p>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {a.name  && <p className="font-medium text-foreground">{a.name}</p>}
                        {a.line1 && <p>{a.line1}</p>}
                        {[a.city, a.state, a.zip].filter(Boolean).join(', ') && <p>{[a.city, a.state, a.zip].filter(Boolean).join(', ')}</p>}
                        {a.country && <p>{a.country}</p>}
                      </div>
                    </div>
                  )
                })()}

                <div className="rounded-lg border overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/40 border-b">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>
                  </div>
                  <div className="divide-y">
                    {((orderDetail ?? selected)?.items ?? []).map((item: any, i: number) => (
                      <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                        </div>
                        <div className="text-right text-sm shrink-0">
                          <p className="font-medium">{formatCurrency(Number(item.total), selected.currency)}</p>
                          <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory tab */}
      {tab === 'inventory' && (() => {
        // Apply client-side filters
        const allItems = inventoryData ?? []
        const filtered = allItems.filter((product: any) => {
          const items     = product.inventoryItems ?? []
          const ci        = items.find((i: any) => i.channel === channel) ?? items[0]
          const qty       = ci?.quantity ?? 0
          const reorder   = ci?.reorderPoint ?? 10
          const low       = qty <= reorder
          const meta2     = (product.customFields as any) ?? {}
          const ft        = meta2.fulfillmentType ?? (meta2.wfsQty > 0 ? 'WFS' : 'SELLER')

          if (invSearch && !product.sku.toLowerCase().includes(invSearch.toLowerCase()) &&
                           !product.name.toLowerCase().includes(invSearch.toLowerCase())) return false
          if (invFulfill && ft !== invFulfill) return false
          if (invStock === 'low' && !low) return false
          if (invStock === 'ok'  && low)  return false
          return true
        })

        const sorted = [...filtered].sort((a: any, b: any) => {
          const getQty = (p: any) => { const ci = (p.inventoryItems ?? []).find((i: any) => i.channel === channel) ?? p.inventoryItems?.[0]; return ci?.quantity ?? 0 }
          if (invSort === 'qty-asc')  return getQty(a) - getQty(b)
          if (invSort === 'qty-desc') return getQty(b) - getQty(a)
          return a.name.localeCompare(b.name)
        })

        return (
          <div className="space-y-3">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <input value={invSearch} onChange={e => setInvSearch(e.target.value)}
                placeholder="Search SKU or product..."
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary flex-1 min-w-[180px] max-w-xs" />

              {/* Fulfillment type */}
              <div className="flex rounded-lg border overflow-hidden text-sm">
                {[{v:'',l:'All'},{v:'WFS',l:'WFS'},{v:'SELLER',l:'Seller'}].map(opt => (
                  <button key={opt.v} onClick={() => setInvFulfill(opt.v)}
                    className={cn('px-3 py-2 font-medium transition-colors',
                      invFulfill === opt.v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}>
                    {opt.l}
                  </button>
                ))}
              </div>

              {/* Stock status */}
              <div className="flex rounded-lg border overflow-hidden text-sm">
                {[{v:'',l:'All Stock'},{v:'ok',l:'In Stock'},{v:'low',l:'Low Stock'}].map(opt => (
                  <button key={opt.v} onClick={() => setInvStock(opt.v)}
                    className={cn('px-3 py-2 font-medium transition-colors',
                      invStock === opt.v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}>
                    {opt.l}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <select value={invSort} onChange={e => setInvSort(e.target.value)}
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary ml-auto">
                <option value="name">Sort: Name A–Z</option>
                <option value="qty-desc">Sort: Most Stock</option>
                <option value="qty-asc">Sort: Least Stock</option>
              </select>

              <span className="text-sm text-muted-foreground">{sorted.length} items</span>
            </div>

            {/* Summary chips */}
            {!inventoryData ? null : (
              <div className="flex gap-3 text-xs flex-wrap">
                {[
                  { label: 'Total SKUs',  value: allItems.length, color: 'bg-muted text-muted-foreground' },
                  { label: 'WFS items',   value: allItems.filter((p: any) => ((p.customFields as any)?.fulfillmentType ?? (((p.customFields as any)?.wfsQty ?? 0) > 0 ? 'WFS' : 'SELLER')) === 'WFS').length, color: 'bg-blue-100 text-blue-700' },
                  { label: 'Seller items',value: allItems.filter((p: any) => ((p.customFields as any)?.fulfillmentType ?? (((p.customFields as any)?.wfsQty ?? 0) > 0 ? 'WFS' : 'SELLER')) === 'SELLER').length, color: 'bg-gray-100 text-gray-700' },
                  { label: 'Low Stock',   value: allItems.filter((p: any) => { const ci = (p.inventoryItems ?? []).find((i: any) => i.channel === channel) ?? p.inventoryItems?.[0]; return (ci?.quantity ?? 0) <= (ci?.reorderPoint ?? 10) }).length, color: 'bg-amber-100 text-amber-700' },
                ].map(chip => (
                  <span key={chip.label} className={cn('rounded-full px-2.5 py-1 font-medium', chip.color)}>
                    {chip.label}: {chip.value}
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>{['SKU','Product','Seller Qty','WFS Qty','Total','Type','Status'].map(h =>
                    <th key={h} className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {!inventoryData ? [...Array(8)].map((_,i) => (
                    <tr key={i} className="border-t">{[...Array(7)].map((_,j) =>
                      <td key={j} className="px-3 py-3"><div className="h-4 rounded bg-muted animate-pulse w-16"/></td>
                    )}</tr>
                  )) : sorted.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30"/>No items match filters
                    </td></tr>
                  ) : sorted.map((product: any) => {
                    const items = product.inventoryItems ?? []
                    const ci    = items.find((i: any) => i.channel === channel) ?? items[0]
                    const qty   = ci?.quantity ?? 0
                    const reorder = ci?.reorderPoint ?? 10
                    const low   = qty <= reorder
                    const meta2 = (product.customFields as any) ?? {}
                    const sellerQty = meta2.sellerQty ?? 0
                    const wfsQty    = meta2.wfsQty    ?? 0
                    const ft  = meta2.fulfillmentType ?? (wfsQty > 0 ? 'WFS' : 'SELLER')
                    return (
                      <tr key={product.id} className="border-t hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground max-w-[120px] truncate">{product.sku}</td>
                        <td className="px-3 py-3 font-medium max-w-[180px] truncate text-xs">{product.name}</td>
                        <td className="px-3 py-3 tabular-nums text-xs">{sellerQty.toLocaleString()}</td>
                        <td className="px-3 py-3 tabular-nums text-xs">{wfsQty.toLocaleString()}</td>
                        <td className={cn('px-3 py-3 font-bold tabular-nums text-xs', low ? 'text-red-600' : '')}>{qty.toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium',
                            ft === 'WFS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700')}>
                            {ft === 'WFS' ? 'WFS' : 'Seller'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {low
                            ? <span className="flex items-center gap-1 text-xs font-medium text-amber-600"><AlertTriangle className="h-3 w-3"/>Low</span>
                            : <span className="text-xs text-emerald-600 font-medium">OK</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Profit & Loss tab */}
      {tab === 'profit' && (
        <div className="space-y-5">
          {/* Summary KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Net Profit', value: profitLoading ? null : formatCurrency(profitData?.summary?.netProfit ?? 0), sub: profitLoading ? null : `${profitData?.summary?.margin ?? 0}% margin`, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: TrendingUp },
              { label: 'Revenue', value: profitLoading ? null : formatCurrency(profitData?.summary?.revenue ?? 0), sub: profitLoading ? null : `${profitData?.summary?.orderCount ?? 0} orders`, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', icon: TrendingUp },
              { label: 'Total COGS', value: profitLoading ? null : formatCurrency(profitData?.summary?.cogs ?? 0), sub: 'Cost of goods', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', icon: Package },
              { label: 'Walmart Fees', value: profitLoading ? null : formatCurrency(profitData?.summary?.totalFees ?? 0), sub: 'Referral + fulfillment', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', icon: ShoppingCart },
            ].map(card => (
              <div key={card.label} className="rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    {card.value === null ? <div className="mt-1 h-8 w-24 rounded bg-muted animate-pulse" /> : <p className="mt-1 text-2xl font-bold">{card.value}</p>}
                    {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
                  </div>
                  <div className={cn('rounded-xl p-2.5', card.bg)}><card.icon className={cn('h-5 w-5', card.color)} /></div>
                </div>
              </div>
            ))}
          </div>

          {/* Profit formula strip */}
          {profitData?.summary && (
            <div className="rounded-xl border bg-muted/30 px-5 py-3 flex items-center gap-3 text-sm flex-wrap">
              <span className="font-medium text-blue-600">{formatCurrency(profitData.summary.revenue)}</span>
              <span className="text-muted-foreground">Revenue</span>
              <span className="text-muted-foreground">−</span>
              <span className="font-medium text-orange-600">{formatCurrency(profitData.summary.cogs)}</span>
              <span className="text-muted-foreground">COGS</span>
              <span className="text-muted-foreground">−</span>
              <span className="font-medium text-red-600">{formatCurrency(profitData.summary.totalFees)}</span>
              <span className="text-muted-foreground">Fees</span>
              <span className="text-muted-foreground">=</span>
              <span className={cn('font-bold text-lg', (profitData.summary.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {formatCurrency(profitData.summary.netProfit)} Net Profit
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{profitData.summary.coveredSkus}/{profitData.summary.totalSkus} SKUs have cost data</span>
            </div>
          )}

          {/* Profit + Revenue chart */}
          {!profitLoading && (profitData?.chart ?? []).length > 0 && (
            <div className="rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-4">Revenue vs Net Profit — {fmtUTC(dateRange.start)} to {fmtUTC(dateRange.end)}</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitData!.chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }}
                      tickFormatter={d => { const [,m,day] = d.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]} ${parseInt(day)}` }} />
                    <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name === 'revenue' ? 'Revenue' : 'Net Profit']} />
                    <Bar dataKey="revenue" fill={meta.color} opacity={0.4} name="revenue" />
                    <Bar dataKey="profit" fill="#10b981" name="profit" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-product P&L table */}
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  {['SKU','Units','Revenue','COGS','Ref. Fee','Fulfill. Fee','Total Fees','Net Payout','Net Profit','Margin'].map(h =>
                    <th key={h} className="px-3 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {profitLoading ? [...Array(8)].map((_,i) => (
                  <tr key={i} className="border-t">{[...Array(10)].map((_,j) =>
                    <td key={j} className="px-3 py-3"><div className="h-3 rounded bg-muted animate-pulse w-12"/></td>
                  )}</tr>
                )) : (profitData?.products ?? []).length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No orders in this period</td></tr>
                ) : (profitData?.products ?? []).map((p: any) => (
                  <tr key={p.sku} className={cn('border-t hover:bg-muted/10', !p.hasCosts && 'opacity-50')}>
                    <td className="px-3 py-2 font-mono text-muted-foreground max-w-[100px] truncate">{p.sku}</td>
                    <td className="px-3 py-2 tabular-nums">{p.units}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{formatCurrency(p.revenue)}</td>
                    <td className="px-3 py-2 tabular-nums text-orange-600">{p.hasCosts ? formatCurrency(p.cogs) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-red-500">{p.hasCosts ? formatCurrency(p.refFee) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-red-500">{p.hasCosts ? formatCurrency(p.fulfillmentFee) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-red-600 font-medium">{p.hasCosts ? formatCurrency(p.totalFees) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{p.hasCosts ? formatCurrency(p.netPayout) : '—'}</td>
                    <td className={cn('px-3 py-2 tabular-nums font-bold', p.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {p.hasCosts ? formatCurrency(p.netProfit) : '—'}
                    </td>
                    <td className={cn('px-3 py-2 tabular-nums', p.margin >= 20 ? 'text-emerald-600' : p.margin >= 10 ? 'text-amber-600' : 'text-red-600')}>
                      {p.hasCosts ? `${p.margin}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
