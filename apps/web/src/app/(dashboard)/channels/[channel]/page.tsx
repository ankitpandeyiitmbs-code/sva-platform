'use client'
export const dynamic = 'force-dynamic'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn, CHANNEL_COLORS, STATUS_COLORS } from '@/lib/utils'
import { useParams, useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  RefreshCw, TrendingUp, ShoppingCart, Package, Clock,
  ArrowLeft, Loader2, ChevronRight, AlertTriangle, X, MapPin,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { format } from 'date-fns'

// ── Channel metadata ───────────────────────────────────
const CHANNEL_META: Record<string, { label: string; logo: string; color: string; accentBg: string }> = {
  WALMART:      { label: 'Walmart',          logo: 'W',  color: '#007DC6', accentBg: 'bg-[#007DC6]/10' },
  AMAZON_US:    { label: 'Amazon US',        logo: 'A',  color: '#FF9900', accentBg: 'bg-[#FF9900]/10' },
  AMAZON_IN:    { label: 'Amazon India',     logo: 'A',  color: '#FF9900', accentBg: 'bg-[#FF9900]/10' },
  AMAZON_AE:    { label: 'Amazon UAE',       logo: 'A',  color: '#FF9900', accentBg: 'bg-[#FF9900]/10' },
  AMAZON_UK:    { label: 'Amazon UK',        logo: 'A',  color: '#FF9900', accentBg: 'bg-[#FF9900]/10' },
  AMAZON_AU:    { label: 'Amazon Australia', logo: 'A',  color: '#FF9900', accentBg: 'bg-[#FF9900]/10' },
  TIKTOK_SHOP:  { label: 'TikTok Shop',      logo: 'T',  color: '#010101', accentBg: 'bg-black/10'     },
  SHOPIFY:      { label: 'Shopify',          logo: 'S',  color: '#96BF48', accentBg: 'bg-[#96BF48]/10' },
  MYNTRA:       { label: 'Myntra',           logo: 'M',  color: '#FF3F6C', accentBg: 'bg-[#FF3F6C]/10' },
  FLIPKART:     { label: 'Flipkart',         logo: 'F',  color: '#2874F0', accentBg: 'bg-[#2874F0]/10' },
}

const SYNC_ROUTES: Record<string, string> = {
  WALMART:     '/walmart/sync',
  TIKTOK_SHOP: '/tiktok/sync',
  AMAZON_US: '/amazon/AMAZON_US/sync', AMAZON_IN: '/amazon/AMAZON_IN/sync',
  AMAZON_AE: '/amazon/AMAZON_AE/sync', AMAZON_UK: '/amazon/AMAZON_UK/sync',
  AMAZON_AU: '/amazon/AMAZON_AU/sync',
}

const FULFILLMENT_COLORS: Record<string, string> = {
  UNFULFILLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  PARTIAL:     'bg-amber-100 text-amber-700',
  FULFILLED:   'bg-emerald-100 text-emerald-700',
}

export default function ChannelPage() {
  const params  = useParams()
  const router  = useRouter()
  const channel = (params.channel as string).toUpperCase()
  const meta    = CHANNEL_META[channel] ?? { label: channel, logo: channel[0], color: '#6B7280', accentBg: 'bg-gray-100' }

  const [tab, setTab]       = useState<'overview' | 'orders' | 'inventory'>('overview')
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [orderPage, setOrderPage] = useState(1)
  const qc = useQueryClient()

  // ── Channel config from DB ────────────────────────
  const { data: channelConfig } = useQuery({
    queryKey: ['channel-config', channel],
    queryFn: () => api.get('/channels').then(r =>
      (r.data.data as any[]).find(c => c.channel === channel) ?? null
    ),
  })

  // ── Orders (all, for stats + chart) ──────────────
  const { data: allOrdersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['channel-orders-all', channel],
    queryFn: () => api.get(`/orders?channel=${channel}&limit=500&page=1`).then(r => r.data),
    staleTime: 60_000,
  })

  // ── Paginated orders for table ────────────────────
  const { data: pagedOrders } = useQuery({
    queryKey: ['channel-orders-paged', channel, orderPage, search, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ channel, limit: '50', page: String(orderPage) })
      if (search) p.set('search', search)
      if (statusFilter) p.set('status', statusFilter)
      return api.get(`/orders?${p}`).then(r => r.data)
    },
    enabled: tab === 'orders',
  })

  // ── Order detail ──────────────────────────────────
  const { data: orderDetail } = useQuery({
    queryKey: ['order-detail', selected?.id],
    queryFn: () => api.get(`/orders/${selected.id}`).then(r => r.data.data),
    enabled: !!selected?.id,
  })

  // ── Inventory ─────────────────────────────────────
  const { data: inventoryData } = useQuery({
    queryKey: ['channel-inventory', channel],
    queryFn: () => api.get(`/inventory/products`).then(r => r.data.data),
    enabled: tab === 'inventory',
  })

  // ── Computed stats from all orders ────────────────
  const stats = useMemo(() => {
    const orders = allOrdersData?.data ?? []
    const revenue     = orders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0)
    const count       = orders.length
    const aov         = count > 0 ? revenue / count : 0
    const pending     = orders.filter((o: any) => ['PENDING', 'PROCESSING'].includes(o.status)).length

    // Revenue by day (last 30)
    const byDay: Record<string, number> = {}
    orders.forEach((o: any) => {
      const day = format(new Date(o.orderedAt), 'MMM d')
      byDay[day] = (byDay[day] ?? 0) + Number(o.total ?? 0)
    })
    const chartData = Object.entries(byDay)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, total]) => ({ date, total }))

    // Top SKUs
    const skuMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    orders.forEach((o: any) => {
      ;(o.items ?? []).forEach((item: any) => {
        if (!skuMap[item.sku]) skuMap[item.sku] = { name: item.name, qty: 0, revenue: 0 }
        skuMap[item.sku].qty     += item.quantity ?? 0
        skuMap[item.sku].revenue += Number(item.total ?? 0)
      })
    })
    const topSkus = Object.entries(skuMap)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 8)
      .map(([sku, v]) => ({ sku, ...v }))

    return { revenue, count, aov, pending, chartData, topSkus }
  }, [allOrdersData])

  // ── Sync ──────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    try {
      const route = SYNC_ROUTES[channel]
      if (!route) { toast.error('Sync not supported for this channel'); return }
      const { data } = await api.post(route)
      const orders = data.data?.orders?.synced ?? data.data?.synced ?? 0
      const inv    = data.data?.inventory?.synced ?? data.data?.products?.synced ?? 0
      toast.success(`Synced ${orders} orders & ${inv} products`)
      qc.invalidateQueries({ queryKey: ['channel-orders-all', channel] })
      qc.invalidateQueries({ queryKey: ['channel-orders-paged', channel] })
      qc.invalidateQueries({ queryKey: ['channel-inventory', channel] })
      qc.invalidateQueries({ queryKey: ['channel-config', channel] })
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const isConnected = channelConfig?.status === 'CONNECTED'

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center gap-4">
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
        <div className="ml-auto flex gap-2">
          {isConnected && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        {(['overview', 'orders', 'inventory'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview tab ────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Revenue (30d)',  value: formatCurrency(stats.revenue), icon: TrendingUp,   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
              { label: 'Orders (30d)',   value: formatNumber(stats.count),     icon: ShoppingCart, color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
              { label: 'Avg Order Value', value: formatCurrency(stats.aov),    icon: TrendingUp,   color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-950/30' },
              { label: 'Pending Orders', value: String(stats.pending),         icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/30',
                alert: stats.pending > 0 },
            ].map(card => (
              <div key={card.label} className={cn('rounded-xl border p-5', card.alert && 'border-amber-300 dark:border-amber-800')}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold">
                      {ordersLoading ? <span className="inline-block h-7 w-20 rounded bg-muted animate-pulse" /> : card.value}
                    </p>
                  </div>
                  <div className={cn('rounded-xl p-2.5', card.bg)}>
                    <card.icon className={cn('h-5 w-5', card.color)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue chart + Top SKUs */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Revenue Trend</h2>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: meta.color }}>
                  {meta.label}
                </span>
              </div>
              {stats.chartData.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData}>
                      <defs>
                        <linearGradient id={`grad-${channel}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={meta.color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={meta.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                      <Area type="monotone" dataKey="total" stroke={meta.color} strokeWidth={2}
                        fill={`url(#grad-${channel})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                  {ordersLoading ? 'Loading...' : 'No orders yet — sync to pull data'}
                </div>
              )}
            </div>

            {/* Top SKUs */}
            <div className="rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-4">Top Products by Revenue</h2>
              {stats.topSkus.length > 0 ? (
                <div className="space-y-3">
                  {stats.topSkus.map((sku, i) => (
                    <div key={sku.sku} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{sku.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{sku.sku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold">{formatCurrency(sku.revenue)}</p>
                        <p className="text-xs text-muted-foreground">×{sku.qty}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  {ordersLoading ? 'Loading...' : 'No data yet'}
                </div>
              )}
            </div>
          </div>

          {/* Order status breakdown */}
          {stats.count > 0 && (() => {
            const byStatus: Record<string, number> = {}
            ;(allOrdersData?.data ?? []).forEach((o: any) => {
              byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
            })
            const barData = Object.entries(byStatus).map(([status, count]) => ({ status, count }))
            return (
              <div className="rounded-xl border p-5">
                <h2 className="text-sm font-semibold mb-4">Order Status Breakdown</h2>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip />
                      <Bar dataKey="count" fill={meta.color} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Orders tab ──────────────────────────────── */}
      {tab === 'orders' && (
        <div className="flex gap-5 h-full">
          <div className={cn('flex-1 space-y-4 min-w-0', selected && 'hidden xl:block')}>
            <div className="flex flex-wrap items-center gap-2">
              <input value={search} onChange={e => { setSearch(e.target.value); setOrderPage(1) }}
                placeholder="Search order #..."
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary flex-1 min-w-[180px] max-w-xs" />
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setOrderPage(1) }}
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Statuses</option>
                {['PENDING','PROCESSING','SHIPPED','DELIVERED','COMPLETED','CANCELLED'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
              <span className="ml-auto text-sm text-muted-foreground">
                {(pagedOrders?.total ?? allOrdersData?.total ?? 0).toLocaleString()} orders
              </span>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {['Order #', 'Status', 'Fulfillment', 'Total', 'Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(pagedOrders?.data ?? allOrdersData?.data ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No orders found
                    </td></tr>
                  ) : (
                    (pagedOrders?.data ?? allOrdersData?.data ?? []).map((order: any) => (
                      <tr key={order.id} onClick={() => setSelected(order)}
                        className={cn('border-t hover:bg-muted/20 cursor-pointer transition-colors',
                          selected?.id === order.id && 'bg-muted/30')}>
                        <td className="px-4 py-3 font-medium text-primary">{order.orderNumber}</td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700')}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs',
                            FULFILLMENT_COLORS[order.fulfillmentStatus] ?? 'bg-gray-100 text-gray-700')}>
                            {order.fulfillmentStatus ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(Number(order.total), order.currency)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {format(new Date(order.orderedAt), 'MMM d, yyyy h:mm a')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagedOrders?.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button disabled={orderPage === 1} onClick={() => setOrderPage(p => p - 1)}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Prev</button>
                <span className="text-sm text-muted-foreground">Page {orderPage} of {pagedOrders.totalPages}</span>
                <button disabled={orderPage === pagedOrders.totalPages} onClick={() => setOrderPage(p => p + 1)}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Next</button>
              </div>
            )}
          </div>

          {/* Order detail panel */}
          {selected && (
            <div className="w-full xl:w-[400px] shrink-0 rounded-xl border bg-background flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <p className="font-semibold">{selected.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Total',      value: formatCurrency(Number(selected.total), selected.currency) },
                    { label: 'Date',       value: format(new Date(selected.orderedAt), 'MMM d, yyyy') },
                    { label: 'Payment',    value: selected.paymentStatus ?? '—' },
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
                        <MapPin className="h-3 w-3" />Ship To
                      </p>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {a.name && <p className="font-medium text-foreground">{a.name}</p>}
                        {a.line1 && <p>{a.line1}</p>}
                        {[a.city, a.state, a.zip].filter(Boolean).join(', ') && (
                          <p>{[a.city, a.state, a.zip].filter(Boolean).join(', ')}</p>
                        )}
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

      {/* ── Inventory tab ────────────────────────────── */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['SKU', 'Product', 'In Stock', 'Reorder Point', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!inventoryData ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-t">
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-muted animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : inventoryData.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No inventory data — sync to import products
                  </td></tr>
                ) : (
                  inventoryData.map((product: any) => {
                    const items = product.inventoryItems ?? []
                    const channelItem = items.find((i: any) => i.channel === channel) ?? items[0]
                    const qty = channelItem?.quantity ?? 0
                    const reorder = channelItem?.reorderPoint ?? 10
                    const low = qty <= reorder
                    return (
                      <tr key={product.id} className="border-t hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{product.sku}</td>
                        <td className="px-4 py-3 font-medium max-w-[220px] truncate">{product.name}</td>
                        <td className={cn('px-4 py-3 font-bold tabular-nums', low ? 'text-red-600' : 'text-foreground')}>
                          {qty.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{reorder}</td>
                        <td className="px-4 py-3">
                          {low ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                              <AlertTriangle className="h-3 w-3" /> Low Stock
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">OK</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
