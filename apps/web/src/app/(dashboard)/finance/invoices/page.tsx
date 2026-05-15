'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Trash2, CheckCircle, X, FileText } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

function CreateInvoiceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [form, setForm] = useState({
    type: 'INVOICE',
    customerName: '',
    customerEmail: '',
    currency: 'USD',
    dueDate: '',
    notes: '',
    taxRate: '0',
    discountAmount: '0',
  })
  const [lineItems, setLineItems] = useState([{ description: '', quantity: '1', unitPrice: '' }])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const updateLine = (i: number, k: string, v: string) =>
    setLineItems((lines) => lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)))
  const addLine = () => setLineItems((l) => [...l, { description: '', quantity: '1', unitPrice: '' }])
  const removeLine = (i: number) => setLineItems((l) => l.filter((_, idx) => idx !== i))

  const subtotal = lineItems.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0)
  const tax = subtotal * (Number(form.taxRate) / 100)
  const discount = Number(form.discountAmount) || 0
  const total = subtotal + tax - discount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">New {form.type === 'QUOTE' ? 'Quote' : 'Invoice'}</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <select value={form.type} onChange={(e) => set('type', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
              <option value="INVOICE">Invoice</option>
              <option value="QUOTE">Quote</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Currency</label>
            <select value={form.currency} onChange={(e) => set('currency', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
              {['USD', 'INR', 'AED', 'GBP', 'AUD'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Customer Name</label>
            <input value={form.customerName} onChange={(e) => set('customerName', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Customer Email</label>
            <input type="email" value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        {/* Line items */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground">Line Items</label>
            <button onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add line
            </button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Description', 'Qty', 'Unit Price', 'Total', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1.5">
                      <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary" />
                    </td>
                    <td className="px-2 py-1.5 w-16">
                      <input type="number" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} min="1"
                        className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary" />
                    </td>
                    <td className="px-2 py-1.5 w-24">
                      <input type="number" value={line.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} min="0" step="0.01"
                        className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary" />
                    </td>
                    <td className="px-2 py-1.5 w-20 tabular-nums text-xs">
                      {formatCurrency(Number(line.quantity || 0) * Number(line.unitPrice || 0), form.currency)}
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeLine(i)} disabled={lineItems.length === 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30">
                        <X className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="ml-auto w-64 space-y-1.5 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal, form.currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Tax (%)</span>
            <input type="number" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} min="0" max="100"
              className="w-16 rounded border bg-background px-2 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Discount</span>
            <input type="number" value={form.discountAmount} onChange={(e) => set('discountAmount', e.target.value)} min="0"
              className="w-20 rounded border bg-background px-2 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-between border-t pt-1.5 font-bold">
            <span>Total</span>
            <span>{formatCurrency(total, form.currency)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              if (lineItems.every((l) => !l.description.trim())) return toast.error('Add at least one line item')
              onCreate({
                type: form.type,
                currency: form.currency,
                dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
                notes: form.notes,
                subtotal,
                tax,
                discount,
                total,
                lineItems: lineItems.filter((l) => l.description.trim()),
                status: 'DRAFT',
              })
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
          >Create {form.type === 'QUOTE' ? 'Quote' : 'Invoice'}</button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function InvoicesPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', 'list', page, statusFilter],
    queryFn: () => api.get(`/invoices?page=${page}&limit=25${statusFilter ? `&status=${statusFilter}` : ''}`).then((r) => r.data),
  })

  const createInvoice = useMutation({
    mutationFn: (d: any) => api.post('/invoices', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowCreate(false); toast.success('Invoice created') },
  })

  const markPaid = useMutation({
    mutationFn: (id: string) => api.patch(`/invoices/${id}`, { status: 'PAID' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Marked as paid') },
  })

  const deleteInvoice = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice deleted') },
  })

  const invoices = data?.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Invoices & Quotes</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {['', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
            className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              statusFilter === s ? 'bg-primary text-white border-primary' : 'hover:bg-muted'
            )}>{s || 'All'}</button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground self-center">{data?.total ?? 0} invoices</span>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Number', 'Type', 'Status', 'Total', 'Due Date', 'Created', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-muted animate-pulse w-16" /></td>)}
                </tr>
              ))
            ) : invoices.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <span className="text-muted-foreground">No invoices yet.</span>
              </td></tr>
            ) : (
              invoices.map((inv: any) => (
                <tr key={inv.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary font-medium">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{inv.type}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[inv.status] ?? 'bg-muted')}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-bold tabular-nums">{formatCurrency(Number(inv.total), inv.currency)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      {inv.status !== 'PAID' && (
                        <button onClick={() => markPaid.mutate(inv.id)} title="Mark paid"
                          className="rounded p-1 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => { if (confirm('Delete invoice?')) deleteInvoice.mutate(inv.id) }}
                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreate={(d) => createInvoice.mutate(d)} />}
    </div>
  )
}
