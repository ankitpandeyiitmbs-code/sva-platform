'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { Plus, Search, Send, Copy, Trash2, ChevronRight, Mail, MessageSquare, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  FAILED: 'bg-red-100 text-red-700',
}

const TYPE_ICONS: Record<string, any> = {
  EMAIL: Mail,
  SMS: Smartphone,
  PUSH: MessageSquare,
}

const CAMPAIGN_TYPES = ['EMAIL', 'SMS', 'PUSH']
const STATUS_FILTERS = ['', 'DRAFT', 'SCHEDULED', 'SENT']

function CreateCampaignModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [form, setForm] = useState({
    name: '',
    type: 'EMAIL',
    subject: '',
    content: '',
    segmentId: '',
    scheduledAt: '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const { data: segments = [] } = useQuery({
    queryKey: ['crm', 'segments'],
    queryFn: () => api.get('/crm/segments').then((r) => r.data.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">New Campaign</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Campaign Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Summer Sale 2025"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Channel</label>
            <div className="mt-1 flex gap-2">
              {CAMPAIGN_TYPES.map((t) => {
                const Icon = TYPE_ICONS[t] ?? Mail
                return (
                  <button key={t} onClick={() => set('type', t)}
                    className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                      form.type === t ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'
                    )}>
                    <Icon className="h-3.5 w-3.5" />{t}
                  </button>
                )
              })}
            </div>
          </div>
          {form.type === 'EMAIL' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email Subject</label>
              <input value={form.subject} onChange={(e) => set('subject', e.target.value)}
                placeholder="Your email subject line"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {form.type === 'EMAIL' ? 'Email Body (HTML or plain text)' : 'Message Content'}
            </label>
            <textarea value={form.content} onChange={(e) => set('content', e.target.value)}
              rows={5} placeholder={form.type === 'EMAIL' ? '<h1>Hello {{firstName}},</h1>...' : 'Your message here...'}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Audience Segment (optional)</label>
            <select value={form.segmentId} onChange={(e) => set('segmentId', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
              <option value="">All active customers</option>
              {segments.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Schedule (optional — leave blank to save as draft)</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              if (!form.name.trim()) return toast.error('Campaign name is required')
              const payload: any = {
                name: form.name,
                type: form.type,
                subject: form.subject || null,
                content: form.content ? { body: form.content } : null,
                segmentId: form.segmentId || null,
                scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
                status: form.scheduledAt ? 'SCHEDULED' : 'DRAFT',
              }
              onCreate(payload)
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >
            {form.scheduledAt ? 'Schedule Campaign' : 'Save as Draft'}
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function CampaignsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['marketing', 'campaigns', statusFilter],
    queryFn: () => api.get(`/marketing/campaigns?limit=100${statusFilter ? `&status=${statusFilter}` : ''}`).then((r) => r.data),
  })

  const campaigns: any[] = (data?.data ?? []).filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.subject ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const createCampaign = useMutation({
    mutationFn: (d: any) => api.post('/marketing/campaigns', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }); setShowCreate(false); toast.success('Campaign created') },
    onError: () => toast.error('Failed to create campaign'),
  })

  const sendNow = useMutation({
    mutationFn: (id: string) => api.post(`/marketing/campaigns/${id}/send`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }); toast.success('Campaign sent!') },
    onError: () => toast.error('Failed to send'),
  })

  const duplicate = useMutation({
    mutationFn: (id: string) => api.post(`/marketing/campaigns/${id}/duplicate`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }); toast.success('Campaign duplicated') },
  })

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }); toast.success('Campaign deleted') },
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Campaigns</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns..."
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === s ? 'bg-primary text-white border-primary' : 'hover:bg-muted'
              )}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} campaigns</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Campaign', 'Type', 'Status', 'Sent', 'Open Rate', 'Click Rate', 'Created', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-t">
                  {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-muted animate-pulse w-16" /></td>)}
                </tr>
              ))
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No campaigns yet. Create your first campaign.</td></tr>
            ) : (
              campaigns.map((c: any) => {
                const stats = c.stats as any ?? {}
                const openRate = stats.delivered > 0 ? ((stats.opens ?? 0) / stats.delivered * 100).toFixed(1) : '—'
                const clickRate = stats.delivered > 0 ? ((stats.clicks ?? 0) / stats.delivered * 100).toFixed(1) : '—'
                const TypeIcon = TYPE_ICONS[c.type] ?? Mail
                return (
                  <tr key={c.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.name}</p>
                      {c.subject && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.subject}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <TypeIcon className="h-3.5 w-3.5" />
                        <span className="text-xs">{c.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[c.status] ?? 'bg-muted')}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{stats.sent ? formatNumber(stats.sent) : '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{openRate !== '—' ? `${openRate}%` : openRate}</td>
                    <td className="px-4 py-3 tabular-nums">{clickRate !== '—' ? `${clickRate}%` : clickRate}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {c.status === 'DRAFT' && (
                          <button onClick={() => sendNow.mutate(c.id)} title="Send now"
                            className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10">
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => duplicate.mutate(c.id)} title="Duplicate"
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { if (confirm('Delete campaign?')) deleteCampaign.mutate(c.id) }} title="Delete"
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateCampaignModal onClose={() => setShowCreate(false)} onCreate={(d) => createCampaign.mutate(d)} />
      )}
    </div>
  )
}
