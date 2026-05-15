'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, CHANNEL_COLORS } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

export default function SharedDashboardPage({ params }: { params: { token: string } }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['shared', params.token],
    queryFn: () => api.get(`/analytics/shared/${params.token}`).then((r) => r.data.data),
  })

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>
  if (isError) return <div className="flex min-h-screen items-center justify-center"><div className="text-center"><h2 className="text-xl font-bold">Dashboard Not Found</h2><p className="text-muted-foreground mt-2">This link may have expired or been revoked.</p></div></div>

  const { dashboard, stats, series, byChannel } = data

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <h1 className="font-bold">{dashboard?.name ?? 'Dashboard'}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Read-only shared view</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            { label: 'Revenue (30d)', value: formatCurrency(stats?.revenue ?? 0) },
            { label: 'Gross Profit', value: formatCurrency(stats?.grossProfit ?? 0) },
            { label: 'Orders', value: (stats?.orders ?? 0).toLocaleString() },
            { label: 'Avg Order Value', value: formatCurrency(stats?.aov ?? 0) },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border p-5">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-xl border p-5">
            <h2 className="mb-4 text-sm font-semibold">Revenue (30 Days)</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142,72%,29%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(142,72%,29%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(142,72%,29%)" strokeWidth={2} fill="url(#sg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border p-5">
            <h2 className="mb-4 text-sm font-semibold">By Channel</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byChannel} cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="revenue" nameKey="channel">
                    {byChannel.map((entry: any, i: number) => <Cell key={i} fill={CHANNEL_COLORS[entry.channel] ?? `hsl(${i * 40},60%,50%)`} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Powered by SVA Platform · Data last updated {new Date().toLocaleString()}
        </p>
      </main>
    </div>
  )
}
