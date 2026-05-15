'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn, timeAgo } from '@/lib/utils'
import { ArrowLeft, Send, Lock, User, CheckCircle, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-gray-100 text-gray-600',
}

const CANNED_RESPONSES = [
  { label: 'Received', text: 'Thank you for reaching out. We have received your request and will get back to you within 24 hours.' },
  { label: 'Order lookup', text: 'I am looking up your order now. Could you please confirm the order number so I can assist you better?' },
  { label: 'Refund initiated', text: 'I have initiated the refund process for your order. Please allow 5-7 business days for the amount to reflect in your account.' },
  { label: 'Replacement shipped', text: 'A replacement has been shipped. You will receive a tracking number via email shortly.' },
  { label: 'Resolved', text: 'Your issue has been resolved. Please let us know if you need any further assistance. Thank you for your patience!' },
]

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [showCanned, setShowCanned] = useState(false)

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', params.id],
    queryFn: () => api.get(`/tickets/${params.id}`).then((r) => r.data.data),
  })

  const sendMessage = useMutation({
    mutationFn: (body: any) => api.post(`/tickets/${params.id}/messages`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', params.id] }); setReply(''); toast.success('Reply sent') },
    onError: () => toast.error('Failed to send reply'),
  })

  const updateTicket = useMutation({
    mutationFn: (data: any) => api.patch(`/tickets/${params.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', params.id] }); toast.success('Ticket updated') },
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading ticket...</div></div>
  if (!ticket) return <div className="text-center py-12">Ticket not found. <Link href="/support/tickets" className="text-primary">Back to tickets</Link></div>

  const customerName = ticket.customer
    ? [ticket.customer.firstName, ticket.customer.lastName].filter(Boolean).join(' ') || ticket.customer.email
    : 'Unknown'

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link href="/support/tickets" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="h-4 w-4" /> All Tickets
      </Link>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left: Ticket info */}
        <div className="space-y-4">
          <div className="rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
              <div className="flex items-center gap-1.5">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[ticket.priority])}>{ticket.priority}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[ticket.status])}>{ticket.status.replace('_', ' ')}</span>
              </div>
            </div>
            <h1 className="text-base font-bold">{ticket.subject}</h1>
            {ticket.description && <p className="text-sm text-muted-foreground mt-2">{ticket.description}</p>}

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Channel</span>
                <span className="font-medium">{ticket.channel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
              {ticket.firstResponseAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">First Response</span>
                  <span className="font-medium">{timeAgo(ticket.firstResponseAt)}</span>
                </div>
              )}
              {ticket.resolvedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Resolved</span>
                  <span className="font-medium">{new Date(ticket.resolvedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          {ticket.customer && (
            <div className="rounded-xl border p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Customer</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(ticket.customer.firstName?.[0] ?? ticket.customer.email?.[0] ?? '?').toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{customerName}</p>
                  <p className="text-xs text-muted-foreground">{ticket.customer.email}</p>
                </div>
              </div>
              <Link href={`/crm/contacts/${ticket.customerId}`} className="mt-3 block text-xs text-primary hover:underline">
                View CRM profile →
              </Link>
            </div>
          )}

          {/* Actions */}
          <div className="rounded-xl border p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Quick Actions</h3>
            {[
              { label: 'Mark In Progress', status: 'IN_PROGRESS', show: ticket.status === 'OPEN' },
              { label: 'Mark Resolved', status: 'RESOLVED', show: !['RESOLVED', 'CLOSED'].includes(ticket.status) },
              { label: 'Close Ticket', status: 'CLOSED', show: ticket.status === 'RESOLVED' },
              { label: 'Reopen', status: 'OPEN', show: ['RESOLVED', 'CLOSED'].includes(ticket.status) },
            ].filter((a) => a.show).map((a) => (
              <button key={a.status} onClick={() => updateTicket.mutate({ status: a.status })}
                className="w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
                <CheckCircle className="h-3.5 w-3.5" /> {a.label}
              </button>
            ))}
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <select value={ticket.priority}
                onChange={(e) => updateTicket.mutate({ priority: e.target.value })}
                className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary">
                {['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Conversation */}
        <div className="xl:col-span-2 flex flex-col rounded-xl border overflow-hidden" style={{ minHeight: '600px' }}>
          <div className="border-b px-4 py-3 bg-muted/20">
            <h2 className="text-sm font-semibold">Conversation</h2>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto divide-y max-h-[500px]">
            {/* Original description as first message */}
            {ticket.description && (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{customerName}</span>
                    <span className="text-xs text-muted-foreground">Customer</span>
                    <span className="text-xs text-muted-foreground ml-auto">{timeAgo(ticket.createdAt)}</span>
                  </div>
                  <p className="text-sm">{ticket.description}</p>
                </div>
              </div>
            )}

            {ticket.messages?.map((msg: any) => {
              const isAgent = msg.authorType === 'AGENT'
              return (
                <div key={msg.id} className={cn('flex items-start gap-3 px-4 py-3', msg.isInternal && 'bg-amber-50/50 dark:bg-amber-950/10')}>
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    isAgent ? 'bg-primary/10 text-primary' : 'bg-muted'
                  )}>
                    {isAgent ? (user?.email?.[0] ?? 'A').toUpperCase() : customerName[0]?.toUpperCase() ?? 'C'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{isAgent ? (user?.email ?? 'Agent') : customerName}</span>
                      <span className="text-xs text-muted-foreground">{isAgent ? 'Agent' : 'Customer'}</span>
                      {msg.isInternal && (
                        <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700">
                          <Lock className="h-2.5 w-2.5" /> Internal
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{timeAgo(msg.createdAt)}</span>
                    </div>
                    <p className="text-sm">{msg.body}</p>
                  </div>
                </div>
              )
            })}

            {ticket.messages?.length === 0 && !ticket.description && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No messages yet.</div>
            )}
          </div>

          {/* Reply box */}
          <div className="border-t p-4 bg-background">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setIsInternal(false)}
                className={cn('text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors',
                  !isInternal ? 'bg-primary text-white border-primary' : 'hover:bg-muted'
                )}>Reply to Customer</button>
              <button onClick={() => setIsInternal(true)}
                className={cn('flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors',
                  isInternal ? 'bg-amber-100 text-amber-700 border-amber-300' : 'hover:bg-muted'
                )}>
                <Lock className="h-3 w-3" /> Internal Note
              </button>
              <button onClick={() => setShowCanned(!showCanned)}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground">
                Canned responses
              </button>
            </div>

            {showCanned && (
              <div className="mb-2 rounded-lg border bg-background p-2 shadow-md">
                {CANNED_RESPONSES.map((r) => (
                  <button key={r.label} onClick={() => { setReply(r.text); setShowCanned(false) }}
                    className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground text-xs ml-2 truncate">{r.text.substring(0, 60)}...</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={isInternal ? 'Add an internal note...' : 'Write your reply...'}
                rows={3}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey && reply.trim()) sendMessage.mutate({ body: reply, isInternal }) }}
                className={cn('flex-1 rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary',
                  isInternal ? 'bg-amber-50 dark:bg-amber-950/10' : 'bg-background'
                )}
              />
              <button
                onClick={() => reply.trim() && sendMessage.mutate({ body: reply, isInternal })}
                disabled={!reply.trim() || sendMessage.isPending}
                className="flex items-center gap-1.5 self-end rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50 hover:bg-primary/90"
              >
                <Send className="h-3.5 w-3.5" /> {sendMessage.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Ctrl+Enter to send</p>
          </div>
        </div>
      </div>
    </div>
  )
}
