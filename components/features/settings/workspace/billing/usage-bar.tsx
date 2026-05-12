'use client'

import { cn } from '@/lib/utils'

interface UsageBarProps {
  used:    number
  limit:   number | null
  label?:  string
  unit?:   string
  // pct override — when caller already computed (e.g. from API)
  pct?:    number
  className?: string
}

/**
 * Compact progress bar with color thresholds:
 *   - < 80%  → muted gray
 *   - 80-99% → warning amber
 *   - >= 100% → destructive red
 *
 * When `limit` is null (custom plan / no enforcement), renders a flat
 * usage line with the count only — no bar, no percentage.
 */
export function UsageBar({ used, limit, label, unit, pct: pctOverride, className }: UsageBarProps) {
  const pct = pctOverride ?? (limit ? Math.min(100, Math.round((used / limit) * 100)) : 0)

  const barColor =
    pct >= 100 ? 'bg-destructive'
    : pct >= 80 ? 'bg-amber-500'
    : 'bg-foreground/40'

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium tabular-nums">
            {used.toLocaleString()}
            {limit !== null && (
              <span className="text-muted-foreground">
                {' / '}
                {limit.toLocaleString()}
              </span>
            )}
            {unit && <span className="ml-1 text-muted-foreground">{unit}</span>}
          </span>
        </div>
      )}
      {limit !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  )
}
