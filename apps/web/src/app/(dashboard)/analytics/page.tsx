'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn, CHANNEL_COLORS } from '@/lib/utils'
import { KpiCard } from '@/components/modules/analytics/KpiCard'
import { PeriodSelector, type Period } from '@/components/modules/analytics/PeriodSelector'
import { AnomalyBanner } from '@/components/modules/analytics/AnomalyBanner'
import { AiInsights } from '@/components/modules/analytics/AiInsights'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { DollarSign, ShoppingCart, TrendingUp, Users, Share2, Download, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const CHANNEL_LABELS: Record<string, string> = {
  AMAZON_US: 'Amazon US', AMAZON_IN: 'Amazon IN', AMAZON_AE: 'Amazon AE',
  AMAZON_UK: 'Amazon UK', AMAZON_AU: 'Amazon AU', WALMART: 'Walmart',
  TIKTOK_SHOP: 'TikTok Shop', SHOPIFY: 'Shopify', MYNTRA: 'Myntra', FLIPKART: 'Flipkart',
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'revenue', period],
    queryFn: () => api.get(`/analytics/revenue?period=${period}`).then((r) => r.data.data),
  })

  const stats = data?.stats
  const series = data?.series ?? []
  const byChannel = data?.byChannel ?? []
  const pnl = data?.pnl

  const handleShare = async () => {
    const { data: shareData } = await api.post('/analytics/dashboards/default/share')
    const url = `${window.location.origin}${shareData.data.url}`
    await navigator.clipboard.writeText(url)
    toast.success('Shareable link copied to clipboard')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="ml-auto flex gap-2">
          <Link href="/analytics/goals" className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
            <TrendingUp className="h-4 w-4" />
            Goals
          </Link>
          <Link href="/analytics/reports" className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
            <Download className="h-4 w-4" />
            Reports
          </Link>
          <button onClick={handleShare} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>

      {/* Anomaly Alerts */}
      <AnomalyBanner />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Gross Revenue"
          value={stats?.revenue ?? 0}
          change={stats?.changes?.revenue}
          format="currency"
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <KpiCard
          label="Gross Profit"
          value={stats?.grossProfit ?? 0}
          change={undefined}
          format="currency"
          sublabel={`${(stats?.grossMargin ?? 0).toFixed(1)}% margin`}
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-950/30"
        />
        <KpiCard
          label="Orders"
          value={stats?.orders ?? 0}
          change={stats?.changes?.orders}
          format="number"
          icon={ShoppingCart}
          iconColor="text-violet-600"
          iconBg="bg-violet-50 dark:bg-violet-950/30"
        />
        <KpiCard
          label="Avg Order Value"
          value={stats?.aov ?? 0}
          change={stats?.changes?.aov}
          format="currency"
          icon={Users}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-950/30"
        />
      </div>

      {/* Revenue Chart + Channel Breakdown */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Revenue Over Time</h2>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Profit</span>
            </div>
          </div>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142,72%,29%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(142,72%,29%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name === 'revenue' ? 'Revenue' : 'Profit']} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(142,72%,29%)" strokeWidth={2} fill="url(#revGrad)" />
                  <Area type="monotone" dataKey="profit" stroke="#60a5fa" strokeWidth={2} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Channel Breakdown */}
        <div className="rounded-xl border p-5">
          <h2 className="mb-4 text-sm font-semibold">Revenue by Channel</h2>
          {byChannel.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No channel data. Connect sales channels in Settings.
            </div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byChannel} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="revenue">
                      {byChannel.map((entry: any, i: number) => (
                        <Cell key={i} fill={CHANNEL_COLORS[entry.channel] ?? `hsl(${i * 40},60%,50%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {byChannel.slice(0, 5).map((c: any) => {
                  const total = byChannel.reduce((s: number, x: any) => s + x.revenue, 0)
                  const pct = total > 0 ? (c.revenue / total * 100) : 0
                  return (
                    <div key={c.channel} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHANNEL_COLORS[c.channel] ?? '#6B7280' }} />
                      <span className="flex-1 truncate text-muted-foreground">{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                      <span className="font-medium">{formatCurrency(c.revenue)}</span>
                      <span className="text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* P&L + AI Insights */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Real-time P&L */}
        <div className="rounded-xl border p-5">
          <h2 className="mb-4 text-sm font-semibold">Real-Time P&L</h2>
          {pnl ? (
            <div className="space-y-0">
              {[
                { label: 'Gross Revenue', value: pnl.grossRevenue, indent: false, bold: false },
                { label: 'Cost of Goods Sold', value: -pnl.cogs, indent: true, bold: false },
                { label: 'Gross Profit', value: pnl.grossProfit, indent: false, bold: true, border: true },
                ...pnl.expenses.map((e: any) => ({ label: e.category, value: -e.amount, indent: true, bold: false })),
                { label: 'Total Expenses', value: -pnl.totalExpenses, indent: false, bold: false },
                { label: 'Net Profit', value: pnl.netProfit, indent: false, bold: true, border: true },
              ].map((row, i) => (
                <div key={i} className={cn('flex items-center justify-between py-2 text-sm', row.border && 'border-t mt-2', row.indent && 'pl-4 text-muted-foreground')}>
                  <span className={cn(row.bold && 'font-semibold')}>{row.label}</span>
                  <span className={cn(row.bold ? 'font-bold' : 'font-medium', row.value < 0 ? 'text-red-600 dark:text-red-400' : row.bold ? 'text-foreground' : 'text-muted-foreground')}>
                    {row.value < 0 ? `(${formatCurrency(Math.abs(row.value))})` : formatCurrency(row.value)}
                  </span>
                </div>
              ))}
              <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 flex justify-between text-xs text-muted-foreground">
                <span>Gross Margin</span><span className="font-medium">{pnl.grossMargin.toFixed(1)}%</span>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 flex justify-between text-xs text-muted-foreground mt-1">
                <span>Net Margin</span><span className="font-medium">{pnl.netMargin.toFixed(1)}%</span>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Add orders and expenses to see P&L</div>
          )}
        </div>

        {/* AI Insights */}
        <AiInsights />
      </div>

      {/* Sub-module nav */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: '/analytics/inventory', label: 'Inventory Health', desc: 'Stock levels, DOI, alerts', emoji: '📦' },
          { href: '/analytics/customers', label: 'Customer Analytics', desc: 'LTV, CAC, cohorts, geo', emoji: '👥' },
          { href: '/analytics/skus', label: 'SKU Performance', desc: 'Product-level revenue, margin', emoji: '🏷️' },
          { href: '/analytics/goals', label: 'Goals & Targets', desc: '% to goal, OKR tracking', emoji: '🎯' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border p-4 hover:border-primary hover:bg-muted/30 transition-all group"
          >
            <span className="text-2xl">{item.emoji}</span>
            <p className="mt-2 font-medium text-sm group-hover:text-primary transition-colors">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
