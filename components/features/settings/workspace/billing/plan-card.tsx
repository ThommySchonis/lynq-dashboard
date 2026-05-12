'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Plan } from '@/types/billing'

interface PlanCardProps {
  plan:        Plan
  isActive?:   boolean
  selectable?: boolean
  onSelect?:   (planId: string) => void
  className?:  string
}

/**
 * Single-plan card used inside the plan-selector modal. Shows price,
 * ticket + AI Suggest limits, and an "Active" badge when this is the
 * workspace's current plan.
 */
export function PlanCard({ plan, isActive, selectable, onSelect, className }: PlanCardProps) {
  const isClickable = selectable && !isActive && !plan.is_custom

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => isClickable && onSelect?.(plan.id)}
      className={cn(
        'group/plan-card flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition-all',
        isActive && 'border-primary/40 ring-1 ring-primary/30',
        isClickable && 'hover:border-primary/40 hover:shadow-sm cursor-pointer',
        !isClickable && !isActive && 'cursor-not-allowed opacity-80',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-foreground">{plan.display_name}</span>
          {plan.is_custom ? (
            <span className="text-xs text-muted-foreground">Contact sales for pricing</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {plan.ticket_limit?.toLocaleString()} tickets · {plan.ai_suggest_limit?.toLocaleString()} AI Suggest
            </span>
          )}
        </div>
        {isActive && <Badge variant="default">Active</Badge>}
      </div>

      <div className="flex items-baseline gap-1">
        {plan.is_custom ? (
          <span className="text-xl font-semibold text-foreground">Custom</span>
        ) : (
          <>
            <span className="text-2xl font-semibold tabular-nums text-foreground">€{Number(plan.price_eur).toFixed(0)}</span>
            <span className="text-xs text-muted-foreground">/ month</span>
          </>
        )}
      </div>
    </button>
  )
}
