'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const SEGMENT_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
]

export default function AudiencePage() {
  const { data: segments = [], isLoading } = useQuery({
    queryKey: ['crm', 'segments'],
    queryFn: () => api.get('/crm/segments').then((r) => r.data.data),
  })

  const { data: customers } = useQuery({
    queryKey: ['customers', 'summary'],
    queryFn: () => api.get('/customers?limit=1').then((r) => r.data),
  })

  const totalCustomers = customers?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Audiences</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Customer segments available for targeting campaigns</p>
        </div>
        <Link href="/crm/segments" className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          Manage Segments
        </Link>
      </div>

      {/* All customers card */}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">All Customers</p>
              <p className="text-sm text-muted-foreground">Your entire customer base</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{totalCustomers.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">contacts</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Link href="/marketing/campaigns" className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90">
            Send Campaign <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Segments */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Saved Segments</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl border bg-muted animate-pulse" />)}
          </div>
        ) : segments.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No segments yet.{' '}
            <Link href="/crm/segments" className="text-primary hover:underline">Create a segment</Link>
            {' '}to target specific customer groups.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {segments.map((seg: any, i: number) => (
              <div key={seg.id} className={cn('rounded-xl border p-4', SEGMENT_COLORS[i % SEGMENT_COLORS.length])}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{seg.name}</p>
                    {seg.description && <p className="text-xs opacity-75 mt-0.5 truncate">{seg.description}</p>}
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 text-sm font-bold ml-2 shrink-0">
                    {seg._count?.members ?? 0}
                  </div>
                </div>
                <p className="text-xs opacity-60 mt-2">
                  {((seg.rules as any[]) ?? []).length} condition{((seg.rules as any[]) ?? []).length !== 1 ? 's' : ''}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/marketing/campaigns?segmentId=${seg.id}`}
                    className="flex items-center gap-1.5 rounded-lg bg-white/60 px-2.5 py-1 text-xs font-medium hover:bg-white/80 transition-colors"
                  >
                    Send Campaign <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Total Segments', value: segments.length },
          { label: 'Total Audience', value: totalCustomers },
          { label: 'Largest Segment', value: segments.length > 0 ? Math.max(...segments.map((s: any) => s._count?.members ?? 0)) : 0 },
          { label: 'Avg Segment Size', value: segments.length > 0 ? Math.round(segments.reduce((s: number, seg: any) => s + (seg._count?.members ?? 0), 0) / segments.length) : 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
