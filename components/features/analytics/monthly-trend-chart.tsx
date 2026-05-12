'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { buildMonthlyTrend, fmtEur } from '@/lib/analytics-constants'
import type { Refund } from '@/types/analytics'

interface MonthlyTrendChartProps {
  allRefunds: Refund[]
  loaded: boolean
}

export function MonthlyTrendChart({ allRefunds, loaded }: MonthlyTrendChartProps) {
  if (!loaded) {
    return (
      <div className="flex-1 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <Skeleton className="mb-1.5 h-[13px] w-[50%]" />
        <Skeleton className="mb-5 h-[10px] w-[30%]" />
        <div className="flex h-[120px] items-end gap-2">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${30 + i * 10}%` }} />
          ))}
        </div>
      </div>
    )
  }

  const months = buildMonthlyTrend(allRefunds)
  const maxCount = Math.max(...months.map(m => m.count), 1)
  const maxAmt = Math.max(...months.map(m => m.amount), 1)
  const totalLost = months.reduce((s, m) => s + m.amount, 0)

  return (
    <div className="flex-1 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
      <div className="mb-[18px] flex items-center justify-between">
        <div>
          <div className="mb-0.5 text-[13px] font-semibold text-foreground">Monthly Refunds</div>
          <div className="text-[11px] text-muted-foreground">Last 6 months — count + amount</div>
        </div>
        <div className="text-[13px] font-bold text-red-600">{fmtEur(totalLost)}</div>
      </div>
      <div className="flex h-[110px] items-end gap-2.5">
        {months.map((m, i) => {
          const barH = maxCount > 0 ? Math.max((m.count / maxCount) * 100, m.count > 0 ? 8 : 0) : 0
          return (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-[5px]">
              <div className={`text-[10px] font-bold tabular-nums ${m.count > 0 ? 'text-gray-600' : 'text-gray-300'}`}>
                {m.count > 0 ? m.count : ''}
              </div>
              <div
                className="relative w-full overflow-hidden rounded-t"
                style={{
                  background: m.isCurrentMonth ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)',
                  height: `${Math.max(barH, 4)}%`,
                  minHeight: 4,
                  transition: 'height .3s ease',
                }}
              >
                {m.count > 0 && (
                  <div
                    className="absolute inset-0 origin-bottom animate-bar-grow"
                    style={{
                      background: m.isCurrentMonth ? '#111111' : '#E0E0E0',
                      animationDelay: `${i * 0.06}s`,
                    }}
                  />
                )}
              </div>
              <div className={`text-[10px] ${m.isCurrentMonth ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                {m.label}
              </div>
            </div>
          )
        })}
      </div>
      {/* Amount sparkline */}
      <svg viewBox="0 0 300 28" className="mt-3 w-full" aria-hidden>
        {months.map((m, i) => {
          const x = (i / (months.length - 1)) * 280 + 10
          const y = 28 - (m.amount / maxAmt) * 22 - 3
          return <circle key={i} cx={x} cy={y} r="2.5" fill="#DC2626" />
        })}
        <polyline
          points={months.map((m, i) => {
            const x = (i / (months.length - 1)) * 280 + 10
            const y = 28 - (m.amount / maxAmt) * 22 - 3
            return `${x},${y}`
          }).join(' ')}
          fill="none"
          stroke="#DC2626"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
