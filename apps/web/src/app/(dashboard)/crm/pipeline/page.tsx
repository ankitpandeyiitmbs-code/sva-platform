'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, X, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STAGE_BORDER: Record<string, string> = {
  Lead: 'border-t-gray-400',
  Qualified: 'border-t-blue-400',
  Proposal: 'border-t-violet-400',
  Negotiation: 'border-t-amber-400',
  'Closed Won': 'border-t-emerald-500',
  'Closed Lost': 'border-t-red-400',
}

const PROB_COLOR = (p: number) =>
  p >= 75 ? 'text-emerald-600' : p >= 50 ? 'text-blue-600' : p >= 25 ? 'text-amber-600' : 'text-muted-foreground'

function DealCard({ deal, overlay = false }: { deal: any; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('rounded-lg border bg-background p-3 shadow-sm', overlay && 'shadow-xl rotate-1 opacity-95')}
    >
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes} className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing touch-none">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{deal.title}</p>
          {deal.customer && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {[deal.customer.firstName, deal.customer.lastName].filter(Boolean).join(' ') || deal.customer.email}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-bold tabular-nums">{formatCurrency(Number(deal.value), deal.currency)}</span>
            <span className={cn('text-xs font-medium', PROB_COLOR(deal.probability))}>{deal.probability}%</span>
          </div>
          {deal.expectedCloseDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Closes {new Date(deal.expectedCloseDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function StageColumn({ stage, deals, onAdd }: { stage: any; deals: any[]; onAdd: (stage: any) => void }) {
  const total = deals.reduce((s, d) => s + Number(d.value), 0)
  const borderClass = STAGE_BORDER[stage.name] ?? 'border-t-gray-300'

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className={cn('rounded-t-lg border-t-4 bg-muted/40 px-3 py-2.5', borderClass)}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide">{stage.name}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">{deals.length}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{formatCurrency(total)}</p>
      </div>
      <div className="flex-1 rounded-b-lg border border-t-0 bg-muted/10 p-2 min-h-[400px]">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
          </div>
        </SortableContext>
        <button
          onClick={() => onAdd(stage)}
          className="mt-2 w-full flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-3 w-3" /> Add deal
        </button>
      </div>
    </div>
  )
}

function AddDealModal({ stage, stages, onClose, onCreate }: { stage: any; stages: any[]; onClose: () => void; onCreate: (d: any) => void }) {
  const [form, setForm] = useState({ title: '', value: '', currency: 'USD', probability: '50', expectedCloseDate: '', stage: stage.name })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">New Deal</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          {([
            { key: 'title', label: 'Deal Title', type: 'text', placeholder: 'e.g. Wholesale Partnership Q3' },
            { key: 'value', label: 'Deal Value', type: 'number', placeholder: '0' },
            { key: 'probability', label: 'Probability %', type: 'number', placeholder: '50' },
            { key: 'expectedCloseDate', label: 'Expected Close Date', type: 'date', placeholder: '' },
          ] as const).map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Stage</label>
            <select value={form.stage} onChange={(e) => set('stage', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
              {stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Currency</label>
            <select value={form.currency} onChange={(e) => set('currency', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
              {['USD', 'INR', 'AED', 'GBP', 'AUD'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              if (!form.title.trim()) return toast.error('Title is required')
              onCreate({ ...form, value: Number(form.value) || 0, probability: Number(form.probability) || 50 })
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >Create Deal</button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addModal, setAddModal] = useState<any | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { data: stages = [] } = useQuery({
    queryKey: ['crm', 'stages'],
    queryFn: () => api.get('/crm/stages').then((r) => r.data.data),
  })

  const { data: deals = [] } = useQuery({
    queryKey: ['crm', 'deals'],
    queryFn: () => api.get('/crm/deals?limit=200').then((r) => r.data.data),
  })

  const moveDeal = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch(`/crm/deals/${id}`, { stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ['crm', 'deals'] })
      const prev = qc.getQueryData<any[]>(['crm', 'deals'])
      qc.setQueryData(['crm', 'deals'], (old: any[]) =>
        (old ?? []).map((d) => d.id === id ? { ...d, stage } : d)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['crm', 'deals'], ctx.prev)
      toast.error('Failed to move deal')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm', 'deals'] }),
  })

  const createDeal = useMutation({
    mutationFn: (data: any) => api.post('/crm/deals', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm', 'deals'] }); setAddModal(null); toast.success('Deal created') },
    onError: () => toast.error('Failed to create deal'),
  })

  // Group deals by stage name
  const stageMap: Record<string, any[]> = {}
  stages.forEach((s: any) => { stageMap[s.name] = [] })
  deals.forEach((d: any) => {
    if (d.stage && stageMap[d.stage] !== undefined) stageMap[d.stage].push(d)
    else if (stages.length > 0) stageMap[stages[0].name]?.push(d)
  })

  const activeDeal = activeId ? deals.find((d: any) => d.id === activeId) : null
  const totalPipeline = deals.reduce((s: number, d: any) => s + Number(d.value), 0)
  const openDeals = deals.filter((d: any) => !['Closed Won', 'Closed Lost'].includes(d.stage ?? '')).length

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = e
      if (!over) return

      const activeDealData = deals.find((d: any) => d.id === active.id)
      if (!activeDealData) return

      // Find target stage: over could be a deal id or stage name
      let targetStage: string | null = null

      // Check if over.id is a stage name
      if (stages.some((s: any) => s.name === over.id)) {
        targetStage = over.id as string
      } else {
        // Find which stage column the hovered deal belongs to
        const overDeal = deals.find((d: any) => d.id === over.id)
        if (overDeal) targetStage = overDeal.stage
      }

      if (!targetStage || activeDealData.stage === targetStage) return
      moveDeal.mutate({ id: active.id as string, stage: targetStage })
    },
    [deals, stages, moveDeal]
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Deal Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {openDeals} open deals · {formatCurrency(totalPipeline)} total pipeline
          </p>
        </div>
        {stages.length > 0 && (
          <button
            onClick={() => setAddModal(stages[0])}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Deal
          </button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage: any) => (
            <StageColumn key={stage.id} stage={stage} deals={stageMap[stage.name] ?? []} onAdd={setAddModal} />
          ))}
        </div>
        <DragOverlay>{activeDeal && <DealCard deal={activeDeal} overlay />}</DragOverlay>
      </DndContext>

      {addModal && (
        <AddDealModal
          stage={addModal}
          stages={stages}
          onClose={() => setAddModal(null)}
          onCreate={(data) => createDeal.mutate(data)}
        />
      )}
    </div>
  )
}
