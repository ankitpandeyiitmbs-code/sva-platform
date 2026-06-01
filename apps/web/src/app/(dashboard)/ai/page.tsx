'use client'
import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Sparkles, Send, RefreshCw, Copy, CheckCheck, ChevronDown,
  TrendingUp, Package, Users, ShoppingCart, BarChart3,
  Lightbulb, Zap, X,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}

// ── Quick Prompts ──────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: TrendingUp,   label: 'Revenue summary',        text: 'Give me a full revenue summary: last 30 days vs prior period, broken down by channel.' },
  { icon: Package,      label: 'Inventory health',        text: 'What is our current inventory health? Any critical low-stock items I should reorder urgently?' },
  { icon: ShoppingCart, label: 'Top products',            text: 'Which are our top 10 best-selling products by revenue in the last 90 days?' },
  { icon: Users,        label: 'Customer insights',       text: 'What can you tell me about our customer base — total count, average LTV, and repeat purchase rate?' },
  { icon: BarChart3,    label: 'Channel performance',     text: 'Compare performance across all sales channels. Which is our strongest and which needs attention?' },
  { icon: Lightbulb,    label: 'Growth opportunities',    text: 'Based on our data, what are the top 3 growth opportunities I should focus on this month?' },
]

// ── Message Bubble ─────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  const copy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Convert markdown-like text to JSX
  function renderContent(text: string) {
    const lines = text.split('\n')
    const elements: JSX.Element[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="font-bold text-base mt-3 mb-1">{line.slice(4)}</h3>)
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="font-bold text-lg mt-3 mb-1">{line.slice(3)}</h2>)
      } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
        elements.push(<p key={i} className="font-semibold mt-2">{line.slice(2, -2)}</p>)
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        elements.push(
          <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
            {renderInline(line.slice(2))}
          </li>
        )
      } else if (/^\d+\./.test(line)) {
        elements.push(
          <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">
            {renderInline(line.replace(/^\d+\.\s*/, ''))}
          </li>
        )
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />)
      } else {
        elements.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>)
      }
      i++
    }
    return elements
  }

  function renderInline(text: string): React.ReactNode {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isUser && (
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      )}

      <div className={cn('max-w-[75%] space-y-1', isUser && 'items-end flex flex-col')}>
        <div className={cn(
          'rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary text-white rounded-tr-sm'
            : 'bg-muted rounded-tl-sm',
        )}>
          {msg.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-xs">Analyzing your business data…</span>
            </div>
          ) : isUser ? (
            <p className="text-sm leading-relaxed">{msg.content}</p>
          ) : (
            <div className="prose-sm text-foreground">{renderContent(msg.content)}</div>
          )}
        </div>

        {/* Actions */}
        {!isUser && !msg.isLoading && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
        {isUser && (
          <span className="text-xs text-muted-foreground px-1">
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm **SVA AI**, your business intelligence assistant.

I have real-time access to your orders, inventory, customers, and channel performance data. Ask me anything about your business — I'll give you data-driven answers and actionable recommendations.

Try one of the quick prompts below, or type your own question.`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const askMutation = useMutation({
    mutationFn: (payload: { question: string; history: any[] }) =>
      api.post('/ai/ask', payload).then(r => r.data.data),
  })

  const send = async (text?: string) => {
    const question = (text ?? input).trim()
    if (!question) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    }
    const loadingId = Date.now().toString() + '-ai'
    const loadingMsg: Message = {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')

    // Build history for multi-turn (exclude welcome message)
    const history = messages
      .filter(m => m.id !== 'welcome' && !m.isLoading)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const data = await askMutation.mutateAsync({ question, history })
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: data.answer, isLoading: false, timestamp: new Date() }
          : m
      ))
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: `Sorry, I ran into an error: ${err.response?.data?.message ?? err.message}. Please try again.`, isLoading: false }
          : m
      ))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearChat = () => {
    setMessages([{
      id: 'welcome-' + Date.now(),
      role: 'assistant',
      content: `Chat cleared. I'm ready for your next question! What would you like to know about your business?`,
      timestamp: new Date(),
    }])
  }

  const isThinking = messages.some(m => m.isLoading)

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-0 -m-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold">SVA AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by Claude · Real-time business data</p>
          </div>
        </div>
        <button onClick={clearChat} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {/* Quick prompts — show only when fresh */}
        {messages.length <= 1 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Quick Insights
            </p>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p.text}
                  onClick={() => send(p.text)}
                  disabled={isThinking}
                  className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3 text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-xs font-medium leading-tight">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-card px-6 py-4 shrink-0">
        <div className="relative flex items-end gap-2 rounded-xl border bg-background pr-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about revenue, inventory, customers, or anything else…"
            rows={1}
            disabled={isThinking}
            style={{ resize: 'none', maxHeight: '120px', overflowY: 'auto' }}
            className="flex-1 bg-transparent py-3 pl-4 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            onInput={e => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || isThinking}
            className={cn(
              'mb-2 flex h-8 w-8 items-center justify-center rounded-lg transition-all',
              input.trim() && !isThinking
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isThinking ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground text-center">
          Press Enter to send · Shift+Enter for new line · Responses based on your live business data
        </p>
      </div>
    </div>
  )
}
