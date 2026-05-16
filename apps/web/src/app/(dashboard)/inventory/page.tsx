'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Search, AlertTriangle, Package, Warehouse, TruckIcon, Plus, X, Loader2, Zap } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'

// ── Modal wrapper ─────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── Field helper ──────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"

export default function InventoryPage() {
  const [tab, setTab] = useState<'products' | 'lowstock' | 'po' | 'suppliers'>('products')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'product' | 'po' | 'supplier' | null>(null)
  const qc = useQueryClient()

  // ── Queries ───────────────────────────────────────
  const { data: products, isLoading } = useQuery({
    queryKey: ['inventory', 'products', search],
    queryFn: () => api.get(`/inventory/products${search ? `?search=${search}` : ''}`).then((r) => r.data.data),
    enabled: tab === 'products',
  })

  const { data: lowStock } = useQuery({
    queryKey: ['inventory', 'lowstock'],
    queryFn: () => api.get('/inventory/low-stock').then((r) => r.data.data),
    enabled: tab === 'lowstock',
  })

  const { data: pos } = useQuery({
    queryKey: ['inventory', 'po'],
    queryFn: () => api.get('/inventory/purchase-orders').then((r) => r.data.data),
    enabled: tab === 'po',
  })

  const { data: suppliers } = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: () => api.get('/inventory/suppliers').then((r) => r.data.data),
    enabled: tab === 'suppliers',
  })

  // ── Mutations ─────────────────────────────────────
  const { mutate: createProduct, isPending: creatingProduct } = useMutation({
    mutationFn: (data: any) => api.post('/inventory/products', data),
    onSuccess: () => { toast.success('Product created'); qc.invalidateQueries({ queryKey: ['inventory'] }); setModal(null) },
    onError: () => toast.error('Failed to create product'),
  })

  const { mutate: createPO, isPending: creatingPO } = useMutation({
    mutationFn: (data: any) => api.post('/inventory/purchase-orders', data),
    onSuccess: () => { toast.success('Purchase order created'); qc.invalidateQueries({ queryKey: ['inventory'] }); setModal(null) },
    onError: () => toast.error('Failed to create PO'),
  })

  const { mutate: createSupplier, isPending: creatingSupplier } = useMutation({
    mutationFn: (data: any) => api.post('/inventory/suppliers', data),
    onSuccess: () => { toast.success('Supplier added'); qc.invalidateQueries({ queryKey: ['inventory'] }); setModal(null) },
    onError: () => toast.error('Failed to add supplier'),
  })

  const tabs = [
    { key: 'products', label: 'Products', icon: Package },
    { key: 'lowstock', label: 'Low Stock', icon: AlertTriangle },
    { key: 'po', label: 'Purchase Orders', icon: TruckIcon },
    { key: 'suppliers', label: 'Suppliers', icon: Warehouse },
  ]

  return (
    <div className="space-y-5">
      {/* Tab Bar + Action Button */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>
        <Link href="/inventory/intelligence"
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400 transition-colors">
          <Zap className="h-4 w-4" /> Intelligence
        </Link>
        <div className="ml-auto">
          {tab === 'products' && (
            <button onClick={() => setModal('product')} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Product
            </button>
          )}
          {tab === 'po' && (
            <button onClick={() => setModal('po')} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
              <Plus className="h-4 w-4" /> New PO
            </button>
          )}
          {tab === 'suppliers' && (
            <button onClick={() => setModal('supplier')} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..."
              className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>{['SKU', 'Product', 'Category', 'Total Stock', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <tr key={i} className="border-t">{[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-20" /></td>)}</tr>)
                ) : (products ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-16 text-center">
                    <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No products yet.</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">Add products manually or sync from a connected channel.</p>
                  </td></tr>
                ) : (
                  (products ?? []).map((p: any) => {
                    const totalStock = p.inventoryItems?.reduce((sum: number, i: any) => sum + i.quantity, 0) ?? 0
                    return (
                      <tr key={p.id} className="border-t hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.name}</p>
                          {p.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</p>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.category ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('font-bold text-sm', totalStock === 0 ? 'text-red-600' : totalStock <= 10 ? 'text-amber-600' : 'text-emerald-600')}>{totalStock}</span>
                          {totalStock === 0 && <span className="ml-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 px-1.5 py-0.5 rounded-full">Out</span>}
                          {totalStock > 0 && totalStock <= 10 && <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 px-1.5 py-0.5 rounded-full">Low</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs', p.isActive ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400' : 'bg-gray-100 text-gray-600')}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Stock Tab */}
      {tab === 'lowstock' && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-amber-50 dark:bg-amber-950/30">
              <tr>{['Product', 'SKU', 'Channel', 'In Stock', 'Reorder Point', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(lowStock ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">✓ All stock levels are healthy.</td></tr>
              ) : (lowStock ?? []).map((item: any) => (
                <tr key={item.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{item.product?.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.product?.sku}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.channel ?? item.warehouse?.name ?? 'Default'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('font-bold', item.quantity === 0 ? 'text-red-600' : 'text-amber-600')}>{item.quantity}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.reorderPoint ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setModal('po')} className="rounded-lg bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90">Create PO</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Purchase Orders Tab */}
      {tab === 'po' && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>{['PO Number', 'Supplier', 'Status', 'Items', 'Total', 'Expected'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(pos ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No purchase orders yet. Create one to track incoming inventory.</td></tr>
              ) : (pos ?? []).map((po: any) => (
                <tr key={po.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{po.poNumber}</td>
                  <td className="px-4 py-3">{po.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium',
                      po.status === 'RECEIVED' ? 'bg-green-100 text-green-800' :
                      po.status === 'ORDERED' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-700'
                    )}>{po.status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{po.items?.length ?? 0} items</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(po.total ?? 0), po.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suppliers Tab */}
      {tab === 'suppliers' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(suppliers ?? []).length === 0 ? (
            <div className="col-span-3 py-12 text-center text-muted-foreground">No suppliers added yet. Add your first supplier.</div>
          ) : (suppliers ?? []).map((s: any) => (
            <div key={s.id} className="rounded-xl border p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{s.email ?? '—'}</p>
                </div>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{s.currency ?? 'USD'}</span>
              </div>
              {s.address && <p className="text-xs text-muted-foreground mt-2">{s.address}</p>}
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground border-t pt-3">
                <span>Lead time: <strong>{s.leadTimeDays ?? '—'}d</strong></span>
                {s.phone && <span>{s.phone}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────── */}
      {modal === 'product' && <AddProductModal onClose={() => setModal(null)} onCreate={createProduct} isPending={creatingProduct} />}
      {modal === 'po' && <AddPOModal onClose={() => setModal(null)} onCreate={createPO} isPending={creatingPO} suppliers={suppliers ?? []} />}
      {modal === 'supplier' && <AddSupplierModal onClose={() => setModal(null)} onCreate={createSupplier} isPending={creatingSupplier} />}
    </div>
  )
}

// ── Add Product Modal ─────────────────────────────────
function AddProductModal({ onClose, onCreate, isPending }: any) {
  const [form, setForm] = useState({ sku: '', name: '', category: '', description: '', isActive: true })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  return (
    <Modal title="Add Product" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU *"><input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="SVA-001" className={inputCls} /></Field>
          <Field label="Name *"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jojoba Oil 50ml" className={inputCls} /></Field>
          <Field label="Category"><input value={form.category} onChange={e => set('category', e.target.value)} placeholder="Carrier Oils" className={inputCls} /></Field>
          <Field label="Status">
            <select value={form.isActive ? 'true' : 'false'} onChange={e => set('isActive', e.target.value === 'true')} className={inputCls}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Brief product description..." className={inputCls} />
        </Field>
        <div className="flex gap-2 pt-2">
          <button onClick={() => onCreate(form)} disabled={isPending || !form.sku || !form.name}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Creating...' : 'Create Product'}
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add PO Modal ──────────────────────────────────────
function AddPOModal({ onClose, onCreate, isPending, suppliers }: any) {
  const [form, setForm] = useState({ supplierId: '', poNumber: `PO-${Date.now().toString().slice(-6)}`, expectedAt: '', currency: 'USD', notes: '' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  return (
    <Modal title="New Purchase Order" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="PO Number *"><input value={form.poNumber} onChange={e => set('poNumber', e.target.value)} className={inputCls} /></Field>
          <Field label="Supplier">
            <select value={form.supplierId} onChange={e => set('supplierId', e.target.value)} className={inputCls}>
              <option value="">Select supplier</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Expected Date"><input type="date" value={form.expectedAt} onChange={e => set('expectedAt', e.target.value)} className={inputCls} /></Field>
          <Field label="Currency">
            <select value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls}>
              {['USD', 'INR', 'GBP', 'AED', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inputCls} /></Field>
        <div className="flex gap-2 pt-2">
          <button onClick={() => onCreate({ ...form, supplierId: form.supplierId || undefined, expectedAt: form.expectedAt ? new Date(form.expectedAt) : undefined, items: [] })}
            disabled={isPending || !form.poNumber}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Creating...' : 'Create PO'}
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add Supplier Modal ────────────────────────────────
function AddSupplierModal({ onClose, onCreate, isPending }: any) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', leadTimeDays: 7, currency: 'USD' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  return (
    <Modal title="Add Supplier" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Supplier Name *"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="ABC Supplies Co." className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@supplier.com" className={inputCls} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" className={inputCls} /></Field>
          <Field label="Lead Time (days)"><input type="number" value={form.leadTimeDays} onChange={e => set('leadTimeDays', parseInt(e.target.value))} className={inputCls} /></Field>
          <Field label="Currency">
            <select value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls}>
              {['USD', 'INR', 'GBP', 'AED', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Address"><input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Supplier St, City" className={inputCls} /></Field>
        <div className="flex gap-2 pt-2">
          <button onClick={() => onCreate(form)} disabled={isPending || !form.name}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Adding...' : 'Add Supplier'}
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}
