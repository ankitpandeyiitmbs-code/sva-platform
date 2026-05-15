'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'

export type Period = '7d' | '30d' | '90d' | '12m' | 'mtd' | 'ytd' | 'custom'

const OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: '12m', label: '12 months' },
  { value: 'ytd', label: 'Year to date' },
]

interface Props {
  value: Period
  onChange: (p: Period) => void
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      <CalendarDays className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
            value === o.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
