'use client'

import { Skeleton } from '@/components/ui/skeleton'
import type { RefundReasonRow } from '@/types/support-analytics'

// ── Reason label map ──────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  customer: 'Customer changed mind',
  fraud: 'Fraudulent order',
  duplicate: 'Duplicate order',
  damaged: 'Item arrived damaged',
  wrong_item: 'Wrong item shipped',
  not_received: 'Item not received',
  late_delivery: 'Late delivery',
  quality: 'Quality issue',
  other: 'Other',
}

function getReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason
}

// ── RefundReasonsChart ────────────────────────────────────────────────────────

interface RefundReasonsChartProps {
  data: RefundReasonRow[] | undefined
  isLoading: boolean
}

export function RefundReasonsChart({ data, isLoading }: RefundReasonsChartProps) {
  const maxCount = data ? Math.max(...data.map(r => r.count), 1) : 1
  const sorted = data ? [...data].sort((a, b) => b.count - a.count) : []

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Refund Reasons</h3>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {sorted.map((row) => (
            <div key={row.reason}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm text-foreground truncate">{getReasonLabel(row.reason)}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{row.count}</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums w-10 text-right">
                    {row.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(row.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
