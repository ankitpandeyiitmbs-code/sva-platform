'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Search, Plus, Filter, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-gray-100 text-gray-600',
}

const CHANNEL_ICONS: Record<string, string> = {
  EMAIL: '📧',
  CHAT: '💬',
  PHONE: '📞',
  AMAZON: '📦',
  SHOPIFY: '🛍️',
}

function CreateTicketModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [form, setForm] = useState({ subject: '', description: '', priority: 'NORMAL', channel: 'EMAIL', customerEmail: '' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">New Ticket</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subject *</label>
            <input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Describe the issue"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Customer Email</label>
            <input value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} placeholder="customer@example.com"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Channel</label>
              <select value={form.channel} onChange={(e) => set('channel', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {['EMAIL', 'CHAT', 'PHONE', 'AMAZON', 'SHOPIFY'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              if (!form.subject.trim()) return toast.error('Subject required')
              onCreate({ subject: form.subject, description: form.description, priority: form.priority, channel: form.channel })
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >Create Ticket</button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function TicketList() {
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') ?? '')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', 'list', page, search, statusFilter, priorityFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      return api.get(`/tickets?${params}`).then((r) => r.data)
    },
  })

  const createTicket = useMutation({
    mutationFn: (d: any) => api.post('/tickets', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); setShowCreate(false); toast.success('Ticket created') },
  })

  const tickets = data?.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Support Tickets</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search tickets..."
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
              className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                statusFilter === s ? 'bg-primary text-white border-primary' : 'hover:bg-muted'
              )}>{s || 'All'}</button>
          ))}
        </div>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
          className="rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary">
          <option value="">All Priorities</option>
          {['CRITICAL', 'HIGH', 'NORMAL', 'LOW'].map((p) => <option key={p}>{p}</option>)}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} tickets</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Ticket', 'Subject', 'Customer', 'Priority', 'Status', 'Channel', 'Created'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
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
            ) : tickets.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No tickets found.</td></tr>
            ) : (
              tickets.map((t: any) => (
                <tr key={t.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.ticketNumber}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/support/tickets/${t.id}`} className="font-medium hover:text-primary truncate block max-w-[250px]">
                      {t.subject}
                    </Link>
                    {t._count?.messages > 0 && <span className="text-xs text-muted-foreground">{t._count.messages} messages</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.customer
                      ? [t.customer.firstName, t.customer.lastName].filter(Boolean).join(' ') || t.customer.email
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[t.priority] ?? 'bg-muted')}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[t.status] ?? 'bg-muted')}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <span title={t.channel}>{CHANNEL_ICONS[t.channel] ?? '📨'} {t.channel}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Prev</button>
          <span className="text-sm text-muted-foreground">Page {page} of {data?.totalPages}</span>
          <button disabled={page === data?.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Next</button>
        </div>
      )}

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreate={(d) => createTicket.mutate(d)} />}
    </div>
  )
}

export default function TicketsPage() {
  return (
    <Suspense>
      <TicketList />
    </Suspense>
  )
}
