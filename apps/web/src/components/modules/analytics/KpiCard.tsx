'use client'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: number
  change?: number | null
  format?: 'currency' | 'number' | 'percent'
  sublabel?: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  isLoading?: boolean
}

export function KpiCard({ label, value, change, format = 'currency', sublabel, icon: Icon, iconColor, iconBg, isLoading }: KpiCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border p-5 space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  const formatted = format === 'currency' ? formatCurrency(value) : format === 'percent' ? `${value.toFixed(1)}%` : formatNumber(value)
  const isPositive = (change ?? 0) >= 0

  return (
    <div className="rounded-xl border p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{formatted}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      {change !== undefined && change !== null && (
        <div className={cn('flex items-center gap-1 text-xs font-medium', isPositive ? 'text-emerald-600' : 'text-red-500')}>
          {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {isPositive ? '+' : ''}{change.toFixed(1)}% vs prior period
        </div>
      )}
    </div>
  )
}
