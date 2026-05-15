'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, FolderKanban, CheckSquare, Clock, X, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const PROJECT_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PLANNING: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
}

function CreateProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [form, setForm] = useState({ name: '', description: '', status: 'ACTIVE', color: '#6366f1', startDate: '', endDate: '' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">New Project</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Project Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Q3 Product Launch"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border cursor-pointer" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              if (!form.name.trim()) return toast.error('Project name required')
              onCreate({
                name: form.name,
                description: form.description,
                status: form.status,
                color: form.color,
                startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
                endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
              })
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >Create Project</button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/tasks/projects').then((r) => r.data.data),
  })

  const { data: myTasks = [] } = useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn: () => api.get('/tasks?limit=10').then((r) => r.data.data),
  })

  const createProject = useMutation({
    mutationFn: (d: any) => api.post('/tasks/projects', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowCreate(false); toast.success('Project created') },
    onError: () => toast.error('Failed to create project'),
  })

  const tasksByStatus = {
    TODO: (myTasks as any[]).filter((t: any) => t.status === 'TODO').length,
    IN_PROGRESS: (myTasks as any[]).filter((t: any) => t.status === 'IN_PROGRESS').length,
    DONE: (myTasks as any[]).filter((t: any) => t.status === 'DONE').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{(projects as any[]).length} projects</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Task summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'To Do', count: tasksByStatus.TODO, color: 'text-gray-600 bg-gray-50', dot: 'bg-gray-400' },
          { label: 'In Progress', count: tasksByStatus.IN_PROGRESS, color: 'text-amber-700 bg-amber-50', dot: 'bg-amber-400' },
          { label: 'Done', count: tasksByStatus.DONE, color: 'text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl border p-4', s.color)}>
            <div className="flex items-center gap-2 mb-1">
              <div className={cn('h-2 w-2 rounded-full', s.dot)} />
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <p className="text-2xl font-bold">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Projects grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-xl border bg-muted animate-pulse" />)}
        </div>
      ) : (projects as any[]).length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <FolderKanban className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first project to start managing tasks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(projects as any[]).map((project: any, i: number) => {
            const done = 0
            const total = project._count?.tasks ?? 0
            const progress = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Link key={project.id} href={`/projects/${project.id}`}
                className="rounded-xl border p-5 hover:border-primary hover:shadow-sm transition-all group block">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: project.color ? `${project.color}20` : undefined }}>
                    <FolderKanban className="h-5 w-5" style={{ color: project.color ?? '#6366f1' }} />
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[project.status] ?? 'bg-muted')}>
                    {project.status}
                  </span>
                </div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">{project.name}</h3>
                {project.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> {total} tasks</span>
                    {project.endDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(project.endDate).toLocaleDateString()}</span>}
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreate={(d) => createProject.mutate(d)} />}
    </div>
  )
}
