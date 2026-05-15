'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Search, AlertTriangle, Package, Warehouse, TruckIcon } from 'lucide-react'
import { useState } from 'react'

export default function InventoryPage() {
  const [tab, setTab] = useState<'products' | 'lowstock' | 'po' | 'suppliers'>('products')
  const [search, setSearch] = useState('')

  const { data: products, isLoading } = useQuery({
    queryKey: ['inventory', 'products', search],
    queryFn: () => api.get(`/inventory/products${search ? `?search=${search}` : ''}`).then((r) => r.data.data),
    enabled: tab === 'products',
  })

  const { data: lowStock } = useQuery({
    queryKey: ['inventory', 'lowstock'],
    queryFn: () => api.get('/inventory/low-stock').then((r) => r.data.data),
    enabled: tab === 'lowstock',
  })

  const { data: pos } = useQuery({
    queryKey: ['inventory', 'po'],
    queryFn: () => api.get('/inventory/purchase-orders').then((r) => r.data.data),
    enabled: tab === 'po',
  })

  const { data: suppliers } = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: () => api.get('/inventory/suppliers').then((r) => r.data.data),
    enabled: tab === 'suppliers',
  })

  const tabs = [
    { key: 'products', label: 'Products', icon: Package },
    { key: 'lowstock', label: 'Low Stock', icon: AlertTriangle },
    { key: 'po', label: 'Purchase Orders', icon: TruckIcon },
    { key: 'suppliers', label: 'Suppliers', icon: Warehouse },
  ]

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>{['SKU', 'Product', 'Category', 'Variants', 'Total Stock', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <tr key={i} className="border-t">{[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-20" /></td>)}</tr>)
                ) : (products ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No products yet. Add products or sync from a channel.</td></tr>
                ) : (
                  (products ?? []).map((p: any) => {
                    const totalStock = p.inventoryItems?.reduce((sum: number, i: any) => sum + i.quantity, 0) ?? 0
                    return (
                      <tr key={p.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.category ?? '—'}</td>
                        <td className="px-4 py-3">{p.variants?.length ?? 0}</td>
                        <td className={cn('px-4 py-3 font-medium', totalStock <= 10 ? 'text-red-600' : totalStock <= 50 ? 'text-amber-600' : 'text-emerald-600')}>{totalStock}</td>
                        <td className="px-4 py-3"><span className={cn('rounded-full px-2 py-0.5 text-xs', p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'lowstock' && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-amber-50 dark:bg-amber-950/30">
              <tr>{['Product', 'SKU', 'Warehouse', 'In Stock', 'Reorder Point', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(lowStock ?? []).map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{item.product?.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.product?.sku}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.warehouse?.name ?? 'Default'}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{item.quantity}</td>
                  <td className="px-4 py-3">{item.reorderPoint}</td>
                  <td className="px-4 py-3"><button className="rounded-lg bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90">Create PO</button></td>
                </tr>
              ))}
              {(lowStock ?? []).length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">All stock levels are healthy.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'po' && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>{['PO Number', 'Supplier', 'Status', 'Items', 'Total', 'Expected'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(pos ?? []).map((po: any) => (
                <tr key={po.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{po.poNumber}</td>
                  <td className="px-4 py-3">{po.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs">{po.status}</span></td>
                  <td className="px-4 py-3">{po.items?.length ?? 0} items</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(po.total), po.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {(pos ?? []).length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No purchase orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(suppliers ?? []).map((s: any) => (
            <div key={s.id} className="rounded-xl border p-4">
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.email ?? '—'}</p>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>Lead: {s.leadTimeDays}d</span>
                <span>Currency: {s.currency}</span>
              </div>
            </div>
          ))}
          {(suppliers ?? []).length === 0 && <div className="col-span-3 py-12 text-center text-muted-foreground">No suppliers added yet.</div>}
        </div>
      )}
    </div>
  )
}
