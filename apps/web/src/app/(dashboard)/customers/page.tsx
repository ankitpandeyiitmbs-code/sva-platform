'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import {
  Users, Search, Filter, ChevronDown, X, Plus, TrendingUp,
  ShoppingCart, Star, Mail, Phone, MapPin, Calendar,
  ExternalLink, ChevronRight, Package, Award, Tag,
  RefreshCw, MoreHorizontal, Edit2, Trash2, BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'

const CHANNEL_LABELS: Record<string, string> = {
  AMAZON_US: 'Amazon US', AMAZON_IN: 'Amazon IN', AMAZON_UK: 'Amazon UK',
  AMAZON_AE: 'Amazon UAE', AMAZON_AU: 'Amazon AU',
  WALMART: 'Walmart', TIKTOK_SHOP: 'TikTok Shop',
  SHOPIFY: 'Shopify', MYNTRA: 'Myntra', FLIPKART: 'Flipkart',
  DIRECT: 'Direct',
}
const CHANNEL_COLORS: Record<string, string> = {
  AMAZON_US: 'bg-orange-100 text-orange-700',
  AMAZON_IN: 'bg-orange-100 text-orange-700',
  AMAZON_UK: 'bg-orange-100 text-orange-700',
  AMAZON_AE: 'bg-orange-100 text-orange-700',
  AMAZON_AU: 'bg-orange-100 text-orange-700',
  WALMART: 'bg-blue-100 text-blue-700',
  TIKTOK_SHOP: 'bg-pink-100 text-pink-700',
  SHOPIFY: 'bg-green-100 text-green-700',
}
const TIER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  GOLD: { label: 'Gold', color: 'text-yellow-600 bg-yellow-50', icon: '🥇' },
  SILVER: { label: 'Silver', color: 'text-slate-600 bg-slate-100', icon: '🥈' },
  BRONZE: { label: 'Bronze', color: 'text-amber-700 bg-amber-50', icon: '🥉' },
  VIP: { label: 'VIP', color: 'text-purple-700 bg-purple-50', icon: '👑' },
}

