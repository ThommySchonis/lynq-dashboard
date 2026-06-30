'use client'

import { Clock, Calendar, BarChart3, Users, Coffee, Hourglass, type LucideIcon } from 'lucide-react'

// Per-KPI icon + tinted icon-box, keyed by card id. Tints map to design
// tokens (success/warning/accent/info soft fills) per the Figma spec.
const KPI_META: Record<string, { Icon: LucideIcon; box: string; icon: string }> = {
  active: { Icon: Clock,     box: 'bg-success-soft', icon: 'text-success' },
  break:  { Icon: Coffee,    box: 'bg-warning-soft', icon: 'text-warning' },
  total:  { Icon: Hourglass, box: 'bg-accent-soft',  icon: 'text-primary' },
  team:   { Icon: Users,     box: 'bg-info-soft',    icon: 'text-info' },
  week:   { Icon: Clock,     box: 'bg-accent-soft',  icon: 'text-primary' },
  today:  { Icon: Calendar,  box: 'bg-info-soft',    icon: 'text-info' },
  avg:    { Icon: BarChart3, box: 'bg-success-soft', icon: 'text-success' },
}

const KPI_FALLBACK = { Icon: Clock, box: 'bg-accent-soft', icon: 'text-primary' }

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
  const gridCls = columns === 4 ? 'grid grid-cols-4 gap-4' : 'grid grid-cols-3 gap-4'

  return (
    <div className={`${gridCls} animate-fade-up`}>
      {cards.map(({ id, label, value, sub }) => {
        const { Icon, box, icon } = KPI_META[id] ?? KPI_FALLBACK
        return (
          <div
            key={id}
            className="flex cursor-default flex-col gap-2.5 rounded-2xl border border-border bg-card px-[22px] py-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-3">
                {label}
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${box}`}>
                <Icon className={`h-5 w-5 ${icon}`} strokeWidth={2} />
              </div>
            </div>
            <div className="text-[28px] font-bold leading-8 tracking-[-0.02em] text-foreground tabular-nums">
              {value}
            </div>
            <div className="text-sm text-foreground-3">{sub}</div>
          </div>
        )
      })}
    </div>
  )
}
