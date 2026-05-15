'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDateTime, timeAgo, cn, STATUS_COLORS } from '@/lib/utils'
import { ArrowLeft, Mail, Phone, MapPin, Building2, Star, ShoppingCart, Ticket, MessageSquare, Edit3, Send, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  DEAL_CREATED: { icon: '💼', color: 'bg-blue-100' },
  STAGE_CHANGED: { icon: '➡️', color: 'bg-purple-100' },
  EMAIL_SENT: { icon: '📧', color: 'bg-green-100' },
  CALL_LOGGED: { icon: '📞', color: 'bg-amber-100' },
  NOTE_ADDED: { icon: '📝', color: 'bg-gray-100' },
  ORDER_PLACED: { icon: '🛒', color: 'bg-emerald-100' },
  DEFAULT: { icon: '📌', color: 'bg-gray-100' },
}

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient()
  const [noteText, setNoteText] = useState('')
  const [tab, setTab] = useState<'timeline' | 'orders' | 'deals' | 'tickets'>('timeline')

  const { data: contact, isLoading } = useQuery({
    queryKey: ['customer', params.id],
    queryFn: () => api.get(`/customers/${params.id}`).then((r) => r.data.data),
  })

  const addNote = useMutation({
    mutationFn: (text: string) => api.post('/crm/activities', { customerId: params.id, type: 'NOTE_ADDED', title: 'Note added', description: text }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer', params.id] }); setNoteText(''); toast.success('Note added') },
  })

  const scoreCustomer = useMutation({
    mutationFn: () => api.post(`/crm/customers/${params.id}/score`),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['customer', params.id] }); toast.success(`Lead score updated: ${res.data.data.score}`) },
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading...</div></div>
  if (!contact) return <div className="text-center py-12">Contact not found. <Link href="/crm/contacts" className="text-primary">Back to contacts</Link></div>

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || 'Unknown'
  const allActivities = contact.activities ?? []

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Link href="/crm/contacts" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Contacts
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left — Contact Card */}
        <div className="space-y-4">
          {/* Profile */}
          <div className="rounded-xl border p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                {(contact.firstName?.[0] ?? contact.email?.[0] ?? '?').toUpperCase()}
              </div>
              <button onClick={() => scoreCustomer.mutate()} disabled={scoreCustomer.isPending} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted">
                <Star className="h-3 w-3" /> Score
              </button>
            </div>
            <h1 className="text-lg font-bold">{name}</h1>
            {contact.company && <p className="text-sm text-muted-foreground">{contact.company}</p>}

            <div className="mt-4 space-y-2 text-sm">
              {contact.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{contact.email}</div>}
              {contact.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{contact.phone}</div>}
              {contact.country && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{[contact.city, contact.country].filter(Boolean).join(', ')}</div>}
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-xl border p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer Stats</h3>
            {[
              { label: 'Lifetime Value', value: formatCurrency(Number(contact.ltv)) },
              { label: 'Total Orders', value: contact.totalOrders },
              { label: 'Avg Order Value', value: formatCurrency(Number(contact.averageOrderValue)) },
              { label: 'Lead Score', value: `${contact.leadScore}/100` },
              { label: 'Loyalty Points', value: contact.loyaltyPoints?.toLocaleString() ?? 0 },
              { label: 'Source', value: contact.sourceChannel ?? contact.source ?? '—' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Tags */}
          {contact.tags?.length > 0 && (
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — 360° View */}
        <div className="xl:col-span-2 space-y-4">
          {/* Tab nav */}
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
            {(['timeline', 'orders', 'deals', 'tickets'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn('rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
                {t === 'orders' && contact.orders?.length > 0 && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-primary text-xs">{contact.orders.length}</span>}
                {t === 'tickets' && contact.tickets?.length > 0 && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-red-600 text-xs">{contact.tickets.length}</span>}
              </button>
            ))}
          </div>

          {/* Timeline */}
          {tab === 'timeline' && (
            <div className="rounded-xl border overflow-hidden">
              <div className="border-b px-4 py-3 flex gap-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && noteText.trim()) { addNote.mutate(noteText); } }}
                  placeholder="Add a note, log a call, or record an activity..."
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button onClick={() => noteText.trim() && addNote.mutate(noteText)} disabled={!noteText.trim()} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {allActivities.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">No activity yet. Add a note to start.</p>
                ) : (
                  allActivities.map((a: any) => {
                    const cfg = ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.DEFAULT
                    return (
                      <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20">
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm', cfg.color)}>{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{a.title}</p>
                          {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(a.createdAt)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Orders */}
          {tab === 'orders' && (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>{['Order #', 'Channel', 'Status', 'Total', 'Date'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(contact.orders ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No orders yet.</td></tr>
                  ) : (
                    (contact.orders ?? []).map((o: any) => (
                      <tr key={o.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium text-primary">{o.orderNumber}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{o.channel}</td>
                        <td className="px-4 py-2.5"><span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_COLORS[o.status] ?? 'bg-gray-100')}>{o.status}</span></td>
                        <td className="px-4 py-2.5 font-medium tabular-nums">{formatCurrency(Number(o.total), o.currency)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{new Date(o.orderedAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Deals */}
          {tab === 'deals' && (
            <div className="space-y-3">
              {(contact.deals ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No deals linked to this contact.</div>
              ) : (
                (contact.deals ?? []).map((d: any) => (
                  <div key={d.id} className="rounded-xl border p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Stage: <span className="font-medium">{d.stage}</span> · {d.probability}% probability</p>
                    </div>
                    <p className="font-bold">{formatCurrency(Number(d.value), d.currency)}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tickets */}
          {tab === 'tickets' && (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>{['#', 'Subject', 'Status', 'Priority', 'Created'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(contact.tickets ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No support tickets yet.</td></tr>
                  ) : (
                    (contact.tickets ?? []).map((t: any) => (
                      <tr key={t.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.ticketNumber}</td>
                        <td className="px-4 py-2.5 font-medium">{t.subject}</td>
                        <td className="px-4 py-2.5"><span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_COLORS[t.status] ?? 'bg-gray-100')}>{t.status}</span></td>
                        <td className="px-4 py-2.5 text-muted-foreground capitalize">{t.priority.toLowerCase()}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
