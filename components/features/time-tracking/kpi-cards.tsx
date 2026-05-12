'use client'

import { Clock, Calendar, BarChart3, Users, Timer, Coffee } from 'lucide-react'
import type { ReactNode } from 'react'

function KpiIcon({ id, className }: { id: string; className?: string }) {
  const cls = className || 'h-3.5 w-3.5 text-foreground-4'
  if (id === 'active' || id === 'total' || id === 'week') return <Clock className={cls} />
  if (id === 'break') return <Coffee className={cls} />
  if (id === 'today') return <Calendar className={cls} />
  if (id === 'avg') return <BarChart3 className={cls} />
  if (id === 'team') return <Users className={cls} />
  return <Timer className={cls} />
}

interface KpiCardData {
  id: string
  label: string | null
  value: string
  sub: string
}

interface KpiCardsProps {
  cards: KpiCardData[]
  columns?: 3 | 4
}

export function KpiCards({ cards, columns = 3 }: KpiCardsProps) {
  const gridCls = columns === 4
    ? 'grid grid-cols-4 gap-3'
    : 'grid grid-cols-3 gap-3'

  return (
    <div className={`${gridCls} opacity-0 animate-fade-up delay-100`}>
      {cards.map(({ id, label, value, sub }) => (
        <div
          key={id}
          className="cursor-default overflow-hidden rounded-[10px] border border-black/7 bg-white p-4.5 transition-colors hover:border-black/12"
        >
          <div className="mb-3.5 flex items-start justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {label}
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-violet-500/8">
              <KpiIcon id={id} />
            </div>
          </div>
          <div className="mb-1 text-[22px] font-bold leading-tight tracking-tight text-foreground tabular-nums">
            {value}
          </div>
          <div className="text-xs text-gray-500">{sub}</div>
        </div>
      ))}
    </div>
  )
}

export { KpiIcon }
