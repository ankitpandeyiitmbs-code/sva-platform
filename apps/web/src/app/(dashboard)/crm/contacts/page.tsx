'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { Search, Plus, Upload, Download, Filter, Star, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const SCORE_COLOR = (score: number) =>
  score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-blue-600' : score >= 25 ? 'text-amber-600' : 'text-muted-foreground'

const TIER_COLORS: Record<string, string> = {
  GOLD: 'bg-yellow-100 text-yellow-800',
  SILVER: 'bg-gray-100 text-gray-700',
  BRONZE: 'bg-orange-100 text-orange-800',
  PLATINUM: 'bg-purple-100 text-purple-800',
}

export default function ContactsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', source: '', country: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => api.get(`/customers?page=${page}&limit=50${search ? `&search=${search}` : ''}`).then((r) => r.data),
  })

  const contacts = data?.data ?? []
  const total = data?.total ?? 0

  const createContact = useMutation({
    mutationFn: (data: any) => api.post('/customers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowNew(false); setForm({ firstName: '', lastName: '', email: '', phone: '', company: '', source: '', country: '' }); toast.success('Contact created') },
    onError: () => toast.error('Failed to create contact'),
  })

  const scoreContact = useMutation({
    mutationFn: (id: string) => api.post(`/crm/customers/${id}/score`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Lead score updated') },
  })

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search contacts..."
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
          <Upload className="h-4 w-4" /> Import CSV
        </button>
        <button className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
          <Download className="h-4 w-4" /> Export
        </button>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Contact
        </button>
        <span className="ml-auto text-sm text-muted-foreground">{total.toLocaleString()} contacts</span>
      </div>

      {/* New contact form */}
      {showNew && (
        <div className="rounded-xl border bg-muted/20 p-5 space-y-4">
          <h2 className="text-sm font-semibold">New Contact</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { key: 'firstName', label: 'First Name' },
              { key: 'lastName', label: 'Last Name' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone' },
              { key: 'company', label: 'Company' },
              { key: 'country', label: 'Country' },
            ].map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => createContact.mutate(form)} disabled={createContact.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
              {createContact.isPending ? 'Saving...' : 'Save Contact'}
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {/* Contacts table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Contact', 'Company', 'Email', 'Country', 'Lead Score', 'Orders', 'LTV', 'Tier', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-t">
                  {[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-muted animate-pulse w-16" /></td>)}
                </tr>
              ))
            ) : contacts.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No contacts found. Import a CSV or add contacts manually.</td></tr>
            ) : (
              contacts.map((c: any) => (
                <tr key={c.id} className="border-t hover:bg-muted/20 cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(c.firstName?.[0] ?? c.email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <Link href={`/crm/contacts/${c.id}`} className="font-medium hover:text-primary">
                        {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown'}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.company ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.country ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${c.leadScore}%` }} />
                      </div>
                      <span className={cn('text-xs font-medium tabular-nums', SCORE_COLOR(c.leadScore))}>{c.leadScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.totalOrders}</td>
                  <td className="px-4 py-3 tabular-nums font-medium">{formatCurrency(Number(c.ltv))}</td>
                  <td className="px-4 py-3">
                    {c.loyaltyTier ? (
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TIER_COLORS[c.loyaltyTier] ?? 'bg-muted text-muted-foreground')}>{c.loyaltyTier}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/crm/contacts/${c.id}`} className="text-muted-foreground hover:text-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Prev</button>
          <span className="text-sm text-muted-foreground">Page {page} of {data?.totalPages}</span>
          <button disabled={page === data?.totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Next</button>
        </div>
      )}
    </div>
  )
}
