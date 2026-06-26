'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { TicketVolumePoint } from '@/types/support-analytics'

// Ranges longer than this scroll horizontally with a fixed per-day width
// (same density as 7 days) instead of squeezing into the visible width.
const SCROLL_THRESHOLD = 10

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Rounds up to a "nice" axis max (multiple of 15 → ticks divide cleanly into integers). */
function niceAxisMax(value: number): number {
  return Math.max(Math.ceil(value / 15) * 15, 15)
}

// ── TicketVolumeChart ─────────────────────────────────────────────────────────

interface TicketVolumeChartProps {
  data: TicketVolumePoint[] | undefined
  isLoading: boolean
}

export function TicketVolumeChart({ data, isLoading }: TicketVolumeChartProps) {
  const maxValue = data && data.length > 0
    ? Math.max(...data.flatMap((d) => [d.opened_count, d.resolved_count]))
    : 0
  const axisMax = niceAxisMax(maxValue)
  // Top → bottom gridlines (4 lines, e.g. 75 / 50 / 25 / 0)
  const ticks = [3, 2, 1, 0].map((i) => Math.round((axisMax / 3) * i))
  const isScroll = !!data && data.length > SCROLL_THRESHOLD

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card py-[22px] px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold leading-[22px] text-foreground">Ticket Volume</h3>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-sm font-medium leading-5 text-foreground-3">Opened</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm font-medium leading-5 text-foreground-3">Resolved</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center">
      {isLoading ? (
        <div className="flex h-[140px] items-end gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${40 + i * 12}px` }} />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-[140px] items-center justify-center text-sm font-medium leading-5 text-foreground-3">
          No data available
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Y axis */}
          <div className="flex h-[140px] flex-col justify-between text-right text-xs leading-4 text-foreground-3 tabular-nums">
            {ticks.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>

          {/* Plot + date axis */}
          <div className={cn('min-w-0 flex-1', isScroll && 'overflow-x-auto')}>
            <div className={isScroll ? 'w-max' : ''}>
              <div className="relative h-[140px]">
                {/* Gridlines */}
                <div className="absolute inset-0 flex flex-col justify-between">
                  {ticks.map((_, i) => (
                    <div key={i} className="h-px w-full bg-border" />
                  ))}
                </div>
                {/* Bars */}
                <div className="relative flex h-full items-end">
                  {data.map((point) => (
                    <div
                      key={point.date}
                      className={cn('flex h-full items-end justify-center gap-1', isScroll ? 'w-[56px] shrink-0' : 'flex-1')}
                    >
                      <div
                        className="w-full max-w-[15px] rounded-t-[4px] bg-primary"
                        style={{ height: `${(point.opened_count / axisMax) * 100}%` }}
                        title={`Opened: ${point.opened_count}`}
                      />
                      <div
                        className="w-full max-w-[15px] rounded-t-[4px] bg-success"
                        style={{ height: `${(point.resolved_count / axisMax) * 100}%` }}
                        title={`Resolved: ${point.resolved_count}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Date labels */}
              <div className="mt-2 flex">
                {data.map((point) => (
                  <span
                    key={point.date}
                    className={cn('truncate text-center text-xs leading-4 text-foreground-3', isScroll ? 'w-[56px] shrink-0' : 'flex-1')}
                  >
                    {formatDate(point.date)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
