'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        'relative flex flex-1 flex-col rounded-2xl border p-6',
        emphasized
          ? 'border-primary bg-accent-soft shadow-card ring-1 ring-primary'
          : 'border-border bg-card',
      )}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          {plan.badge}
        </span>
      )}

      <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>

      <div className="mt-4 flex items-baseline gap-1">
        {plan.pricePrefix && <span className="text-sm text-foreground-3">{plan.pricePrefix}</span>}
        <span className="font-[family-name:var(--font-display)] text-4xl font-bold text-foreground">
          {plan.price}
        </span>
        <span className="text-sm text-foreground-3">{plan.period}</span>
      </div>

      <p className="mt-2 min-h-10 text-sm text-foreground-3">{plan.tagline}</p>

      <Button
        variant={plan.highlighted ? 'default' : 'secondary'}
        size="lg"
        className="mt-6 w-full"
        onClick={onSelect}
      >
        {plan.cta}
      </Button>

      <p className="mt-8 text-sm font-medium text-foreground">{plan.featuresHeading}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-foreground-3">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
