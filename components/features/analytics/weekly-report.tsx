'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { buildWeeklyReport, fmtEur } from '@/lib/analytics-constants'
import { CatBadge } from './action-board'
import type { Refund } from '@/types/analytics'

interface WeeklyReportProps {
  allRefunds: Refund[]
  loaded: boolean
}

export function WeeklyReport({ allRefunds, loaded }: WeeklyReportProps) {
  if (!loaded) {
    return (
      <div className="mb-6 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <Skeleton className="mb-1.5 h-[13px] w-[25%]" />
        <Skeleton className="mb-5 h-[10px] w-[18%]" />
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[100px] rounded-xl" />)}
        </div>
      </div>
    )
  }

  const weeks = buildWeeklyReport(allRefunds)

  return (
    <div className="mb-6 animate-fade-in rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
      <div className="mb-[18px]">
        <div className="mb-0.5 text-[13px] font-semibold text-[var(--text-1)]">Weekly Overview</div>
        <div className="text-[11px] text-[var(--text-3)]">Last 4 weeks (Sun&ndash;Sat) &middot; all refunds</div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {weeks.map((w, i) => (
          <div
            key={i}
            className={`rounded-[10px] p-4 ${
              w.isCurrentWeek
                ? 'border border-black/[0.09] bg-white shadow-sm'
                : 'border border-black/[0.05] bg-gray-50/80'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={`text-[10px] font-bold uppercase tracking-[.06em] ${w.isCurrentWeek ? 'text-gray-900' : 'text-gray-300'}`}>
                {w.label}
              </div>
              {w.isCurrentWeek && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            </div>
            <div className="mb-0.5 text-[28px] font-extrabold leading-none tracking-tighter tabular-nums text-gray-900">
              {w.refundCount}
            </div>
            <div className="mb-3 text-[11px] text-gray-400">
              refund{w.refundCount !== 1 ? 's' : ''}
            </div>
            {w.refundCount > 0 && (
              <>
                <div className="mb-2 text-xs font-bold tabular-nums text-red-500">{fmtEur(w.totalAmount)} lost</div>
                {w.topReason && <div className="mb-1"><CatBadge cat={w.topReason} small /></div>}
                {w.topProduct && (
                  <div className="mt-1 truncate text-[10px] text-gray-400" title={w.topProduct}>{w.topProduct}</div>
                )}
              </>
            )}
            {w.refundCount === 0 && (
              <div className="text-[11px] font-semibold text-emerald-500">All clear &#10003;</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
