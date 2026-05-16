'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { PeriodSelector, type Period } from '@/components/modules/analytics/PeriodSelector'
import { ArrowLeft, Users, UserPlus, Repeat2, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function CustomerAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'customers', period],
    queryFn: () => api.get(`/analytics/customers?period=${period}`).then((r) => r.data.data),
  })

  const stats = data?.stats
  const cohorts = data?.cohorts ?? []

  const cards = [
    { label: 'Total Customers', value: stats?.total ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', format: 'number' as const },
    { label: 'New This Period', value: stats?.newCustomers ?? 0, icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', format: 'number' as const },
    { label: 'Active Buyers', value: stats?.activeCustomers ?? 0, icon: ShoppingBag, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30', format: 'number' as const },
    { label: 'Avg Order Value', value: stats?.avgOrderValue ?? 0, icon: Repeat2, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', format: 'currency' as const },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/analytics" className="rounded-lg border p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">Customer Analytics</h1>
          <p className="text-sm text-muted-foreground">Acquisition, retention, and lifetime value</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', c.bg)}>
                <c.icon className={cn('h-4 w-4', c.color)} />
              </div>
            </div>
            <p className="text-2xl font-bold">
              {isLoading ? '—' : c.format === 'currency' ? formatCurrency(c.value) : formatNumber(c.value)}
            </p>
          </div>
        ))}
      </div>

      {stats?.repeatRate !== undefined && (
        <div className="rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Repeat Customer Rate</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Customers who have purchased more than once</p>
            </div>
            <span className="text-2xl font-bold">{stats.repeatRate.toFixed(1)}%</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(stats.repeatRate, 100)}%` }} />
          </div>
        </div>
      )}

      <div className="rounded-xl border p-5">
        <h2 className="text-sm font-semibold mb-4">New Customer Acquisition by Month</h2>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded bg-muted" />
        ) : cohorts.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No customer data yet</div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohorts}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(142,72%,29%)" radius={[4, 4, 0, 0]} name="New Customers" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
