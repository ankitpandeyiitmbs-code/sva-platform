'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { PeriodSelector, type Period } from '@/components/modules/analytics/PeriodSelector'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ArrowUpDown } from 'lucide-react'

type SortKey = 'revenue' | 'unitsSold' | 'profit' | 'orders'

export default function SkuPerformancePage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [sortKey, setSortKey] = useState<SortKey>('revenue')

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['analytics', 'skus', period],
    queryFn: () => api.get(`/analytics/skus?period=${period}`).then((r) => r.data.data),
  })

  const sorted = [...skus].sort((a: any, b: any) => b[sortKey] - a[sortKey])
  const top10 = sorted.slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold">SKU Performance</h1>
          <p className="text-sm text-muted-foreground">Revenue, units sold, and margin by product</p>
        </div>
        <div className="ml-auto">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* Top 10 Chart */}
      <div className="rounded-xl border p-5">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-sm font-semibold flex-1">Top 10 Products by</h2>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="revenue">Revenue</option>
            <option value="unitsSold">Units Sold</option>
            <option value="profit">Profit</option>
            <option value="orders">Orders</option>
          </select>
        </div>
        {isLoading ? (
          <div className="h-64 animate-pulse rounded bg-muted" />
        ) : top10.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No order data yet for this period.</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => sortKey === 'revenue' || sortKey === 'profit' ? `$${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip formatter={(v: number) => [sortKey === 'revenue' || sortKey === 'profit' ? formatCurrency(v) : formatNumber(v), sortKey]} />
                <Bar dataKey={sortKey} fill="hsl(142,72%,29%)" radius={[0, 4, 4, 0]}>
                  {top10.map((_: any, i: number) => (
                    <Cell key={i} fill={i < 3 ? 'hsl(142,72%,29%)' : 'hsl(142,62%,45%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Full table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {[
                { key: null, label: '#' },
                { key: null, label: 'Product' },
                { key: null, label: 'SKU' },
                { key: 'unitsSold', label: 'Units Sold' },
                { key: 'orders', label: 'Orders' },
                { key: 'revenue', label: 'Revenue' },
                { key: 'profit', label: 'Profit' },
                { key: null, label: 'Margin' },
              ].map((h) => (
                <th
                  key={h.label}
                  onClick={() => h.key && setSortKey(h.key as SortKey)}
                  className={cn('px-4 py-3 text-left text-xs font-medium text-muted-foreground', h.key && 'cursor-pointer hover:text-foreground')}
                >
                  <span className="flex items-center gap-1">
                    {h.label}
                    {h.key && <ArrowUpDown className="h-3 w-3" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-t">
                  {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-muted animate-pulse w-16" /></td>)}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No sales data for this period.</td></tr>
            ) : (
              sorted.map((sku: any, i: number) => {
                const margin = sku.revenue > 0 ? (sku.profit / sku.revenue) * 100 : 0
                return (
                  <tr key={sku.sku} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium max-w-48 truncate">{sku.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sku.sku}</td>
                    <td className="px-4 py-3 tabular-nums font-medium">{formatNumber(sku.unitsSold)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{sku.orders}</td>
                    <td className="px-4 py-3 tabular-nums font-medium">{formatCurrency(sku.revenue)}</td>
                    <td className={cn('px-4 py-3 tabular-nums font-medium', sku.profit < 0 ? 'text-red-600' : 'text-emerald-600')}>{formatCurrency(sku.profit)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full', margin >= 30 ? 'bg-emerald-500' : margin >= 15 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.max(0, Math.min(100, margin))}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{margin.toFixed(0)}%</span>
                      </div>
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
