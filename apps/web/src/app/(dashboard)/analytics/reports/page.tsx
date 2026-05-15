'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, FileText, Trash2, Clock, Check, Mail } from 'lucide-react'
import { toast } from 'sonner'

const FREQUENCY_OPTIONS = ['DAILY', 'WEEKLY', 'MONTHLY']
const METRIC_OPTIONS = ['revenue', 'orders', 'customers', 'inventory', 'pnl', 'top_skus', 'channel_breakdown']
const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: '12m', label: 'Last 12 months' },
]

export default function ScheduledReportsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', frequency: 'WEEKLY', metrics: ['revenue', 'orders'], recipients: '', period: '30d', format: 'EMAIL' })

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['analytics', 'reports'],
    queryFn: () => api.get('/analytics/reports').then((r) => r.data.data),
  })

  const createReport = useMutation({
    mutationFn: (data: any) => api.post('/analytics/reports', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['analytics', 'reports'] }); setShowForm(false); toast.success('Report scheduled') },
    onError: () => toast.error('Failed to create report'),
  })

  const deleteReport = useMutation({
    mutationFn: (id: string) => api.delete(`/analytics/reports/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['analytics', 'reports'] }); toast.success('Report deleted') },
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/analytics/reports/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'reports'] }),
  })

  const toggleMetric = (m: string) =>
    setForm((f) => ({ ...f, metrics: f.metrics.includes(m) ? f.metrics.filter((x) => x !== m) : [...f.metrics, m] }))

  const handleCreate = () => {
    if (!form.name || !form.recipients) return toast.error('Name and recipients are required')
    const recipients = form.recipients.split(',').map((e) => e.trim()).filter(Boolean)
    createReport.mutate({ ...form, recipients })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold">Scheduled Reports</h1>
          <p className="text-sm text-muted-foreground">Auto-send PDF or email reports to your team on a schedule</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Report
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border bg-muted/20 p-5 space-y-4">
          <h2 className="text-sm font-semibold">Schedule New Report</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Report Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Weekly Business Summary" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {FREQUENCY_OPTIONS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Period</label>
              <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Recipients (comma-separated emails)</label>
              <input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="ceo@svaorganics.com, team@svaorganics.com" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Include Metrics</label>
            <div className="flex flex-wrap gap-2">
              {METRIC_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMetric(m)}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    form.metrics.includes(m) ? 'bg-primary text-white border-primary' : 'text-muted-foreground hover:border-primary hover:text-primary'
                  )}
                >
                  {m.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createReport.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
              <Check className="h-4 w-4" /> {createReport.isPending ? 'Saving...' : 'Schedule Report'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {/* Reports list */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No scheduled reports</p>
          <p className="text-xs text-muted-foreground">Automatically send revenue, inventory, and P&L summaries to your team.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-white">Schedule First Report</button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => (
            <div key={r.id} className={cn('rounded-xl border p-4 flex items-center gap-4', !r.isActive && 'opacity-60')}>
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', r.isActive ? 'bg-primary/10' : 'bg-muted')}>
                <FileText className={cn('h-5 w-5', r.isActive ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{r.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.frequency} · {r.period} · {r.recipients?.length ?? 0} recipient{r.recipients?.length !== 1 ? 's' : ''}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(r.metrics ?? []).map((m: string) => (
                    <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{m}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {r.lastSentAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last: {new Date(r.lastSentAt).toLocaleDateString()}
                  </div>
                )}
                <button
                  onClick={() => toggleActive.mutate({ id: r.id, isActive: !r.isActive })}
                  className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', r.isActive ? 'bg-primary' : 'bg-muted')}
                >
                  <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform', r.isActive ? 'translate-x-4' : 'translate-x-1')} />
                </button>
                <button onClick={() => deleteReport.mutate(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl border bg-muted/20 p-4 flex gap-3">
        <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Email delivery</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reports are sent via SMTP. Configure your email settings in the .env file (SMTP_HOST, SMTP_USER, SMTP_PASS).
            In development, emails appear in MailHog at <span className="font-mono">http://localhost:8025</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
