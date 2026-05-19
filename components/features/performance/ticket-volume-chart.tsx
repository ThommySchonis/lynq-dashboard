'use client'

import { Skeleton } from '@/components/ui/skeleton'
import type { TicketVolumePoint } from '@/types/support-analytics'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── TicketVolumeChart ─────────────────────────────────────────────────────────

interface TicketVolumeChartProps {
  data: TicketVolumePoint[] | undefined
  isLoading: boolean
}

export function TicketVolumeChart({ data, isLoading }: TicketVolumeChartProps) {
  const maxValue = data
    ? Math.max(...data.flatMap(d => [d.opened_count, d.resolved_count]), 1)
    : 1

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Ticket Volume</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Opened</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Resolved</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-end gap-2 h-40">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <Skeleton className="w-full" style={{ height: `${40 + i * 12}px` }} />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-end gap-2 min-w-0" style={{ minHeight: '160px' }}>
            {data.map((point) => {
              const openedPct = (point.opened_count / maxValue) * 100
              const resolvedPct = (point.resolved_count / maxValue) * 100
              return (
                <div key={point.date} className="flex flex-1 flex-col items-center gap-1 min-w-0">
                  <div className="flex w-full items-end gap-0.5" style={{ height: '128px' }}>
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className="w-full rounded-t-sm bg-primary/80 transition-all duration-300"
                        style={{ height: `${openedPct}%` }}
                        title={`Opened: ${point.opened_count}`}
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className="w-full rounded-t-sm bg-success/80 transition-all duration-300"
                        style={{ height: `${resolvedPct}%` }}
                        title={`Resolved: ${point.resolved_count}`}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                    {formatDate(point.date)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
