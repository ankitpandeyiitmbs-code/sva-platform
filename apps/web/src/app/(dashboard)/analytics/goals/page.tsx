'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { ArrowLeft, Plus, Trash2, Target } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const METRICS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
  { value: 'customers', label: 'New Customers' },
]

export default function GoalsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ metric: 'revenue', target: '', label: '', periodStart: '', periodEnd: '' })

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/analytics/goals').then((r) => r.data.data),
  })

  const { mutate: createGoal, isPending } = useMutation({
    mutationFn: (data: any) => api.post('/analytics/goals', data),
    onSuccess: () => { toast.success('Goal created'); qc.invalidateQueries({ queryKey: ['goals'] }); setShowForm(false); setForm({ metric: 'revenue', target: '', label: '', periodStart: '', periodEnd: '' }) },
    onError: () => toast.error('Failed to create goal'),
  })

  const { mutate: deleteGoal } = useMutation({
    mutationFn: (id: string) => api.delete(`/analytics/goals/${id}`),
    onSuccess: () => { toast.success('Goal deleted'); qc.invalidateQueries({ queryKey: ['goals'] }) },
  })

  const formatValue = (metric: string, value: number) => metric === 'revenue' ? formatCurrency(value) : formatNumber(value)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/analytics" className="rounded-lg border p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">Goals & Targets</h1>
          <p className="text-sm text-muted-foreground">Track your KPI targets and progress</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Goal
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border p-5 space-y-4 bg-muted/20">
          <h3 className="font-medium text-sm">Create New Goal</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Label</label>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Q1 Revenue Target"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Metric</label>
              <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Target Value</label>
              <input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="10000"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Period Start</label>
              <input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Period End</label>
              <input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createGoal({ ...form, target: parseFloat(form.target), periodStart: new Date(form.periodStart), periodEnd: new Date(form.periodEnd) })}
              disabled={isPending || !form.target || !form.periodStart || !form.periodEnd}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
              {isPending ? 'Creating...' : 'Create Goal'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-xl border p-12 text-center">
          <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No goals set yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Create your first KPI target to track progress</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {goals.map((goal: any) => {
            const pct = Math.min(goal.progress, 100)
            const isAchieved = pct >= 100
            return (
              <div key={goal.id} className={cn('rounded-xl border p-5 space-y-4', isAchieved && 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/10')}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{goal.label || `${METRICS.find(m => m.value === goal.metric)?.label} Target`}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(goal.periodStart).toLocaleDateString()} – {new Date(goal.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAchieved && <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 text-xs font-medium">✓ Achieved</span>}
                    <button onClick={() => deleteGoal(goal.id)} className="rounded-lg p-1.5 hover:bg-muted transition-colors text-muted-foreground">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">{formatValue(goal.metric, goal.actual)}</span>
                    <span className="font-medium">{formatValue(goal.metric, goal.target)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', isAchieved ? 'bg-emerald-500' : pct > 60 ? 'bg-primary' : pct > 30 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}% to goal</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
