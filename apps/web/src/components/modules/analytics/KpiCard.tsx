import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  change?: number
  format?: 'currency' | 'number' | 'percent' | 'raw'
  currency?: string
  icon?: LucideIcon
  iconColor?: string
  iconBg?: string
  sublabel?: string
  alert?: boolean
}

export function KpiCard({ label, value, change, format = 'raw', currency = 'USD', icon: Icon, iconColor, iconBg, sublabel, alert }: Props) {
  const formatted =
    format === 'currency' ? formatCurrency(Number(value), currency as any)
    : format === 'number' ? formatNumber(Number(value))
    : format === 'percent' ? `${Number(value).toFixed(1)}%`
    : String(value)

  return (
    <div className={cn('rounded-xl border bg-card p-5 transition-shadow hover:shadow-md', alert && 'border-amber-300 dark:border-amber-700')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{formatted}</p>
          {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
          {change !== undefined && (
            <div className={cn('mt-1.5 flex items-center gap-1 text-xs font-medium',
              change > 0 ? 'text-emerald-600 dark:text-emerald-400'
              : change < 0 ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground'
            )}>
              {change > 0 ? <TrendingUp className="h-3 w-3" /> : change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {formatPercent(change)} vs prev period
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('shrink-0 rounded-xl p-2.5', iconBg ?? 'bg-muted')}>
            <Icon className={cn('h-5 w-5', iconColor ?? 'text-muted-foreground')} />
          </div>
        )}
      </div>
    </div>
  )
}
