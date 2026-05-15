'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import { KpiCard } from '@/components/modules/analytics/KpiCard'
import { Mail, MousePointerClick, Send, Calendar } from 'lucide-react'
import Link from 'next/link'

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    SENDING: 'bg-amber-100 text-amber-700',
    SENT: 'bg-emerald-100 text-emerald-700',
    PAUSED: 'bg-orange-100 text-orange-700',
    FAILED: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  )
}

export default function MarketingPage() {
  const { data: analytics } = useQuery({
    queryKey: ['marketing', 'analytics'],
    queryFn: () => api.get('/marketing/analytics').then((r) => r.data.data),
  })

  const { data: recentCampaigns = [] } = useQuery({
    queryKey: ['marketing', 'campaigns', 'recent'],
    queryFn: () => api.get('/marketing/campaigns?limit=5').then((r) => r.data.data),
  })

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Campaigns Sent" value={analytics?.sentCampaigns ?? 0} format="number" icon={Send} iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-950/30" />
        <KpiCard label="Total Delivered" value={analytics?.totalDelivered ?? 0} format="number" icon={Mail} iconColor="text-emerald-600" iconBg="bg-emerald-50 dark:bg-emerald-950/30" />
        <KpiCard label="Open Rate" value={analytics?.openRate ?? 0} format="percent" icon={MousePointerClick} iconColor="text-violet-600" iconBg="bg-violet-50 dark:bg-violet-950/30" />
        <KpiCard label="Scheduled" value={analytics?.scheduledCampaigns ?? 0} format="number" icon={Calendar} iconColor="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-950/30" />
      </div>

      {/* Module Navigation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {[
          { href: '/marketing/campaigns', label: 'Campaigns', desc: 'Email & SMS campaigns', emoji: '📧' },
          { href: '/marketing/flows', label: 'Automation Flows', desc: 'Triggered sequences', emoji: '⚡' },
          { href: '/marketing/audience', label: 'Audiences', desc: 'Segments & lists', emoji: '🎯' },
          { href: '/crm/segments', label: 'Segments', desc: 'Dynamic customer groups', emoji: '👥' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border p-4 hover:border-primary hover:bg-muted/30 transition-all group"
          >
            <span className="text-2xl">{item.emoji}</span>
            <p className="mt-2 font-medium text-sm group-hover:text-primary transition-colors">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent campaigns */}
      <div className="rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Recent Campaigns</h2>
          <Link href="/marketing/campaigns" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {recentCampaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet. Create your first email campaign.</p>
        ) : (
          <div className="space-y-3">
            {recentCampaigns.map((c: any) => {
              const stats = c.stats as any
              return (
                <div key={c.id} className="flex items-center gap-4 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.type} · {c.subject ?? '—'}</p>
                  </div>
                  <StatusBadge status={c.status} />
                  <div className="text-right text-xs text-muted-foreground">
                    {stats?.sent ? `${formatNumber(stats.sent)} sent` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
