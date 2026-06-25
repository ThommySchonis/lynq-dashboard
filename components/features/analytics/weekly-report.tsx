'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { buildWeeklyReport, fmtEur } from '@/lib/analytics-constants'
import type { Refund } from '@/types/analytics'

interface WeeklyReportProps {
  allRefunds: Refund[]
  loaded: boolean
}

// Card chrome (Figma 916-26419): white, 1px border, radius 16, soft elevation.
const CARD = 'mb-6 flex flex-col gap-[18px] rounded-[16px] border border-border bg-card p-[22px_24px_24px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04),0px_1px_2px_0px_rgba(0,0,0,0.02)]'

export function WeeklyReport({ allRefunds, loaded }: WeeklyReportProps) {
  if (!loaded) {
    return (
      <div className={CARD}>
        <div className="flex flex-col gap-[3px]">
          <Skeleton className="h-[16px] w-[25%]" />
          <Skeleton className="h-[14px] w-[40%]" />
        </div>
        <div className="grid grid-cols-4 gap-[14px]">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[120px] rounded-[12px]" />)}
        </div>
      </div>
    )
  }

  const weeks = buildWeeklyReport(allRefunds)

  return (
    <div className={`${CARD} animate-fade-up`}>
      <div className="flex flex-col gap-[3px]">
        <div className="text-[16px] font-semibold leading-[22px] text-foreground">Weekly Overview</div>
        <div className="text-[14px] font-medium leading-5 text-muted-foreground">Last 4 weeks (Sun&ndash;Sat) &middot; all refunds</div>
      </div>
      <div className="grid grid-cols-4 gap-[14px]">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-[12px] border border-border bg-card p-[16px_18px]">
            <div className="flex items-center justify-between">
              <div className={`text-[12px] font-semibold uppercase leading-[14px] tracking-[0.08em] ${w.isCurrentWeek ? 'text-foreground' : 'text-muted-foreground'}`}>
                {w.label}
              </div>
              {w.isCurrentWeek && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
            </div>
            <div className="text-[28px] font-bold leading-[32px] tracking-[-0.02em] tabular-nums text-foreground">
              {w.refundCount}
            </div>
            <div className="text-[14px] font-medium text-muted-foreground">refunds</div>
            {w.refundCount > 0 ? (
              <div className="text-[16px] font-bold tracking-[-0.01em] tabular-nums text-red-500">{fmtEur(w.totalAmount)}</div>
            ) : (
              <div className="text-[14px] font-semibold text-emerald-500">All clear &#10003;</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
