'use client'

import { useMemo } from 'react'
import { Truck, Clock, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react'
import { useCountUp } from '@/hooks/use-count-up'
import { daysDiff } from '@/lib/supply-chain-constants'
import type { Order } from '@/types/supply-chain'

interface KpiCardProps {
  label: string
  value: string | number
  numericValue: number
  accentColor?: string
  sub?: string | null
  icon: React.ReactNode
  animIndex: number
}

function KpiCard({ label, value, numericValue, accentColor, sub, icon, animIndex }: KpiCardProps) {
  const animated = useCountUp(typeof numericValue === 'number' ? numericValue : 0)
  const displayValue = typeof numericValue === 'number'
    ? (label === 'Avg Delivery' && numericValue ? `${animated}d` : animated)
    : value

  return (
    <div
      className="bg-card border border-border rounded-2xl p-5 px-[22px] shadow-[var(--shadow-card)] transition-all duration-200 hover:border-(--border-hover) hover:shadow-[var(--shadow-card-hover)] relative overflow-hidden animate-[fadeUp_0.4s_ease_both]"
      style={{ animationDelay: `${animIndex * 50 + 50}ms` }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-semibold text-[#BDBDBD] tracking-[.06em] uppercase">
          {label}
        </span>
        <div className="w-7 h-7 rounded-[7px] bg-primary/8 flex items-center justify-center text-foreground-4">
          {icon}
        </div>
      </div>
      <div
        className="text-[26px] font-bold tracking-[-0.04em] leading-none"
        style={{ color: accentColor || 'var(--foreground)' }}
      >
        {displayValue}
      </div>
      {sub && (
        <p
          className="text-[10.5px] mt-[5px]"
          style={{ color: accentColor || 'var(--foreground-3)' }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 px-[22px] shadow-[var(--shadow-card)] h-[84px]">
      <div className="h-[11px] w-[55%] mb-2.5 rounded-md bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:200%_100%] animate-[skWave_1.5s_ease-in-out_infinite]" />
      <div className="h-[26px] w-[40%] rounded-md bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:200%_100%] animate-[skWave_1.5s_ease-in-out_infinite]" />
    </div>
  )
}

interface ShipmentKpiCardsProps {
  orders: Order[]
  isPending: boolean
  attentionCount: number
}

export function ShipmentKpiCards({ orders, isPending, attentionCount }: ShipmentKpiCardsProps) {
  const counts = useMemo(() => {
    const allShipments = orders.flatMap(o => o.shipments || [])
    const delivered = allShipments.filter(s => s.status === 'DELIVERED')
    const withTransit = delivered.filter(s => s.delivery_date && s.fulfillment_date)
    const withEst = delivered.filter(s => s.estimated_delivery_date && s.delivery_date)

    return {
      inTransit: allShipments.filter(s => s.status === 'IN_TRANSIT').length,
      outForDel: allShipments.filter(s => s.status === 'OUT_FOR_DELIVERY').length,
      delivered: delivered.length,
      avgDays: withTransit.length
        ? Math.round(withTransit.reduce((sum, s) => sum + daysDiff(s.fulfillment_date, s.delivery_date!), 0) / withTransit.length)
        : null,
      onTimeRate: withEst.length
        ? Math.round(withEst.filter(s => new Date(s.delivery_date!) <= new Date(s.estimated_delivery_date!)).length / withEst.length * 100)
        : null,
    }
  }, [orders])

  if (isPending) {
    return (
      <div className="grid grid-cols-5 gap-3.5 mb-[30px]">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const attnColor = attentionCount > 0 ? '#DC2626' : '#16A34A'

  const kpis: KpiCardProps[] = [
    {
      label: 'In Transit',
      value: counts.inTransit,
      numericValue: counts.inTransit,
      icon: <Truck className="w-[15px] h-[15px]" />,
      animIndex: 0,
    },
    {
      label: 'Out for Delivery',
      value: counts.outForDel,
      numericValue: counts.outForDel,
      icon: <Clock className="w-[15px] h-[15px]" />,
      animIndex: 1,
    },
    {
      label: 'Needs Attention',
      value: attentionCount,
      numericValue: attentionCount,
      accentColor: attnColor,
      sub: attentionCount > 0 ? 'action required' : 'no action items',
      icon: <AlertTriangle className="w-[15px] h-[15px]" />,
      animIndex: 2,
    },
    {
      label: 'Avg Delivery',
      value: counts.avgDays ? `${counts.avgDays}d` : '\u2014',
      numericValue: counts.avgDays ?? 0,
      sub: counts.onTimeRate !== null ? `${counts.onTimeRate}% on time` : null,
      icon: <TrendingUp className="w-[15px] h-[15px]" />,
      animIndex: 3,
    },
    {
      label: 'Delivered',
      value: counts.delivered,
      numericValue: counts.delivered,
      icon: <CheckCircle className="w-[15px] h-[15px]" />,
      animIndex: 4,
    },
  ]

  return (
    <div className="grid grid-cols-5 gap-3.5 mb-[30px] animate-[fadeUp_0.4s_ease_0.05s_both]">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  )
}
