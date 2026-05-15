'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDateTime, cn, STATUS_COLORS, CHANNEL_COLORS } from '@/lib/utils'
import { useState } from 'react'
import { Search, Filter, RefreshCw } from 'lucide-react'

const CHANNEL_LABELS: Record<string, string> = {
  AMAZON_US: 'Amazon US', AMAZON_IN: 'Amazon IN', AMAZON_AE: 'Amazon AE',
  AMAZON_UK: 'Amazon UK', AMAZON_AU: 'Amazon AU', WALMART: 'Walmart',
  TIKTOK_SHOP: 'TikTok', SHOPIFY: 'Shopify', MYNTRA: 'Myntra', FLIPKART: 'Flipkart',
}

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', page, search, statusFilter],
    queryFn: () => api.get(`/orders?page=${page}&limit=50${search ? `&search=${search}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}`).then((r) => r.data),
  })

  const orders = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number..."
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          {['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => refetch()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        <span className="ml-auto text-sm text-muted-foreground">{total.toLocaleString()} orders</span>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Order #', 'Channel', 'Customer', 'Status', 'Total', 'Date'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="border-t">
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-24" /></td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No orders found. Connect a sales channel to start importing orders.</td></tr>
            ) : (
              orders.map((order: any) => (
                <tr key={order.id} className="border-t hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium text-primary">{order.orderNumber}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_COLORS[order.channel] ?? '#6B7280' }} />
                      {CHANNEL_LABELS[order.channel] ?? order.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.customer ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() || order.customer.email : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800')}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(order.total), order.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.orderedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Prev</button>
          <span className="text-sm text-muted-foreground">Page {page} of {data.totalPages}</span>
          <button disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Next</button>
        </div>
      )}
    </div>
  )
}
