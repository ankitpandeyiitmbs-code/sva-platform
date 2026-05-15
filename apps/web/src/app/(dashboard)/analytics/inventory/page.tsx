'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { KpiCard } from '@/components/modules/analytics/KpiCard'
import { Package, AlertTriangle, TrendingDown, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const STATUS_CONFIG = {
  OUT_OF_STOCK: { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500' },
  LOW_STOCK: { label: 'Low Stock', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-500' },
  OVERSTOCKED: { label: 'Overstocked', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
  HEALTHY: { label: 'Healthy', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' },
}

export default function InventoryHealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'inventory'],
    queryFn: () => api.get('/analytics/inventory').then((r) => r.data.data),
    refetchInterval: 5 * 60 * 1000,
  })

  const summary = data?.summary ?? {}
  const items = data?.items ?? []

  const [filter, setFilter] = useState<string>('ALL')

  const filteredItems = filter === 'ALL' ? items : items.filter((i: any) => i.status === filter)

  const chartData = [
    { name: 'Healthy', value: summary.healthy ?? 0, fill: '#22c55e' },
    { name: 'Low Stock', value: summary.lowStock ?? 0, fill: '#f59e0b' },
    { name: 'Out of Stock', value: summary.outOfStock ?? 0, fill: '#ef4444' },
    { name: 'Overstocked', value: summary.overstocked ?? 0, fill: '#3b82f6' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Inventory Health</h1>
        <p className="text-sm text-muted-foreground">Stock levels, days of inventory, and reorder recommendations</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Total SKUs" value={summary.total ?? 0} format="number" icon={Package} iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-950/30" />
        <KpiCard label="Out of Stock" value={summary.outOfStock ?? 0} format="number" icon={AlertTriangle} iconColor="text-red-600" iconBg="bg-red-50 dark:bg-red-950/30" alert={(summary.outOfStock ?? 0) > 0} />
        <KpiCard label="Low Stock" value={summary.lowStock ?? 0} format="number" icon={TrendingDown} iconColor="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-950/30" alert={(summary.lowStock ?? 0) > 0} />
        <KpiCard label="Overstocked" value={summary.overstocked ?? 0} format="number" icon={BarChart3} iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-950/30" />
      </div>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border p-5">
          <h2 className="mb-4 text-sm font-semibold">Stock Distribution</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2">
            {chartData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                  {d.name}
                </span>
                <span className="font-medium">{d.value} SKUs</span>
              </div>
            ))}
          </div>
        </div>

        {/* Items table */}
        <div className="xl:col-span-2 rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-semibold flex-1">All SKUs</h2>
            {(['ALL', 'OUT_OF_STOCK', 'LOW_STOCK', 'OVERSTOCKED', 'HEALTHY'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn('rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  filter === s ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {s === 'ALL' ? 'All' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                <tr>
                  {['Product', 'SKU', 'Status', 'In Stock', 'Reorder Point', 'Days Left', 'Daily Sales'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-t">
                      {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-muted animate-pulse w-16" /></td>)}
                    </tr>
                  ))
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No items match this filter.</td></tr>
                ) : (
                  filteredItems.map((item: any) => {
                    const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]
                    return (
                      <tr key={item.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium max-w-40 truncate">{item.product?.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.product?.sku}</td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', cfg.color)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className={cn('px-4 py-3 font-bold tabular-nums',
                          item.status === 'OUT_OF_STOCK' ? 'text-red-600' :
                          item.status === 'LOW_STOCK' ? 'text-amber-600' : 'text-foreground'
                        )}>{item.quantity}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{item.reorderPoint}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {item.daysOfInventory !== null
                            ? <span className={cn('font-medium', item.daysOfInventory < 14 ? 'text-red-600' : item.daysOfInventory < 30 ? 'text-amber-600' : 'text-foreground')}>{item.daysOfInventory}d</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{item.dailySales.toFixed(1)}/d</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// Need useState
import { useState } from 'react'
