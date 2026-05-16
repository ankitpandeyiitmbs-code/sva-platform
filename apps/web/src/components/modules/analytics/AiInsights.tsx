'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Sparkles, Send, Loader2 } from 'lucide-react'

export function AiInsights() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string[]>([])
  const [asked, setAsked] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () => api.post('/analytics/insights', {}).then((r) => r.data.data),
  })

  const { mutate: ask, isPending } = useMutation({
    mutationFn: (q: string) => api.post('/analytics/insights', { question: q }).then((r) => r.data.data),
    onSuccess: (d) => { setAnswer(d.insights); setAsked(true) },
  })

  const insights = asked ? answer : (data?.insights ?? [])

  return (
    <div className="rounded-xl border p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h2 className="text-sm font-semibold">AI Insights</h2>
        {data?.source === 'ai' && <span className="ml-auto text-xs text-muted-foreground rounded-full bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 text-violet-600 dark:text-violet-400">Powered by Claude</span>}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${70 + i * 10}%` }} />)}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {insights.map((insight: string, i: number) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50 text-[10px] font-bold text-violet-600 dark:text-violet-400">{i + 1}</span>
              <span className="text-muted-foreground leading-relaxed">{insight}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 mt-auto pt-2 border-t">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && question.trim() && (ask(question), setQuestion(''))}
          placeholder="Ask about your business..."
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={() => { if (question.trim()) { ask(question); setQuestion('') } }}
          disabled={isPending || !question.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
