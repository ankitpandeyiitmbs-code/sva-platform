'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDateTime, cn, STATUS_COLORS, CHANNEL_COLORS } from '@/lib/utils'
import { useState } from 'react'
import { Search, RefreshCw, X, MapPin, Package, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

const CHANNEL_LABELS: Record<string, string> = {
  AMAZON_US: 'Amazon US', AMAZON_IN: 'Amazon IN', AMAZON_AE: 'Amazon AE',
  AMAZON_UK: 'Amazon UK', AMAZON_AU: 'Amazon AU', WALMART: 'Walmart',
  TIKTOK_SHOP: 'TikTok', SHOPIFY: 'Shopify', MYNTRA: 'Myntra', FLIPKART: 'Flipkart',
}

const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
const CHANNELS = Object.keys(CHANNEL_LABELS)

const FULFILLMENT_COLORS: Record<string, string> = {
  UNFULFILLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  FULFILLED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
}

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', page, search, statusFilter, channelFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (channelFilter) params.set('channel', channelFilter)
      return api.get(`/orders?${params}`).then((r) => r.data)
    },
  })

  const { data: orderDetail } = useQuery({
    queryKey: ['order', selected?.id],
    queryFn: () => api.get(`/orders/${selected.id}`).then((r) => r.data.data),
    enabled: !!selected?.id,
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}`, { status }),
    onSuccess: () => { toast.success('Order status updated'); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['order', selected?.id] }) },
    onError: () => toast.error('Failed to update status'),
  })

  const orders = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex gap-5 h-full">
      {/* Main List */}
      <div className={cn('flex-1 space-y-4 min-w-0', selected && 'hidden xl:block')}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search order #..."
              className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={channelFilter} onChange={(e) => { setChannelFilter(e.target.value); setPage(1) }}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Channels</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
          <button onClick={() => refetch()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <span className="ml-auto text-sm text-muted-foreground">{total.toLocaleString()} orders</span>
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {['Order #', 'Channel', 'Customer', 'Status', 'Fulfillment', 'Total', 'Date', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-t">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No orders found.</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">Connect a sales channel and sync to import orders.</p>
                  </td>
                </tr>
              ) : (
                orders.map((order: any) => (
                  <tr key={order.id}
                    onClick={() => setSelected(order)}
                    className={cn('border-t hover:bg-muted/20 transition-colors cursor-pointer', selected?.id === order.id && 'bg-muted/30')}
                  >
                    <td className="px-4 py-3 font-medium text-primary">{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CHANNEL_COLORS[order.channel] ?? '#6B7280' }} />
                        {CHANNEL_LABELS[order.channel] ?? order.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">
                      {order.customer ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() || order.customer.email : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700')}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs', FULFILLMENT_COLORS[order.fulfillmentStatus] ?? 'bg-gray-100 text-gray-700')}>
                        {order.fulfillmentStatus ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{formatCurrency(Number(order.total), order.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(order.orderedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
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

      {/* Detail Panel */}
      {selected && (
        <div className="w-full xl:w-[420px] shrink-0 rounded-xl border bg-background flex flex-col overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="font-semibold">{selected.orderNumber}</p>
              <p className="text-xs text-muted-foreground">{CHANNEL_LABELS[selected.channel] ?? selected.channel}</p>
            </div>
            <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Status Update */}
            <div className="flex items-center gap-3">
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', STATUS_COLORS[selected.status] ?? 'bg-gray-100 text-gray-700')}>
                {selected.status}
              </span>
              <select
                defaultValue={selected.status}
                onChange={(e) => updateStatus({ id: selected.id, status: e.target.value })}
                className="ml-auto rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Order Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-bold mt-0.5">{formatCurrency(Number(selected.total), selected.currency)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium mt-0.5 text-xs">{formatDateTime(selected.orderedAt)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Payment</p>
                <p className="font-medium mt-0.5">{selected.paymentStatus ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Fulfillment</p>
                <p className="font-medium mt-0.5">{selected.fulfillmentStatus ?? '—'}</p>
              </div>
            </div>

            {/* Customer */}
            {(orderDetail ?? selected)?.customer && (
              <div className="rounded-lg border p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</p>
                <p className="font-medium">{[(orderDetail ?? selected).customer.firstName, (orderDetail ?? selected).customer.lastName].filter(Boolean).join(' ') || '—'}</p>
                <p className="text-sm text-muted-foreground">{(orderDetail ?? selected).customer.email}</p>
                {(orderDetail ?? selected).customer.phone && <p className="text-sm text-muted-foreground">{(orderDetail ?? selected).customer.phone}</p>}
              </div>
            )}

            {/* Shipping Address */}
            {(orderDetail ?? selected)?.shippingAddress && (
              <div className="rounded-lg border p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><MapPin className="h-3 w-3" />Ship To</p>
                {(() => {
                  const addr = (orderDetail ?? selected).shippingAddress as any
                  return (
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {addr.name && <p className="font-medium text-foreground">{addr.name}</p>}
                      {addr.line1 && <p>{addr.line1}</p>}
                      {addr.line2 && <p>{addr.line2}</p>}
                      {(addr.city || addr.state || addr.zip) && <p>{[addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}</p>}
                      {addr.country && <p>{addr.country}</p>}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Line Items */}
            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>
              </div>
              <div className="divide-y">
                {((orderDetail ?? selected)?.items ?? []).map((item: any, i: number) => (
                  <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku}</p>
                    </div>
                    <div className="text-right text-sm shrink-0">
                      <p className="font-medium">{formatCurrency(Number(item.total), selected.currency)}</p>
                      <p className="text-xs text-muted-foreground">×{item.quantity} @ {formatCurrency(Number(item.unitPrice), selected.currency)}</p>
                    </div>
                  </div>
                ))}
                {((orderDetail ?? selected)?.items ?? []).length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No items</div>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(Number(selected.subtotal ?? 0), selected.currency)}</span></div>
              {Number(selected.shipping ?? 0) > 0 && <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{formatCurrency(Number(selected.shipping), selected.currency)}</span></div>}
              {Number(selected.tax ?? 0) > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{formatCurrency(Number(selected.tax), selected.currency)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span>{formatCurrency(Number(selected.total), selected.currency)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
