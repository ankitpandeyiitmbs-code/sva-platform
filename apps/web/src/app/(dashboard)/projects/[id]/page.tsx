'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ArrowLeft, Plus, X, CheckSquare, Calendar, Flag, GripVertical } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const TASK_COLUMNS = [
  { id: 'TODO', label: 'To Do', color: 'border-t-gray-300', bg: 'bg-gray-50 dark:bg-gray-900/20' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-t-blue-400', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'border-t-violet-400', bg: 'bg-violet-50/30 dark:bg-violet-900/10' },
  { id: 'DONE', label: 'Done', color: 'border-t-emerald-500', bg: 'bg-emerald-50/30 dark:bg-emerald-900/10' },
]

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-amber-500',
  URGENT: 'text-red-500',
}

const PRIORITY_BG: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
}

function AddTaskModal({ projectId, defaultStatus, onClose, onCreate }: {
  projectId: string; defaultStatus: string; onClose: () => void; onCreate: (d: any) => void
}) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: defaultStatus, dueDate: '', estimatedMins: '' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">New Task</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Task title"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {TASK_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Due Date</label>
              <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Est. Minutes</label>
              <input type="number" value={form.estimatedMins} onChange={(e) => set('estimatedMins', e.target.value)} min="0"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              if (!form.title.trim()) return toast.error('Title required')
              onCreate({
                title: form.title,
                description: form.description || null,
                priority: form.priority,
                status: form.status,
                projectId,
                dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
                estimatedMins: form.estimatedMins ? Number(form.estimatedMins) : null,
              })
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >Create Task</button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task, onStatusChange, onDelete }: { task: any; onStatusChange: (id: string, status: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium flex-1">{task.title}</p>
        <button onClick={() => { if (confirm('Delete task?')) onDelete(task.id) }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_BG[task.priority] ?? 'bg-muted')}>
          <Flag className={cn('h-2.5 w-2.5 inline mr-0.5', PRIORITY_COLORS[task.priority])} />
          {task.priority}
        </span>
        {task.dueDate && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        {task.estimatedMins && (
          <span className="text-xs text-muted-foreground ml-auto">{task.estimatedMins}m</span>
        )}
      </div>
      {/* Quick status move */}
      <div className="mt-2 flex gap-1">
        {TASK_COLUMNS.filter((c) => c.id !== task.status).map((col) => (
          <button key={col.id} onClick={() => onStatusChange(task.id, col.id)}
            className="text-xs text-muted-foreground hover:text-primary hover:underline">
            → {col.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient()
  const [addTaskCol, setAddTaskCol] = useState<string | null>(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', params.id],
    queryFn: () => api.get(`/tasks?projectId=${params.id}`).then((r) => r.data.data),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/tasks/projects').then((r) => r.data.data),
  })

  const project = (projects as any[]).find((p: any) => p.id === params.id)

  const createTask = useMutation({
    mutationFn: (d: any) => api.post('/tasks', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', params.id] }); setAddTaskCol(null); toast.success('Task created') },
    onError: () => toast.error('Failed to create task'),
  })

  const updateTask = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/tasks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', params.id] }),
  })

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', params.id] }); toast.success('Task deleted') },
  })

  const tasksByStatus: Record<string, any[]> = {}
  TASK_COLUMNS.forEach((c) => { tasksByStatus[c.id] = [] })
  ;(tasks as any[]).forEach((t: any) => {
    if (tasksByStatus[t.status]) tasksByStatus[t.status].push(t)
    else tasksByStatus['TODO'].push(t)
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projects" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project?.name ?? 'Project'}</h1>
          {project?.description && <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>}
        </div>
        <button onClick={() => setAddTaskCol('TODO')} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_COLUMNS.map((col) => {
          const colTasks = tasksByStatus[col.id] ?? []
          return (
            <div key={col.id} className="flex flex-col w-72 shrink-0">
              <div className={cn('rounded-t-lg border-t-4 px-3 py-2.5', col.color, col.bg)}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{colTasks.length}</span>
                    <button onClick={() => setAddTaskCol(col.id)}
                      className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className={cn('flex-1 rounded-b-lg border border-t-0 p-2 min-h-[400px] space-y-2', col.bg)}>
                {isLoading ? (
                  <div className="h-16 rounded-lg bg-muted animate-pulse" />
                ) : colTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task: any) => (
                    <TaskCard key={task.id} task={task}
                      onStatusChange={(id, status) => updateTask.mutate({ id, status })}
                      onDelete={(id) => deleteTask.mutate(id)} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {addTaskCol && (
        <AddTaskModal
          projectId={params.id}
          defaultStatus={addTaskCol}
          onClose={() => setAddTaskCol(null)}
          onCreate={(d) => createTask.mutate(d)}
        />
      )}
    </div>
  )
}
