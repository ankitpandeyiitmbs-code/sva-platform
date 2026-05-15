'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { Plus, Target, TrendingUp, Trash2, Edit3, Check } from 'lucide-react'
import { toast } from 'sonner'

const METRIC_OPTIONS = [
  { value: 'revenue', label: 'Revenue', format: 'currency' },
  { value: 'orders', label: 'Orders', format: 'number' },
  { value: 'customers', label: 'New Customers', format: 'number' },
  { value: 'aov', label: 'Avg Order Value', format: 'currency' },
]

const PERIOD_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
]

export default function GoalsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ metric: 'revenue', period: 'MONTHLY', target: '', channel: '', periodStart: '', periodEnd: '' })

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['analytics', 'goals'],
    queryFn: () => api.get('/analytics/goals').then((r) => r.data.data),
    refetchInterval: 60_000,
  })

  const createGoal = useMutation({
    mutationFn: (data: any) => api.post('/analytics/goals', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['analytics', 'goals'] }); setShowForm(false); toast.success('Goal created') },
    onError: () => toast.error('Failed to create goal'),
  })

  const deleteGoal = useMutation({
    mutationFn: (id: string) => api.delete(`/analytics/goals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['analytics', 'goals'] }); toast.success('Goal deleted') },
  })

  const handleCreate = () => {
    if (!form.target || !form.periodStart || !form.periodEnd) return toast.error('Fill all fields')
    createGoal.mutate({ metric: form.metric, period: form.period, target: Number(form.target), channel: form.channel || null, periodStart: new Date(form.periodStart), periodEnd: new Date(form.periodEnd) })
  }

  const getProgressColor = (pct: number) => pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const getStatusLabel = (pct: number) => pct >= 100 ? 'Achieved' : pct >= 70 ? 'On Track' : pct >= 40 ? 'At Risk' : 'Behind'
  const getStatusColor = (pct: number) => pct >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : pct >= 70 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : pct >= 40 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'

  const summary = {
    achieved: goals.filter((g: any) => g.progress >= 100).length,
    onTrack: goals.filter((g: any) => g.progress >= 70 && g.progress < 100).length,
    atRisk: goals.filter((g: any) => g.progress < 70).length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold">Goals & Targets</h1>
          <p className="text-sm text-muted-foreground">Track progress against monthly, quarterly, and yearly targets</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Goal
        </button>
      </div>

      {/* Summary */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Achieved', value: summary.achieved, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
            { label: 'On Track', value: summary.onTrack, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'At Risk / Behind', value: summary.atRisk, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl border p-4 text-center', s.bg)}>
              <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* New Goal Form */}
      {showForm && (
        <div className="rounded-xl border bg-muted/20 p-5 space-y-4">
          <h2 className="text-sm font-semibold">Create New Goal</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Metric</label>
              <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {METRIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Period</label>
              <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Target Value</label>
              <input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="e.g. 100000" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Channel (optional)</label>
              <input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} placeholder="e.g. AMAZON_US" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start Date</label>
              <input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">End Date</label>
              <input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createGoal.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
              <Check className="h-4 w-4" /> {createGoal.isPending ? 'Saving...' : 'Save Goal'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Target className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No goals set yet</p>
          <p className="text-xs text-muted-foreground">Set monthly or quarterly revenue targets and track progress in real time.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-white">Create First Goal</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal: any) => {
            const metricCfg = METRIC_OPTIONS.find((m) => m.value === goal.metric)
            const fmt = metricCfg?.format === 'currency' ? formatCurrency(goal.actual) : formatNumber(goal.actual)
            const targetFmt = metricCfg?.format === 'currency' ? formatCurrency(goal.target) : formatNumber(goal.target)
            return (
              <div key={goal.id} className="rounded-xl border p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metricCfg?.label ?? goal.metric}</p>
                    {goal.channel && <p className="text-xs text-muted-foreground">{goal.channel}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', getStatusColor(goal.progress))}>
                      {getStatusLabel(goal.progress)}
                    </span>
                    <button onClick={() => deleteGoal.mutate(goal.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between mb-1.5">
                    <span className="text-2xl font-bold tabular-nums">{fmt}</span>
                    <span className="text-sm text-muted-foreground">of {targetFmt}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getProgressColor(goal.progress))}
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{goal.progress.toFixed(1)}% of target</span>
                    <span>{goal.period}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {new Date(goal.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' — '}
                  {new Date(goal.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
