'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Package, AlertTriangle, XCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function InventoryHealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'inventory'],
    queryFn: () => api.get('/analytics/inventory').then((r) => r.data.data),
  })

  const stats = [
    { label: 'Total SKUs', value: data?.total ?? 0, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Healthy', value: data?.healthy ?? 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Low Stock', value: data?.lowStock ?? 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Out of Stock', value: data?.outOfStock ?? 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/analytics" className="rounded-lg border p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-semibold text-lg">Inventory Health</h1>
          <p className="text-sm text-muted-foreground">Stock levels and reorder alerts across all channels</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', s.bg)}>
                <s.icon className={cn('h-4 w-4', s.color)} />
              </div>
            </div>
            <p className="text-2xl font-bold">{isLoading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Inventory Value</h2>
          <span className="text-xl font-bold">{isLoading ? '—' : formatCurrency(data?.totalValue ?? 0)}</span>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/40">
          <h2 className="text-sm font-semibold">Low Stock & Out of Stock Alerts</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (data?.alerts ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            All inventory levels are healthy
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/20">
              <tr>
                {['SKU', 'Product', 'Channel', 'Qty', 'Reorder Point', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.alerts ?? []).map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.channel}</td>
                  <td className="px-4 py-3">
                    <span className={cn('font-bold', item.quantity === 0 ? 'text-red-600' : 'text-amber-600')}>{item.quantity}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.reorderPoint}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', item.quantity === 0 ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400')}>
                      {item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                    </span>
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
