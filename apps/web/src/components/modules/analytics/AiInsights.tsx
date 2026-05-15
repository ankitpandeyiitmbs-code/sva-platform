'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Sparkles, Send, Loader2, RefreshCw } from 'lucide-react'

export function AiInsights() {
  const [question, setQuestion] = useState('')
  const [insights, setInsights] = useState<string[]>([])
  const [source, setSource] = useState<'ai' | 'rule-based'>('rule-based')

  const { mutate: fetchInsights, isPending } = useMutation({
    mutationFn: (q?: string) => api.post('/analytics/insights', { question: q }).then((r) => r.data.data),
    onSuccess: (data) => {
      setInsights(data.insights)
      setSource(data.source)
    },
  })

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/0 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">AI-Powered Insights</h3>
        <span className="ml-auto rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {source === 'ai' ? 'Claude AI' : 'Rule-based'}
        </span>
        <button onClick={() => fetchInsights(undefined)} disabled={isPending} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {insights.length === 0 && !isPending && (
        <button
          onClick={() => fetchInsights(undefined)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate insights for this period
        </button>
      )}

      {isPending && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing your business data...
        </div>
      )}

      {insights.length > 0 && (
        <ul className="space-y-2.5">
          {insights.map((insight, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
              <p className="text-muted-foreground leading-relaxed">{insight}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Ask anything */}
      <div className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && question.trim()) { fetchInsights(question); setQuestion('') } }}
          placeholder="Ask anything: 'Why did revenue drop this week?'"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={() => { if (question.trim()) { fetchInsights(question); setQuestion('') } }}
          disabled={!question.trim() || isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
