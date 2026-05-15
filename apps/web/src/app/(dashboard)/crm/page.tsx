'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { KpiCard } from '@/components/modules/analytics/KpiCard'
import { Users, TrendingUp, DollarSign, Target } from 'lucide-react'
import Link from 'next/link'

export default function CRMPage() {
  const { data: customers } = useQuery({
    queryKey: ['customers', 'summary'],
    queryFn: () => api.get('/customers?limit=1').then((r) => r.data),
  })

  const { data: deals } = useQuery({
    queryKey: ['crm', 'forecast'],
    queryFn: () => api.get('/crm/forecast').then((r) => r.data.data),
  })

  const totalCustomers = customers?.total ?? 0

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Total Contacts" value={totalCustomers} format="number" icon={Users} iconColor="text-violet-600" iconBg="bg-violet-50 dark:bg-violet-950/30" />
        <KpiCard label="Open Pipeline" value={deals?.totalPipeline ?? 0} format="currency" icon={DollarSign} iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-950/30" />
        <KpiCard label="Weighted Forecast" value={deals?.weightedForecast ?? 0} format="currency" icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-50 dark:bg-emerald-950/30" />
        <KpiCard label="Open Deals" value={deals?.openDeals ?? 0} format="number" icon={Target} iconColor="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-950/30" />
      </div>

      {/* Module Navigation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { href: '/crm/contacts', label: 'Contacts', desc: 'All customers & leads', emoji: '👤' },
          { href: '/crm/pipeline', label: 'Pipeline', desc: 'Kanban deal stages', emoji: '📋' },
          { href: '/crm/forecast', label: 'Forecast', desc: 'Sales predictions', emoji: '📈' },
          { href: '/crm/segments', label: 'Segments', desc: 'Dynamic audience groups', emoji: '🎯' },
          { href: '/settings', label: 'Integrations', desc: 'Email & SMS setup', emoji: '🔗' },
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

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  )
}

function RecentActivity() {
  const { data: activities = [] } = useQuery({
    queryKey: ['crm', 'activities'],
    queryFn: () => api.get('/crm/activities?limit=10').then((r) => r.data.data),
  })

  const ACTIVITY_ICONS: Record<string, string> = {
    DEAL_CREATED: '💼', STAGE_CHANGED: '➡️', EMAIL_SENT: '📧', CALL_LOGGED: '📞',
    NOTE_ADDED: '📝', ORDER_PLACED: '🛒', DEFAULT: '📌',
  }

  return (
    <div className="rounded-xl border p-5">
      <h2 className="mb-4 text-sm font-semibold">Recent Activity</h2>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity. Start by adding contacts or creating deals.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((a: any) => (
            <div key={a.id} className="flex items-start gap-3 text-sm">
              <span className="text-base mt-0.5">{ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.DEFAULT}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{a.title}</p>
                {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
