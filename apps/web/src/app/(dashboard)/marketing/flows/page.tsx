'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, Zap, Trash2, Play, Pause, X } from 'lucide-react'
import { toast } from 'sonner'

const TRIGGER_TYPES = [
  { value: 'abandoned_cart', label: 'Abandoned Cart', desc: 'When a customer leaves items in cart' },
  { value: 'post_purchase', label: 'Post Purchase', desc: 'After an order is placed' },
  { value: 'win_back', label: 'Win-Back', desc: 'No purchase in 90+ days' },
  { value: 'welcome', label: 'Welcome Series', desc: 'When a new contact is created' },
  { value: 'birthday', label: 'Birthday', desc: 'On customer birthday' },
  { value: 'loyalty_tier', label: 'Loyalty Tier Change', desc: 'When tier upgrades' },
  { value: 'low_stock_alert', label: 'Low Stock Alert', desc: 'Product goes below threshold' },
  { value: 'manual', label: 'Manual Trigger', desc: 'Triggered manually' },
]

const TRIGGER_LABELS: Record<string, string> = Object.fromEntries(TRIGGER_TYPES.map((t) => [t.value, t.label]))

function CreateFlowModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('abandoned_cart')
  const [delay, setDelay] = useState('1')
  const [message, setMessage] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">Create Automation Flow</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Flow Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Abandoned Cart Recovery"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Trigger</label>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
              {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{TRIGGER_TYPES.find((t) => t.value === trigger)?.desc}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Delay (hours)</label>
            <input type="number" value={delay} onChange={(e) => setDelay(e.target.value)} min="0"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Message / Action</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              placeholder="What should this flow do? e.g. Send email with 10% discount code"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              if (!name.trim()) return toast.error('Name required')
              onCreate({
                name,
                triggerType: trigger,
                isActive: false,
                steps: [{ type: 'DELAY', delayHours: Number(delay) || 1 }, { type: 'EMAIL', message }],
              })
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >
            Create Flow
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function FlowsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ['marketing', 'flows'],
    queryFn: () => api.get('/marketing/flows').then((r) => r.data.data),
  })

  const createFlow = useMutation({
    mutationFn: (d: any) => api.post('/marketing/flows', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'flows'] }); setShowCreate(false); toast.success('Flow created') },
    onError: () => toast.error('Failed to create flow'),
  })

  const toggleFlow = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/marketing/flows/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'flows'] }),
  })

  const deleteFlow = useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/flows/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'flows'] }); toast.success('Flow deleted') },
  })

  const FLOW_TEMPLATES = [
    { trigger: 'abandoned_cart', name: 'Abandoned Cart Recovery', desc: 'Remind customers about items left in cart', emoji: '🛒' },
    { trigger: 'post_purchase', name: 'Post-Purchase Follow Up', desc: 'Thank customers and cross-sell products', emoji: '🎉' },
    { trigger: 'win_back', name: 'Win-Back Campaign', desc: 'Re-engage customers who haven\'t bought in 90 days', emoji: '💌' },
    { trigger: 'welcome', name: 'Welcome Series', desc: 'Onboard new subscribers with a 3-part series', emoji: '👋' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Automation Flows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Triggered email & SMS sequences that run automatically</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Flow
        </button>
      </div>

      {/* Templates */}
      {flows.length === 0 && !isLoading && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Start with a template</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {FLOW_TEMPLATES.map((t) => (
              <button
                key={t.trigger}
                onClick={() => createFlow.mutate({
                  name: t.name,
                  triggerType: t.trigger,
                  isActive: false,
                  steps: [{ type: 'DELAY', delayHours: 1 }, { type: 'EMAIL', message: `Template: ${t.desc}` }],
                })}
                className="rounded-xl border p-4 text-left hover:border-primary hover:bg-muted/30 transition-all group"
              >
                <span className="text-2xl">{t.emoji}</span>
                <p className="mt-2 font-medium text-sm group-hover:text-primary">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flows list */}
      {(flows.length > 0 || isLoading) && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {['Flow', 'Trigger', 'Status', 'Runs', 'Created', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-t">
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-muted animate-pulse w-16" /></td>)}
                  </tr>
                ))
              ) : (
                flows.map((f: any) => (
                  <tr key={f.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', f.isActive ? 'bg-emerald-100' : 'bg-muted')}>
                          <Zap className={cn('h-3.5 w-3.5', f.isActive ? 'text-emerald-600' : 'text-muted-foreground')} />
                        </div>
                        <span className="font-medium">{f.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {TRIGGER_LABELS[(f.trigger as any)?.type ?? f.triggerType] ?? (f.trigger as any)?.type ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium',
                        f.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {f.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{f._count?.runs ?? 0}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleFlow.mutate({ id: f.id, isActive: !f.isActive })}
                          title={f.isActive ? 'Pause' : 'Activate'}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          {f.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete flow?')) deleteFlow.mutate(f.id) }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateFlowModal onClose={() => setShowCreate(false)} onCreate={(d) => createFlow.mutate(d)} />
      )}
    </div>
  )
}
