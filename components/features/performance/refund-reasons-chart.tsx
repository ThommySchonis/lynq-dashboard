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
  const sorted = data ? [...data].sort((a, b) => b.percentage - a.percentage) : []
  const maxPct = sorted.length > 0 ? Math.max(...sorted.map((r) => r.percentage), 1) : 1

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card py-[22px] px-6">
      <h3 className="text-base font-semibold leading-[22px] text-foreground">Refund Reasons</h3>

      {isLoading ? (
        <div className="flex min-h-[180px] flex-col gap-3.5 pt-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-[4px]" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-sm font-medium leading-5 text-foreground-3">
          No data available
        </div>
      ) : (
        <div className="flex min-h-[180px] flex-col gap-3.5 pt-1">
          {sorted.map((row) => (
            <div key={row.reason} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium leading-5 text-foreground">{getReasonLabel(row.reason)}</span>
                <span className="text-sm font-semibold leading-5 text-foreground-3 tabular-nums">{row.percentage}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-[4px] bg-primary/15">
                <div
                  className="h-full rounded-[4px] bg-primary/55"
                  style={{ width: `${(row.percentage / maxPct) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
