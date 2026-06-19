'use client'

import type { LucideIcon } from 'lucide-react'
import { Clock, Hourglass, TrendingDown, Receipt } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useHelpdeskGlance } from '@/hooks/home'
import { formatDurationHours, formatEur, formatPercent } from '@/lib/home-utils'

interface GlanceCard {
  key: string
  icon: LucideIcon
  label: string
  value: string
  sub: string
  isLoading: boolean
}

function StatCard({ card }: { card: GlanceCard }) {
  const { icon: Icon, label, value, sub, isLoading } = card
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground-4">
          {label}
        </span>
        <div className="flex size-[30px] items-center justify-center rounded-[8px] bg-accent-soft text-primary">
          <Icon className="size-3.5" />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-2/3" />
      ) : (
        <span className="text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">
          {value}
        </span>
      )}
      <span className="text-[11px] text-foreground-4">{sub}</span>
    </div>
  )
}

export function HelpdeskGlance() {
  const { firstResponse, resolutionTime, refundRate, avgRefund } = useHelpdeskGlance()

  const cards: GlanceCard[] = [
    {
      key: 'first-response',
      icon: Clock,
      label: 'First response',
      value: formatDurationHours(firstResponse.seconds),
      sub: `Across ${firstResponse.conversations ?? 0} conversations`,
      isLoading: firstResponse.isLoading,
    },
    {
      key: 'resolution-time',
      icon: Hourglass,
      label: 'Resolution time',
      value: formatDurationHours(resolutionTime.seconds),
      sub: `Across ${resolutionTime.resolved ?? 0} conversations`,
      isLoading: resolutionTime.isLoading,
    },
    {
      key: 'refund-rate',
      icon: TrendingDown,
      label: 'Refund rate',
      value: formatPercent(refundRate.value),
      sub: 'Industry avg: 2–5%',
      isLoading: refundRate.isLoading,
    },
    {
      key: 'avg-refund',
      icon: Receipt,
      label: 'Avg refund',
      value: formatEur(avgRefund.value),
      sub: 'per refunded order',
      isLoading: avgRefund.isLoading,
    },
  ]

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Your helpdesk at a glance
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  )
}
