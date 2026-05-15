'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

const EXPENSE_CATEGORIES = [
  'Advertising', 'Shipping', 'Software', 'Office Supplies', 'Travel',
  'Salaries', 'Marketplace Fees', 'Inventory', 'Utilities', 'Other',
]

const CATEGORY_COLORS: Record<string, string> = {
  Advertising: 'bg-blue-100 text-blue-700',
  Shipping: 'bg-amber-100 text-amber-700',
  Software: 'bg-violet-100 text-violet-700',
  'Office Supplies': 'bg-gray-100 text-gray-700',
  Travel: 'bg-cyan-100 text-cyan-700',
  Salaries: 'bg-emerald-100 text-emerald-700',
  'Marketplace Fees': 'bg-orange-100 text-orange-700',
  Inventory: 'bg-rose-100 text-rose-700',
  Utilities: 'bg-teal-100 text-teal-700',
  Other: 'bg-muted text-muted-foreground',
}

function AddExpenseModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [form, setForm] = useState({
    description: '',
    category: 'Other',
    amount: '',
    currency: 'USD',
    date: new Date().toISOString().slice(0, 10),
    vendor: '',
    notes: '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">Add Expense</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description *</label>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Facebook Ads - March"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount *</label>
              <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} min="0" step="0.01"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <select value={form.currency} onChange={(e) => set('currency', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {['USD', 'INR', 'AED', 'GBP', 'AUD'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Vendor</label>
            <input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="Vendor name"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              if (!form.description.trim()) return toast.error('Description required')
              if (!form.amount || Number(form.amount) <= 0) return toast.error('Valid amount required')
              onCreate({ ...form, amount: Number(form.amount), date: new Date(form.date).toISOString() })
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >Add Expense</button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function ExpensesPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, categoryFilter],
    queryFn: () => api.get(`/invoices/expenses?page=${page}&limit=25${categoryFilter ? `&category=${categoryFilter}` : ''}`).then((r) => r.data),
  })

  const createExpense = useMutation({
    mutationFn: (d: any) => api.post('/invoices/expenses', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowAdd(false); toast.success('Expense added') },
  })

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense deleted') },
  })

  const expenses = data?.data ?? []
  const totalShown = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Expenses</h1>
          {expenses.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {expenses.length} expenses · {formatCurrency(totalShown)} shown
            </p>
          )}
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => { setCategoryFilter(''); setPage(1) }}
          className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            !categoryFilter ? 'bg-primary text-white border-primary' : 'hover:bg-muted'
          )}>All</button>
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c} onClick={() => { setCategoryFilter(c); setPage(1) }}
            className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              categoryFilter === c ? 'bg-primary text-white border-primary' : 'hover:bg-muted'
            )}>{c}</button>
        ))}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Date', 'Description', 'Category', 'Vendor', 'Amount', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-muted animate-pulse w-16" /></td>)}
                </tr>
              ))
            ) : expenses.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No expenses yet.</td></tr>
            ) : (
              expenses.map((e: any) => (
                <tr key={e.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 font-medium">{e.description}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', CATEGORY_COLORS[e.category] ?? 'bg-muted')}>{e.category}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.vendor ?? '—'}</td>
                  <td className="px-4 py-2.5 font-bold tabular-nums">{formatCurrency(Number(e.amount), e.currency)}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => { if (confirm('Delete expense?')) deleteExpense.mutate(e.id) }}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Prev</button>
          <span className="text-sm text-muted-foreground">Page {page} of {data?.totalPages}</span>
          <button disabled={page === data?.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">Next</button>
        </div>
      )}

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onCreate={(d) => createExpense.mutate(d)} />}
    </div>
  )
}
