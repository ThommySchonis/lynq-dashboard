'use client'

import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { PlanCard } from '../plan-card'
import { PRICING_PLANS } from '@/lib/onboarding-constants'
import type { PricingPlan } from '@/lib/onboarding-constants'

interface StepPricingProps {
  stepIndex: number
  account: { name: string; email: string }
  plan: PricingPlan['id'] | null
  onSelect: (plan: PricingPlan['id']) => void
  onBack: () => void
  onNext: () => void
}

export function StepPricing({ stepIndex, account, plan, onSelect, onBack, onNext }: StepPricingProps) {
  return (
    <WizardShell
      wide
      account={account}
      footer={<ProgressFooter stepIndex={stepIndex} onBack={onBack} onNext={onNext} nextDisabled={!plan} />}
    >
      <div className="flex flex-col gap-8">
        <StepHeading
          center
          title="Choose a plan that suits you"
          description="Every subscription plan includes a complimentary 7-day trial. You won't be billed until the trial period concludes."
        />

        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          {PRICING_PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} selected={plan === p.id} onSelect={() => onSelect(p.id)} />
          ))}
        </div>

        <p className="text-center text-xs text-foreground-3">
          You can change your plan anytime from settings.
        </p>
      </div>
    </WizardShell>
  )
}
