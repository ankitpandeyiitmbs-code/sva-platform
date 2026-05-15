'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { KpiCard } from '@/components/modules/analytics/KpiCard'
import { Headphones, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-gray-100 text-gray-600',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

export default function SupportPage() {
  const { data: analytics } = useQuery({
    queryKey: ['tickets', 'analytics'],
    queryFn: () => api.get('/tickets/analytics/summary').then((r) => r.data.data),
  })

  const { data: recentTickets = [] } = useQuery({
    queryKey: ['tickets', 'recent'],
    queryFn: () => api.get('/tickets?limit=5&status=OPEN').then((r) => r.data.data),
  })

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Open Tickets" value={analytics?.open ?? 0} format="number" icon={Headphones} iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-950/30" />
        <KpiCard label="In Progress" value={analytics?.inProgress ?? 0} format="number" icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-950/30" />
        <KpiCard label="Resolved" value={analytics?.resolved ?? 0} format="number" icon={CheckCircle} iconColor="text-emerald-600" iconBg="bg-emerald-50 dark:bg-emerald-950/30" />
        <KpiCard label="Resolution Rate" value={analytics?.resolutionRate ?? 0} format="percent" icon={AlertCircle} iconColor="text-violet-600" iconBg="bg-violet-50 dark:bg-violet-950/30" />
      </div>

      {/* Module Nav */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { href: '/support/tickets', label: 'All Tickets', desc: 'View and manage tickets', emoji: '🎫' },
          { href: '/support/tickets?status=OPEN', label: 'Open Inbox', desc: 'New & unassigned tickets', emoji: '📬' },
          { href: '/support/tickets?priority=CRITICAL', label: 'Critical', desc: 'High priority issues', emoji: '🚨' },
        ].map((item) => (
          <Link key={item.href} href={item.href}
            className="rounded-xl border p-4 hover:border-primary hover:bg-muted/30 transition-all group">
            <span className="text-2xl">{item.emoji}</span>
            <p className="mt-2 font-medium text-sm group-hover:text-primary">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Priority breakdown */}
      {analytics?.byPriority && (
        <div className="rounded-xl border p-5">
          <h2 className="text-sm font-semibold mb-4">By Priority</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(analytics.byPriority).map(([priority, count]) => (
              <div key={priority} className={cn('rounded-lg px-3 py-2 text-sm font-medium', PRIORITY_COLORS[priority] ?? 'bg-muted')}>
                {priority}: <span className="font-bold">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent open tickets */}
      <div className="rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Recent Open Tickets</h2>
          <Link href="/support/tickets" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {recentTickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tickets. Great job!</p>
        ) : (
          <div className="space-y-2">
            {recentTickets.map((t: any) => (
              <Link key={t.id} href={`/support/tickets/${t.id}`} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{t.ticketNumber}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[t.priority] ?? 'bg-muted')}>{t.priority}</span>
                  </div>
                  <p className="text-sm font-medium truncate mt-0.5">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.customer ? [t.customer.firstName, t.customer.lastName].filter(Boolean).join(' ') || t.customer.email : 'Unknown'}
                  </p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium shrink-0', STATUS_COLORS[t.status] ?? 'bg-muted')}>{t.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
