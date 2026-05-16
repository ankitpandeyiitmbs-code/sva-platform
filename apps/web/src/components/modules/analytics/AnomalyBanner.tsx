'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function AnomalyBanner() {
  const [dismissed, setDismissed] = useState<string[]>([])
  const { data } = useQuery({
    queryKey: ['anomalies'],
    queryFn: () => api.get('/analytics/anomalies').then((r) => r.data.data),
    refetchInterval: 60000,
  })

  const anomalies = (data ?? []).filter((a: any) => !dismissed.includes(a.type))
  if (!anomalies.length) return null

  return (
    <div className="space-y-2">
      {anomalies.map((a: any) => (
        <div
          key={a.type}
          className={cn(
            'flex items-center gap-3 rounded-lg px-4 py-3 text-sm',
            a.severity === 'high' ? 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900' :
            a.severity === 'medium' ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900' :
            'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900'
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{a.message}</span>
          <button onClick={() => setDismissed((d) => [...d, a.type])} className="rounded p-0.5 hover:bg-black/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
