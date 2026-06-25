'use client'

import { useState } from 'react'
import { PlanCard } from '@/components/features/onboarding/plan-card'
import { PRICING_PLANS, type PricingPlan } from '@/lib/onboarding-constants'

/**
 * "Change your plan" — reuses the onboarding pricing block (PlanCard +
 * PRICING_PLANS) verbatim, including its click-to-select highlight. Billing is
 * managed by Shopify, so the actual switch happens via the Shopify
 * managed-pricing page (CURRENT PLAN → "Change plan"); the cards here let the
 * user preview/pick a tier.
 */
export function ChangePlanSection() {
  const [selected, setSelected] = useState<PricingPlan['id'] | null>(null)

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-foreground">Change your plan</h2>
        <p className="text-sm font-medium text-foreground-3">
          Every plan includes a complimentary 7-day trial — you won&apos;t be billed until it ends.
        </p>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        {PRICING_PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={selected === plan.id}
            onSelect={() => setSelected(plan.id)}
          />
        ))}
      </div>
    </>
  )
}
