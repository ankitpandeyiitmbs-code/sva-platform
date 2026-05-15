'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { KpiCard } from '@/components/modules/analytics/KpiCard'
import { PeriodSelector, type Period } from '@/components/modules/analytics/PeriodSelector'
import { Users, TrendingUp, Repeat2, Globe } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts'

export default function CustomerAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'customers', period],
    queryFn: () => api.get(`/analytics/customers?period=${period}`).then((r) => r.data.data),
  })

  const stats = data?.stats
  const cohorts = data?.cohorts ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold">Customer Analytics</h1>
          <p className="text-sm text-muted-foreground">LTV, retention, cohort analysis, and geographic breakdown</p>
        </div>
        <div className="ml-auto">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          label="New Customers"
          value={stats?.newCustomers?.current ?? 0}
          change={stats?.newCustomers?.change}
          format="number"
          icon={Users}
          iconColor="text-violet-600"
          iconBg="bg-violet-50 dark:bg-violet-950/30"
        />
        <KpiCard
          label="Returning Customers"
          value={stats?.returningCustomers ?? 0}
          format="number"
          icon={Repeat2}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-950/30"
        />
        <KpiCard
          label="Repeat Purchase Rate"
          value={`${(stats?.repeatPurchaseRate ?? 0).toFixed(1)}%`}
          format="raw"
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <KpiCard
          label="Avg Customer LTV"
          value={stats?.avgLTV ?? 0}
          format="currency"
          icon={Globe}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-950/30"
        />
      </div>

      {/* Cohort Retention + Geography */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Cohort Chart */}
        <div className="rounded-xl border p-5">
          <h2 className="mb-1 text-sm font-semibold">Monthly Cohort Retention</h2>
          <p className="mb-4 text-xs text-muted-foreground">% of customers who made a second purchase</p>
          {isLoading ? (
            <div className="h-48 animate-pulse rounded bg-muted" />
          ) : cohorts.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Not enough data for cohort analysis</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohorts} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="cohort" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Retention Rate']} />
                  <Bar dataKey="retentionRate" fill="hsl(142,72%,29%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-3">
            {cohorts.slice(-3).map((c: any) => (
              <div key={c.cohort} className="rounded-lg bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">{c.cohort}</p>
                <p className="text-lg font-bold">{c.retentionRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">{c.size} customers</p>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Breakdown */}
        <div className="rounded-xl border p-5">
          <h2 className="mb-4 text-sm font-semibold">Top Markets by Customer Count</h2>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded bg-muted" />
          ) : (stats?.byCountry ?? []).length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No geographic data. Add customer country information.</div>
          ) : (
            <div className="space-y-2.5">
              {(stats?.byCountry ?? []).slice(0, 8).map((c: any, i: number) => {
                const max = stats.byCountry[0]?.customers ?? 1
                const pct = (c.customers / max) * 100
                return (
                  <div key={c.country} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-4">{i + 1}</span>
                        <span className="font-medium">{c.country}</span>
                      </span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{c.customers.toLocaleString()} customers</span>
                        <span className="font-medium text-foreground">{formatCurrency(c.ltv)}</span>
                      </div>
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

      {/* Top Customers by LTV */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Top Customers by Lifetime Value</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['#', 'Customer', 'Email', 'Country', 'Orders', 'Lifetime Value'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-muted animate-pulse w-20" /></td>)}
                </tr>
              ))
            ) : (stats?.topCustomers ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No customer data yet.</td></tr>
            ) : (
              (stats?.topCustomers ?? []).map((c: any, i: number) => (
                <tr key={c.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.country ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{c.totalOrders}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-primary">{formatCurrency(c.ltv)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
