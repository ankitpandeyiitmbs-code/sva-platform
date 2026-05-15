'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, formatPercent, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, ShoppingCart, Users, Package, AlertTriangle, Zap } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { CHANNEL_COLORS } from '@/lib/utils'

const CHANNEL_LABELS: Record<string, string> = {
  AMAZON_US: 'Amazon US', AMAZON_IN: 'Amazon India', AMAZON_UK: 'Amazon UK',
  AMAZON_AE: 'Amazon UAE', AMAZON_AU: 'Amazon AU', WALMART: 'Walmart',
  TIKTOK_SHOP: 'TikTok Shop', SHOPIFY: 'Shopify', MYNTRA: 'Myntra', FLIPKART: 'Flipkart',
}

export default function DashboardPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.get('/dashboard/overview').then((r) => r.data.data),
    refetchInterval: 60_000,
  })

  const { data: revenue } = useQuery({
    queryKey: ['dashboard', 'revenue', '30'],
    queryFn: () => api.get('/dashboard/revenue?days=30').then((r) => r.data.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-muted" />
      </div>
    )
  }

  const kpiCards = [
    {
      label: 'Revenue (30d)',
      value: formatCurrency(overview?.revenue?.current ?? 0),
      change: overview?.revenue?.change ?? 0,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'Orders (30d)',
      value: formatNumber(overview?.orders?.current ?? 0),
      change: overview?.orders?.change ?? 0,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'New Customers (30d)',
      value: formatNumber(overview?.newCustomers ?? 0),
      change: 0,
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      label: 'Low Stock Items',
      value: String(overview?.lowStock?.length ?? 0),
      change: 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      alert: (overview?.lowStock?.length ?? 0) > 0,
    },
  ]

  const channelData = (overview?.revenueByChannel ?? []).map((c: any) => ({
    name: CHANNEL_LABELS[c.channel] ?? c.channel,
    value: c.revenue,
    fill: CHANNEL_COLORS[c.channel] ?? '#6B7280',
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.label} className={cn('rounded-xl border p-5 transition-shadow hover:shadow-md', card.alert && 'border-amber-300 dark:border-amber-800')}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-bold">{card.value}</p>
                {card.change !== 0 && (
                  <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', card.change > 0 ? 'change-positive' : 'change-negative')}>
                    {card.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPercent(card.change)} vs prev 30d
                  </p>
                )}
              </div>
              <div className={cn('rounded-xl p-2.5', card.bg)}>
                <card.icon className={cn('h-5 w-5', card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart + Channel Breakdown */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue Area Chart */}
        <div className="xl:col-span-2 rounded-xl border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Revenue (Last 30 Days)</h2>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">All Channels</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue ?? []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 72%, 29%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(142, 72%, 29%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="orderedAt" tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                <Area type="monotone" dataKey="total" stroke="hsl(142, 72%, 29%)" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Channel */}
        <div className="rounded-xl border p-5">
          <h2 className="mb-4 text-sm font-semibold">Revenue by Channel</h2>
          {channelData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={channelData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {channelData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Connect your sales channels to see revenue breakdown</p>
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alert Table */}
      {(overview?.lowStock?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Low Stock Alert — Action Required</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Product</th>
                  <th className="pb-2 text-left font-medium">SKU</th>
                  <th className="pb-2 text-right font-medium">In Stock</th>
                  <th className="pb-2 text-right font-medium">Reorder Point</th>
                </tr>
              </thead>
              <tbody>
                {overview.lowStock.slice(0, 5).map((item: any) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{item.product?.name ?? '—'}</td>
                    <td className="py-2 text-muted-foreground">{item.product?.sku ?? '—'}</td>
                    <td className="py-2 text-right font-medium text-red-600">{item.quantity}</td>
                    <td className="py-2 text-right text-muted-foreground">{item.reorderPoint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Channel Connection Status */}
      <ChannelStatus />
    </div>
  )
}

function ChannelStatus() {
  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get('/channels').then((r) => r.data.data),
  })

  const all = [
    { key: 'AMAZON_US', label: 'Amazon US' }, { key: 'AMAZON_IN', label: 'Amazon India' },
    { key: 'AMAZON_AE', label: 'Amazon UAE' }, { key: 'AMAZON_UK', label: 'Amazon UK' },
    { key: 'WALMART', label: 'Walmart' }, { key: 'TIKTOK_SHOP', label: 'TikTok Shop' },
    { key: 'SHOPIFY', label: 'Shopify' }, { key: 'MYNTRA', label: 'Myntra' },
    { key: 'FLIPKART', label: 'Flipkart' },
  ]

  const connected = new Set((channels ?? []).filter((c: any) => c.status === 'CONNECTED').map((c: any) => c.channel))

  return (
    <div className="rounded-xl border p-5">
      <h2 className="mb-4 text-sm font-semibold">Sales Channel Status</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {all.map((ch) => (
          <div key={ch.key} className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
            connected.has(ch.key) ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-dashed'
          )}>
            <span className={cn('h-2 w-2 rounded-full shrink-0', connected.has(ch.key) ? 'bg-green-500' : 'bg-muted-foreground/30')} />
            <span className={cn('truncate', connected.has(ch.key) ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground')}>{ch.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