function getInitials(c: any) {
  const n = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
  if (n) return n.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  if (c.email) return c.email[0].toUpperCase()
  return '?'
}
function getColor(id: string) {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500']
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % colors.length
  return colors[h]
}
function timeAgo(d: string) {
  if (!d) return '—'
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 86400) return 'Today'
  if (diff < 172800) return 'Yesterday'
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`
  return `${Math.floor(diff / 31536000)}y ago`
}

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, iconColor, iconBg }: any) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>
    </div>
  )
}

// ── Add Customer Modal ────────────────────────────────────
function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', country: '', city: '', source: 'DIRECT', sourceChannel: 'DIRECT' })
  const qc = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/customers', data),
    onSuccess: () => { toast.success('Customer created'); qc.invalidateQueries({ queryKey: ['customers'] }); onCreated(); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Add Customer</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">First Name</label>
              <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Jane" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Last Name</label>
              <input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 0100" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Acme Inc" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="New York" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Country</label>
              <input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="US" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Source Channel</label>
            <select value={form.sourceChannel} onChange={e => setForm(p => ({ ...p, sourceChannel: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            {createMutation.isPending ? 'Creating…' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Customer Detail Panel ─────────────────────────────────
function CustomerPanel({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data: res, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.get(`/customers/${customerId}`).then(r => r.data.data),
  })
  const c = res

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[440px] flex-col border-l bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="font-semibold">Customer Profile</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !c ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Not found</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0', getColor(c.id))}>
              {getInitials(c)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg leading-tight">
                {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Anonymous'}
              </p>
              {c.company && <p className="text-sm text-muted-foreground">{c.company}</p>}
              <div className="flex items-center gap-2 mt-1.5">
                {c.sourceChannel && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CHANNEL_COLORS[c.sourceChannel] ?? 'bg-muted text-muted-foreground')}>
                    {CHANNEL_LABELS[c.sourceChannel] ?? c.sourceChannel}
                  </span>
                )}
                {c.loyaltyTier && TIER_CONFIG[c.loyaltyTier] && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1', TIER_CONFIG[c.loyaltyTier].color)}>
                    {TIER_CONFIG[c.loyaltyTier].icon} {TIER_CONFIG[c.loyaltyTier].label}
                  </span>
                )}
                {!c.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">Inactive</span>}
              </div>
            </div>
          </div>

          {/* LTV Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Lifetime Value', value: formatCurrency(Number(c.ltv ?? 0)) },
              { label: 'Total Orders', value: formatNumber(c.totalOrders ?? 0) },
              { label: 'Avg. Order', value: formatCurrency(Number(c.averageOrderValue ?? 0)) },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-base font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
            {c.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${c.email}`} className="text-primary hover:underline truncate">{c.email}</a>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{c.phone}</span>
              </div>
            )}
            {(c.city || c.country) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{[c.city, c.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Customer since {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          {/* Tags */}
          {c.tags?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {c.tags.map((t: string) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full border text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          {c.orders?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recent Orders ({c.orders.length})
              </p>
              <div className="space-y-2">
                {c.orders.slice(0, 8).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(o.orderedAt)} · {CHANNEL_LABELS[o.channel] ?? o.channel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(Number(o.total))}</p>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded',
                        o.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                        o.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                        o.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700')}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loyalty */}
          {(c.loyaltyPoints > 0 || c.leadScore > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Award className="h-3 w-3" /> Loyalty Points</p>
                <p className="mt-0.5 text-lg font-bold">{formatNumber(c.loyaltyPoints)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" /> Lead Score</p>
                <p className="mt-0.5 text-lg font-bold">{c.leadScore}/100</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {c.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [sort, setSort] = useState('createdAt')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const debounce = useCallback((val: string) => {
    setDebouncedSearch(val); setPage(1)
  }, [])

  const { data: stats } = useQuery({
    queryKey: ['customers', 'stats'],
    queryFn: () => api.get('/customers/stats').then(r => r.data.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, debouncedSearch, channelFilter, tierFilter, sort],
    queryFn: () => api.get('/customers', {
      params: { page, limit: 50, search: debouncedSearch || undefined, channel: channelFilter || undefined, tier: tierFilter || undefined, sort },
    }).then(r => r.data),
  })

  const customers: any[] = data?.data ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => { toast.success('Customer deleted'); qc.invalidateQueries({ queryKey: ['customers'] }); if (selectedId) setSelectedId(null) },
    onError: () => toast.error('Failed to delete'),
  })

  const backfillMutation = useMutation({
    mutationFn: () => api.post('/customers/backfill'),
    onSuccess: (res) => {
      const d = res.data.data
      toast.success(`Built ${d.created} new customers, updated ${d.updated}, linked ${d.linked} orders`)
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Backfill failed'),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatNumber(total)} customers across all channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(stats?.total === 0 || total === 0) && (
            <button
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', backfillMutation.isPending && 'animate-spin')} />
              {backfillMutation.isPending ? 'Building customers…' : 'Build from Orders'}
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Customers" value={formatNumber(stats?.total ?? 0)} sub={`${formatNumber(stats?.active ?? 0)} active`} icon={Users} iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-950/30" />
        <StatCard label="Total Revenue (LTV)" value={formatCurrency(stats?.totalRevenue ?? 0)} sub="All-time" icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-50 dark:bg-emerald-950/30" />
        <StatCard label="Avg. Lifetime Value" value={formatCurrency(stats?.avgLtv ?? 0)} sub="Per customer" icon={BarChart3} iconColor="text-violet-600" iconBg="bg-violet-50 dark:bg-violet-950/30" />
        <StatCard label="Repeat Rate" value={`${stats?.repeatRate ?? 0}%`} sub="2+ orders" icon={RefreshCw} iconColor="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-950/30" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); debounce(e.target.value) }}
            placeholder="Search name, email, company…"
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm"
          />
        </div>

        <select value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(1) }} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">All Channels</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1) }} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">All Tiers</option>
          <option value="VIP">👑 VIP</option>
          <option value="GOLD">🥇 Gold</option>
          <option value="SILVER">🥈 Silver</option>
          <option value="BRONZE">🥉 Bronze</option>
        </select>

        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1) }} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="createdAt">Newest First</option>
          <option value="ltv">Highest LTV</option>
          <option value="orders">Most Orders</option>
          <option value="lastOrder">Last Order</option>
        </select>

        {(channelFilter || tierFilter || debouncedSearch) && (
          <button onClick={() => { setSearch(''); setDebouncedSearch(''); setChannelFilter(''); setTierFilter(''); setPage(1) }}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Channel</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">LTV</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Avg. Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Last Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Tier</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse" /></td>
                    ))}
                    <td />
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No customers yet</p>
                    <p className="text-sm text-muted-foreground/60 mt-1 mb-4">
                      Click <strong>Build from Orders</strong> to generate customer records from your synced orders
                    </p>
                    <button
                      onClick={() => backfillMutation.mutate()}
                      disabled={backfillMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      <RefreshCw className={cn('h-4 w-4', backfillMutation.isPending && 'animate-spin')} />
                      {backfillMutation.isPending ? 'Building…' : 'Build from Orders'}
                    </button>
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn('cursor-pointer transition-colors hover:bg-muted/40', selectedId === c.id && 'bg-primary/5')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold', getColor(c.id))}>
                          {getInitials(c)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{c.email ?? c.phone ?? c.company ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.sourceChannel ? (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CHANNEL_COLORS[c.sourceChannel] ?? 'bg-muted text-muted-foreground')}>
                          {CHANNEL_LABELS[c.sourceChannel] ?? c.sourceChannel}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium">{c.totalOrders ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold">{formatCurrency(Number(c.ltv ?? 0))}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{formatCurrency(Number(c.averageOrderValue ?? 0))}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-sm text-muted-foreground">{c.lastOrderAt ? timeAgo(c.lastOrderAt) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {c.loyaltyTier && TIER_CONFIG[c.loyaltyTier] ? (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TIER_CONFIG[c.loyaltyTier].color)}>
                          {TIER_CONFIG[c.loyaltyTier].icon} {TIER_CONFIG[c.loyaltyTier].label}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-2 py-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Side Panel */}
      {selectedId && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setSelectedId(null)} />
          <CustomerPanel customerId={selectedId} onClose={() => setSelectedId(null)} />
        </>
      )}

      {/* Add Modal */}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['customers'] })} />}
    </div>
  )
}
