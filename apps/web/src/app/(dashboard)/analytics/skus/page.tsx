'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { PeriodSelector, type Period } from '@/components/modules/analytics/PeriodSelector'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function SkuPerformancePage() {
  const [period, setPeriod] = useState<Period>('30d')

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['analytics', 'skus', period],
    queryFn: () => api.get(`/analytics/skus?period=${period}`).then((r) => r.data.data),
  })

  const top10 = skus.slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/analytics" className="rounded-lg border p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">SKU Performance</h1>
          <p className="text-sm text-muted-foreground">Product-level revenue, units sold, and margin</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="rounded-xl border p-5">
        <h2 className="text-sm font-semibold mb-4">Top 10 SKUs by Revenue</h2>
        {isLoading ? (
          <div className="h-64 animate-pulse rounded bg-muted" />
        ) : top10.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No order data for this period</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="sku" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="hsl(142,72%,29%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/40">
          <h2 className="text-sm font-semibold">All SKUs ({skus.length})</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : skus.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No sales data. Connect your channels and sync orders.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/20">
              <tr>
                {['SKU', 'Product', 'Revenue', 'Units', 'Margin %'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skus.map((sku: any, i: number) => (
                <tr key={sku.sku} className="border-t hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{sku.sku}</span>
                  </td>
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{sku.name}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(sku.revenue)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatNumber(sku.units)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {sku.margin >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                      <span className={cn('font-medium', sku.margin >= 30 ? 'text-emerald-600' : sku.margin >= 0 ? 'text-amber-600' : 'text-red-600')}>
                        {sku.margin.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
