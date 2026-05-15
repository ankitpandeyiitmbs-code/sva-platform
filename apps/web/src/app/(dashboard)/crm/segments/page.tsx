'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Users, RefreshCw, ChevronRight, X, Filter } from 'lucide-react'
import { toast } from 'sonner'

const CONDITION_FIELDS = [
  { value: 'ltv', label: 'Lifetime Value ($)' },
  { value: 'totalOrders', label: 'Total Orders' },
  { value: 'leadScore', label: 'Lead Score' },
  { value: 'loyaltyTier', label: 'Loyalty Tier' },
  { value: 'country', label: 'Country' },
  { value: 'sourceChannel', label: 'Source Channel' },
  { value: 'loyaltyPoints', label: 'Loyalty Points' },
]

const OPERATORS: Record<string, string[]> = {
  ltv: ['>', '<', '>=', '<=', '='],
  totalOrders: ['>', '<', '>=', '<=', '='],
  leadScore: ['>', '<', '>=', '<=', '='],
  loyaltyPoints: ['>', '<', '>=', '<=', '='],
  loyaltyTier: ['=', '!='],
  country: ['=', '!='],
  sourceChannel: ['=', '!='],
}

const SEGMENT_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-violet-100 text-violet-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
]

function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
}: {
  condition: any
  index: number
  onChange: (i: number, c: any) => void
  onRemove: (i: number) => void
}) {
  const ops = OPERATORS[condition.field] ?? ['=', '!=', '>', '<']
  return (
    <div className="flex items-center gap-2">
      {index > 0 && <span className="text-xs font-medium text-muted-foreground w-6">AND</span>}
      {index === 0 && <span className="text-xs w-6" />}
      <select
        value={condition.field}
        onChange={(e) => onChange(index, { ...condition, field: e.target.value, operator: OPERATORS[e.target.value]?.[0] ?? '=' })}
        className="rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
      >
        {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onChange(index, { ...condition, operator: e.target.value })}
        className="rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary w-16"
      >
        {ops.map((op) => <option key={op} value={op}>{op}</option>)}
      </select>
      <input
        value={condition.value}
        onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
        placeholder="value"
        className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
      />
      <button onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function CreateSegmentModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [conditions, setConditions] = useState([{ field: 'ltv', operator: '>', value: '' }])

  const updateCondition = (i: number, c: any) => setConditions((prev) => prev.map((x, idx) => (idx === i ? c : x)))
  const removeCondition = (i: number) => setConditions((prev) => prev.filter((_, idx) => idx !== i))
  const addCondition = () => setConditions((prev) => [...prev, { field: 'ltv', operator: '>', value: '' }])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">Create Segment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Segment Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High-Value Customers"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this segment represent?"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Conditions</label>
              <button onClick={addCondition} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="h-3 w-3" /> Add condition
              </button>
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              {conditions.map((c, i) => (
                <ConditionRow key={i} condition={c} index={i} onChange={updateCondition} onRemove={removeCondition} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              if (!name.trim()) return toast.error('Name required')
              const filled = conditions.filter((c) => c.value.trim())
              if (filled.length === 0) return toast.error('Add at least one condition with a value')
              onCreate({ name, description, conditions: filled })
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >
            Create Segment
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function SegmentsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const { data: segments = [], isLoading } = useQuery({
    queryKey: ['crm', 'segments'],
    queryFn: () => api.get('/crm/segments').then((r) => r.data.data),
  })

  const { data: segmentDetail } = useQuery({
    queryKey: ['crm', 'segment', selected],
    queryFn: () => api.get(`/crm/segments/${selected}`).then((r) => r.data.data),
    enabled: !!selected,
  })

  const createSegment = useMutation({
    mutationFn: (data: any) => api.post('/crm/segments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'segments'] })
      setShowCreate(false)
      toast.success('Segment created')
    },
    onError: () => toast.error('Failed to create segment'),
  })

  const deleteSegment = useMutation({
    mutationFn: (id: string) => api.delete(`/crm/segments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'segments'] })
      if (selected) setSelected(null)
      toast.success('Segment deleted')
    },
    onError: () => toast.error('Failed to delete segment'),
  })

  const refreshSegment = useMutation({
    mutationFn: (id: string) => api.post(`/crm/segments/${id}/refresh`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'segments'] })
      qc.invalidateQueries({ queryKey: ['crm', 'segment', selected] })
      toast.success('Segment refreshed')
    },
  })

  const selectedSeg = segments.find((s: any) => s.id === selected)
  const members = segmentDetail?.members ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Customer Segments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Dynamic audiences built from customer attributes</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Segment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Segment List */}
        <div className="space-y-2">
          {isLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl border bg-muted animate-pulse" />)
          ) : segments.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No segments yet. Create your first dynamic audience.
            </div>
          ) : (
            segments.map((seg: any, i: number) => (
              <button
                key={seg.id}
                onClick={() => setSelected(seg.id === selected ? null : seg.id)}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all hover:border-primary',
                  selected === seg.id && 'border-primary bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEGMENT_COLORS[i % SEGMENT_COLORS.length])}>
                        <Users className="h-3 w-3 inline mr-1" />{seg._count?.members ?? 0}
                      </span>
                      <span className="font-medium text-sm truncate">{seg.name}</span>
                    </div>
                    {seg.description && <p className="text-xs text-muted-foreground mt-1 truncate">{seg.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {((seg.rules as any[]) ?? []).length} condition{((seg.rules as any[]) ?? []).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', selected === seg.id && 'rotate-90')} />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Segment Detail */}
        <div className="xl:col-span-2">
          {!selected ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              Select a segment to view its members and conditions.
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="border-b px-4 py-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{selectedSeg?.name}</h2>
                  {selectedSeg?.description && <p className="text-xs text-muted-foreground mt-0.5">{selectedSeg.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refreshSegment.mutate(selected)}
                    disabled={refreshSegment.isPending}
                    className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted"
                  >
                    <RefreshCw className={cn('h-3 w-3', refreshSegment.isPending && 'animate-spin')} /> Refresh
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this segment?')) deleteSegment.mutate(selected)
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/5"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>

              {/* Rules */}
              {(selectedSeg?.rules as any[])?.length > 0 && (
                <div className="border-b px-4 py-3 bg-muted/20">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Conditions (ALL must match)</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedSeg.rules as any[]).map((c: any, i: number) => (
                      <span key={i} className="rounded-lg border bg-background px-2 py-1 text-xs font-mono">
                        {c.field} {c.operator} {c.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Members table */}
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {['Contact', 'Email', 'Country', 'LTV', 'Lead Score'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No members match this segment yet. Try refreshing.
                      </td>
                    </tr>
                  ) : (
                    members.slice(0, 50).map((m: any) => {
                      const c = m.customer ?? m
                      return (
                        <tr key={m.id} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">
                            {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.email ?? '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{c.country ?? '—'}</td>
                          <td className="px-4 py-2.5 font-medium tabular-nums">
                            ${Number(c.ltv ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">{c.leadScore ?? 0}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
              {members.length > 50 && (
                <div className="border-t px-4 py-2.5 text-xs text-muted-foreground text-center">
                  Showing first 50 of {members.length} members
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateSegmentModal
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createSegment.mutate(data)}
        />
      )}
    </div>
  )
}
