'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { KpiCard } from '@/components/modules/analytics/KpiCard'
import { DollarSign, TrendingDown, AlertCircle, Receipt } from 'lucide-react'
import Link from 'next/link'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const EXPENSE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16']

export default function FinancePage() {
  const { data: summary } = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => api.get('/invoices/summary').then((r) => r.data.data),
  })

  const { data: recentInvoices = [] } = useQuery({
    queryKey: ['invoices', 'recent'],
    queryFn: () => api.get('/invoices?limit=5').then((r) => r.data.data),
  })

  const expensesData = (summary?.expensesByCategory ?? []).map((e: any, i: number) => ({
    name: e.category,
    value: e.amount,
    color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
  }))

  const netProfit = (summary?.totalInvoiced ?? 0) - (summary?.totalExpenses ?? 0)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Total Invoiced" value={summary?.totalInvoiced ?? 0} format="currency" icon={DollarSign} iconColor="text-emerald-600" iconBg="bg-emerald-50 dark:bg-emerald-950/30" />
        <KpiCard label="Total Expenses" value={summary?.totalExpenses ?? 0} format="currency" icon={TrendingDown} iconColor="text-red-500" iconBg="bg-red-50 dark:bg-red-950/30" />
        <KpiCard label="Overdue" value={summary?.overdueCount ?? 0} format="number" icon={AlertCircle} iconColor="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-950/30" />
        <KpiCard label="Paid This Month" value={summary?.paidMtd ?? 0} format="currency" icon={Receipt} iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-950/30" />
      </div>

      {/* Net P&L */}
      <div className={`rounded-xl border p-5 ${netProfit >= 0 ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10' : 'border-red-200 bg-red-50/50 dark:bg-red-950/10'}`}>
        <p className="text-sm font-medium text-muted-foreground">Net Profit (All Time)</p>
        <p className={`text-3xl font-bold mt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatCurrency(summary?.totalInvoiced ?? 0)} revenue − {formatCurrency(summary?.totalExpenses ?? 0)} expenses
        </p>
      </div>

      {/* Module Navigation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {[
          { href: '/finance/invoices', label: 'Invoices', desc: 'Manage invoices & quotes', emoji: '📄' },
          { href: '/finance/expenses', label: 'Expenses', desc: 'Track business expenses', emoji: '💸' },
          { href: '/analytics', label: 'P&L Report', desc: 'Full profit & loss', emoji: '📊' },
          { href: '/analytics', label: 'Analytics', desc: 'Revenue & channel analytics', emoji: '📈' },
        ].map((item) => (
          <Link key={item.href + item.label} href={item.href}
            className="rounded-xl border p-4 hover:border-primary hover:bg-muted/30 transition-all group">
            <span className="text-2xl">{item.emoji}</span>
            <p className="mt-2 font-medium text-sm group-hover:text-primary">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Expenses by category */}
        {expensesData.length > 0 && (
          <div className="rounded-xl border p-5">
            <h2 className="text-sm font-semibold mb-4">Expenses by Category</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expensesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {expensesData.map((e: any) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent invoices */}
        <div className="rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Recent Invoices</h2>
            <Link href="/finance/invoices" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(Number(inv.total), inv.currency)}</p>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SENT: 'bg-blue-100 text-blue-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    OVERDUE: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? 'bg-muted'}`}>{status}</span>
}
