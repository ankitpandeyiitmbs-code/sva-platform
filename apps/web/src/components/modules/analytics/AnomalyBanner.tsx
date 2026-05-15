'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AlertTriangle, TrendingDown, TrendingUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function AnomalyBanner() {
  const [dismissed, setDismissed] = useState<string[]>([])
  const { data } = useQuery({
    queryKey: ['analytics', 'anomalies'],
    queryFn: () => api.get('/analytics/anomalies').then((r) => r.data.data),
    refetchInterval: 5 * 60 * 1000,
  })

  const anomalies = (data ?? []).filter((a: any) => !dismissed.includes(a.metric + a.message))
  if (!anomalies.length) return null

  return (
    <div className="space-y-2">
      {anomalies.map((a: any) => {
        const key = a.metric + a.message
        return (
          <div key={key} className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3',
            a.severity === 'critical'
              ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
          )}>
            <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', a.severity === 'critical' ? 'text-red-600' : 'text-amber-600')} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', a.severity === 'critical' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300')}>
                {a.metric}
              </p>
              <p className={cn('text-xs mt-0.5', a.severity === 'critical' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
                {a.message}
              </p>
            </div>
            {a.change !== undefined && (
              <span className={cn('shrink-0 text-sm font-bold', a.change < 0 ? 'text-red-600' : 'text-amber-600')}>
                {a.change > 0 ? '+' : ''}{a.change.toFixed(1)}%
              </span>
            )}
            <button onClick={() => setDismissed([...dismissed, key])} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
