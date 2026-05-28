'use client'

import { Users, AlertTriangle, Unplug, UserX } from 'lucide-react'

interface SummaryCardsProps {
  total: number
  overdue: number
  disconnected: number
  inactive7d: number
}

const cards = [
  { key: 'total', label: 'Total Clients', icon: Users, color: 'text-primary' },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle, color: 'text-red-500' },
  { key: 'disconnected', label: 'Disconnected', icon: Unplug, color: 'text-amber-500' },
  { key: 'inactive7d', label: 'Inactive 7d+', icon: UserX, color: 'text-muted-foreground' },
] as const

export function ClientSummaryCards({ total, overdue, disconnected, inactive7d }: SummaryCardsProps) {
  const values: Record<string, number> = { total, overdue, disconnected, inactive7d }

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.key}
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Icon size={14} strokeWidth={2} className={card.color} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <div className={`mt-1 text-xl font-semibold ${card.color}`}>
              {values[card.key]}
            </div>
          </div>
        )
      })}
    </div>
  )
}
