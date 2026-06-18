'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PricingPlan } from '@/lib/onboarding-constants'

interface PlanCardProps {
  plan: PricingPlan
  selected: boolean
  onSelect: () => void
}

const PRICE_TEXT = 'text-[22px] font-bold tracking-[-0.01em] text-foreground'

export function PlanCard({ plan, selected, onSelect }: PlanCardProps) {
  const emphasized = plan.highlighted || selected

  return (
    <div
      className={cn(
        'relative flex flex-1 flex-col gap-[18px] rounded-2xl border p-6 transition-colors',
        plan.highlighted && 'md:z-10 md:scale-[1.04]',
        emphasized ? 'border-primary' : 'border-border',
        selected ? 'bg-accent-soft ring-2 ring-primary' : 'bg-card',
      )}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-primary bg-background px-2.5 py-1 text-xs font-medium text-primary">
          {plan.badge}
        </span>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <span className={PRICE_TEXT}>{plan.name}</span>
        <span className="flex items-baseline gap-1">
          {plan.pricePrefix && <span className="text-sm text-foreground-3">{plan.pricePrefix}</span>}
          <span className={PRICE_TEXT}>{plan.price}</span>
          <span className="text-sm text-foreground-3">{plan.period}</span>
        </span>
      </div>

      <p className="min-h-10 text-sm text-foreground-3">{plan.tagline}</p>

      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'h-11 w-full rounded-lg text-sm font-semibold transition-colors',
          emphasized
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
