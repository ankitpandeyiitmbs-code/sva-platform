'use client'
import { cn } from '@/lib/utils'

export type Period = '7d' | '30d' | '90d' | '12m' | 'ytd'

const OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '12m', label: '12M' },
  { value: 'ytd', label: 'YTD' },
]

export function PeriodSelector({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  return (
    <div className="flex gap-0.5 rounded-lg border bg-muted/40 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
