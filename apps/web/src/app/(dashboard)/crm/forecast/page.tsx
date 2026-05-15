'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, Target, DollarSign, Calendar } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const STAGE_COLORS: Record<string, string> = {
  Lead: 'bg-gray-100 text-gray-700',
  Qualified: 'bg-blue-100 text-blue-700',
  Proposal: 'bg-violet-100 text-violet-700',
  Negotiation: 'bg-amber-100 text-amber-700',
  'Closed Won': 'bg-emerald-100 text-emerald-700',
  'Closed Lost': 'bg-red-100 text-red-700',
}

export default function ForecastPage() {
  const { data: forecast, isLoading } = useQuery({
    queryKey: ['crm', 'forecast'],
    queryFn: () => api.get('/crm/forecast').then((r) => r.data.data),
  })

  const { data: deals = [] } = useQuery({
    queryKey: ['crm', 'deals'],
    queryFn: () => api.get('/crm/deals?limit=200').then((r) => r.data.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl border bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  const monthlyData = forecast?.byMonth ?? []
  const stageBreakdown = forecast?.byStage ?? []
  const totalPipeline = forecast?.totalPipeline ?? 0
  const weightedForecast = forecast?.weightedForecast ?? 0
  const openDeals = forecast?.openDeals ?? 0
  const avgDealSize = openDeals > 0 ? totalPipeline / openDeals : 0

  // Group open deals by expected close month
  const openDealsOnly = deals.filter((d: any) => !['Closed Won', 'Closed Lost'].includes(d.stage?.name ?? ''))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Sales Forecast</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Weighted pipeline projection based on deal stage probability</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Total Pipeline', value: formatCurrency(totalPipeline), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { label: 'Weighted Forecast', value: formatCurrency(weightedForecast), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'Open Deals', value: openDeals.toString(), icon: Target, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
          { label: 'Avg Deal Size', value: formatCurrency(avgDealSize), icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', kpi.bg)}>
                <kpi.icon className={cn('h-4 w-4', kpi.color)} />
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Monthly Forecast Chart */}
        <div className="rounded-xl border p-5">
          <h2 className="text-sm font-semibold mb-4">Monthly Forecast</h2>
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No forecast data yet. Add deals with expected close dates.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any, name: string) => [formatCurrency(v), name === 'pipeline' ? 'Total Pipeline' : 'Weighted']}
                  contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pipeline" fill="hsl(var(--primary) / 0.3)" name="Total Pipeline" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weighted" fill="hsl(var(--primary))" name="Weighted" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stage Breakdown */}
        <div className="rounded-xl border p-5">
          <h2 className="text-sm font-semibold mb-4">Pipeline by Stage</h2>
          {stageBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No stage data yet.</div>
          ) : (
            <div className="space-y-3">
              {stageBreakdown.map((s: any) => {
                const pct = totalPipeline > 0 ? (s.value / totalPipeline) * 100 : 0
                return (
                  <div key={s.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[s.stage] ?? 'bg-muted text-muted-foreground')}>
                          {s.stage}
                        </span>
                        <span className="text-muted-foreground text-xs">{s.count} deals</span>
                      </div>
                      <span className="font-medium tabular-nums">{formatCurrency(s.value)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Open Deals Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Open Deals</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Deal', 'Contact', 'Stage', 'Value', 'Probability', 'Weighted', 'Close Date'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {openDealsOnly.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No open deals yet.</td></tr>
            ) : (
              openDealsOnly.map((d: any) => {
                const weighted = Number(d.value) * (d.probability / 100)
                const stageName = d.stage?.name ?? '—'
                return (
                  <tr key={d.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{d.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {d.customer
                        ? [d.customer.firstName, d.customer.lastName].filter(Boolean).join(' ') || d.customer.email
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[stageName] ?? 'bg-muted text-muted-foreground')}>
                        {stageName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium tabular-nums">{formatCurrency(Number(d.value), d.currency)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{d.probability}%</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums text-primary">{formatCurrency(weighted, d.currency)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
