'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PricingPlan } from '@/lib/onboarding-constants'

interface PlanCardProps {
  plan: PricingPlan
  selected: boolean
  onSelect: () => void
}

export function PlanCard({ plan, selected, onSelect }: PlanCardProps) {
  const emphasized = plan.highlighted || selected

  return (
    <div
      className={cn(
        'relative flex flex-1 flex-col gap-[18px] rounded-2xl border bg-card p-6',
        emphasized ? 'border-primary' : 'border-border',
      )}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-primary bg-background px-2.5 py-1 text-xs font-medium text-primary">
          {plan.badge}
        </span>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[22px] font-bold tracking-[-0.01em] text-foreground">{plan.name}</span>
        <span className="flex items-baseline gap-1">
          {plan.pricePrefix && <span className="text-sm text-foreground-3">{plan.pricePrefix}</span>}
          <span className="text-[22px] font-bold tracking-[-0.01em] text-foreground">{plan.price}</span>
          <span className="text-sm text-foreground-3">{plan.period}</span>
        </span>
      </div>

      <p className="text-sm text-foreground-3">{plan.tagline}</p>

      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'h-11 w-full rounded-[10px] text-sm font-semibold transition-colors',
          plan.highlighted
            ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
            : 'border border-primary bg-transparent text-primary hover:bg-accent-soft',
        )}
      >
        {plan.cta}
      </button>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground-3">{plan.featuresHeading}</p>
        <ul className="flex flex-col gap-4">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm">
              <Check className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="text-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
