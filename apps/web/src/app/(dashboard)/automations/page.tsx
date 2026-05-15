'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, Zap, Play, Pause, Trash2, X, ChevronRight, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

const TRIGGER_OPTIONS = [
  { value: 'order.created', label: 'Order Created', category: 'Orders', icon: '🛒' },
  { value: 'order.status_changed', label: 'Order Status Changed', category: 'Orders', icon: '📦' },
  { value: 'customer.created', label: 'New Customer', category: 'CRM', icon: '👤' },
  { value: 'deal.stage_changed', label: 'Deal Stage Changed', category: 'CRM', icon: '💼' },
  { value: 'ticket.created', label: 'Ticket Created', category: 'Support', icon: '🎫' },
  { value: 'ticket.resolved', label: 'Ticket Resolved', category: 'Support', icon: '✅' },
  { value: 'inventory.low_stock', label: 'Low Stock Alert', category: 'Inventory', icon: '⚠️' },
  { value: 'schedule.daily', label: 'Daily Schedule', category: 'Schedule', icon: '⏰' },
  { value: 'schedule.weekly', label: 'Weekly Schedule', category: 'Schedule', icon: '📅' },
  { value: 'webhook.received', label: 'Webhook Received', category: 'External', icon: '🔗' },
]

const ACTION_OPTIONS = [
  { value: 'email.send', label: 'Send Email', icon: '📧' },
  { value: 'sms.send', label: 'Send SMS', icon: '💬' },
  { value: 'task.create', label: 'Create Task', icon: '✅' },
  { value: 'ticket.create', label: 'Create Support Ticket', icon: '🎫' },
  { value: 'deal.update', label: 'Update Deal Stage', icon: '💼' },
  { value: 'customer.tag', label: 'Tag Customer', icon: '🏷️' },
  { value: 'webhook.send', label: 'Send Webhook', icon: '🔗' },
  { value: 'slack.notify', label: 'Slack Notification', icon: '💬' },
  { value: 'wait', label: 'Wait / Delay', icon: '⏳' },
]

const AUTOMATION_TEMPLATES = [
  {
    name: 'New Order → Create Task',
    description: 'When a new order is placed, automatically create a fulfillment task',
    trigger: { type: 'order.created' },
    actions: [{ type: 'task.create', config: { title: 'Fulfill order {{order.orderNumber}}', priority: 'HIGH' } }],
  },
  {
    name: 'Low Stock Alert → Create Ticket',
    description: 'When inventory falls below threshold, create a reorder support ticket',
    trigger: { type: 'inventory.low_stock' },
    actions: [{ type: 'ticket.create', config: { subject: 'Low stock: {{product.name}}', priority: 'HIGH' } }],
  },
  {
    name: 'New Customer → Welcome Email',
    description: 'Send a personalized welcome email when a new customer signs up',
    trigger: { type: 'customer.created' },
    actions: [{ type: 'email.send', config: { subject: 'Welcome to SVA Organics!' } }],
  },
  {
    name: 'Ticket Resolved → CSAT Email',
    description: 'Send customer satisfaction survey after ticket resolution',
    trigger: { type: 'ticket.resolved' },
    actions: [{ type: 'wait', config: { hours: 24 } }, { type: 'email.send', config: { subject: 'How did we do? Rate your experience' } }],
  },
]

function CreateAutomationModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [step, setStep] = useState<'trigger' | 'actions' | 'details'>('trigger')
  const [trigger, setTrigger] = useState<any>(null)
  const [actions, setActions] = useState<any[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const addAction = (type: string) => {
    setActions((prev) => [...prev, { type, config: {} }])
  }
  const removeAction = (i: number) => setActions((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">Build Automation</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-5">
          {(['trigger', 'actions', 'details'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button onClick={() => setStep(s)}
                className={cn('rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold',
                  step === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                )}>{i + 1}</button>
              <span className={cn('text-xs capitalize', step === s ? 'font-medium' : 'text-muted-foreground')}>{s}</span>
              {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {step === 'trigger' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">What starts this automation?</p>
            {Object.entries(
              TRIGGER_OPTIONS.reduce((acc, t) => { (acc[t.category] = acc[t.category] ?? []).push(t); return acc }, {} as any)
            ).map(([cat, opts]: any) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{cat}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {opts.map((t: any) => (
                    <button key={t.value} onClick={() => { setTrigger({ type: t.value }); setStep('actions') }}
                      className={cn('flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors hover:border-primary hover:bg-muted/30',
                        trigger?.type === t.value && 'border-primary bg-primary/5'
                      )}>
                      <span>{t.icon}</span>
                      <span className="font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'actions' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Trigger</p>
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span>{TRIGGER_OPTIONS.find((t) => t.value === trigger?.type)?.label ?? trigger?.type}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Actions</p>
              <div className="space-y-1.5 mb-3">
                {actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                    <span>{ACTION_OPTIONS.find((ao) => ao.value === a.type)?.icon ?? '⚡'}</span>
                    <span className="flex-1">{ACTION_OPTIONS.find((ao) => ao.value === a.type)?.label ?? a.type}</span>
                    <button onClick={() => removeAction(i)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ACTION_OPTIONS.map((a) => (
                  <button key={a.value} onClick={() => addAction(a.value)}
                    className="flex items-center gap-1.5 rounded-lg border p-2 text-xs hover:border-primary hover:bg-muted/30 transition-colors">
                    <span>{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {actions.length > 0 && (
              <button onClick={() => setStep('details')} className="w-full rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90">
                Next: Name this automation →
              </button>
            )}
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Automation Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Order → Fulfillment Task"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-medium">Summary</p>
              <p>Trigger: <span className="font-medium">{TRIGGER_OPTIONS.find((t) => t.value === trigger?.type)?.label}</span></p>
              <p>Actions: <span className="font-medium">{actions.map((a) => ACTION_OPTIONS.find((ao) => ao.value === a.type)?.label).join(' → ')}</span></p>
            </div>
            <button
              onClick={() => {
                if (!name.trim()) return toast.error('Name required')
                onCreate({ name, description, trigger, actions, conditions: [], isActive: true })
              }}
              className="w-full rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
            >Create & Activate Automation</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AutomationsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then((r) => r.data.data),
  })

  const { data: runs = [] } = useQuery({
    queryKey: ['automation', 'runs', selectedId],
    queryFn: () => api.get(`/automations/${selectedId}/runs`).then((r) => r.data.data),
    enabled: !!selectedId,
  })

  const createAutomation = useMutation({
    mutationFn: (d: any) => api.post('/automations', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); setShowCreate(false); toast.success('Automation created') },
    onError: () => toast.error('Failed to create automation'),
  })

  const toggleAutomation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/automations/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  })

  const deleteAutomation = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); if (selectedId) setSelectedId(null); toast.success('Automation deleted') },
  })

  const createFromTemplate = (template: any) => {
    createAutomation.mutate({
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      actions: template.actions,
      conditions: [],
      isActive: true,
    })
  }

  const selectedAutomation = (automations as any[]).find((a: any) => a.id === selectedId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Automations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">No-code workflows that run automatically</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Automation
        </button>
      </div>

      {/* Templates */}
      {(automations as any[]).length === 0 && !isLoading && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Start with a template</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AUTOMATION_TEMPLATES.map((t) => (
              <button key={t.name} onClick={() => createFromTemplate(t)}
                className="rounded-xl border p-4 text-left hover:border-primary hover:bg-muted/30 transition-all group">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm group-hover:text-primary">{t.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Automations list */}
        <div className={cn('space-y-2', selectedId && 'xl:col-span-1')}>
          {isLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl border bg-muted animate-pulse" />)
          ) : (automations as any[]).length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No automations yet.
            </div>
          ) : (
            (automations as any[]).map((a: any) => (
              <button key={a.id} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                className={cn('w-full text-left rounded-xl border p-4 transition-all hover:border-primary',
                  selectedId === a.id && 'border-primary bg-primary/5'
                )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                      a.isActive ? 'bg-emerald-100' : 'bg-muted'
                    )}>
                      <Zap className={cn('h-3.5 w-3.5', a.isActive ? 'text-emerald-600' : 'text-muted-foreground')} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{(a.trigger as any)?.type ?? 'No trigger'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleAutomation.mutate({ id: a.id, isActive: !a.isActive }) }}
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
                      {a.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteAutomation.mutate(a.id) }}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{a.runCount ?? 0} runs</span>
                  {a.lastRunAt && <span>Last: {new Date(a.lastRunAt).toLocaleDateString()}</span>}
                  <span className={cn('rounded-full px-1.5 py-0.5', a.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>
                    {a.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Run history */}
        {selectedId && selectedAutomation && (
          <div className="xl:col-span-2 rounded-xl border overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold text-sm">{selectedAutomation.name} — Run History</h2>
            </div>
            <div className="divide-y">
              {(runs as any[]).length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No runs yet. Activate the automation to start tracking runs.
                </div>
              ) : (
                (runs as any[]).map((run: any) => (
                  <div key={run.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    {run.status === 'SUCCESS' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : run.status === 'FAILED' ? (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <div className="flex-1">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium',
                        run.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' :
                        run.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      )}>{run.status}</span>
                      {run.errorMessage && <p className="text-xs text-red-600 mt-0.5">{run.errorMessage}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateAutomationModal onClose={() => setShowCreate(false)} onCreate={(d) => createAutomation.mutate(d)} />
      )}
    </div>
  )
}
