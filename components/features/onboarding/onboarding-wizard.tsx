'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepGoal } from './steps/step-goal'
import { StepAccount } from './steps/step-account'
import { StepConfirm } from './steps/step-confirm'
import { StepConnectStore } from './steps/step-connect-store'
import { StepTeamVolume } from './steps/step-team-volume'
import { StepHearAbout } from './steps/step-hear-about'
import { StepPricing } from './steps/step-pricing'
import { INITIAL_WIZARD_DATA } from '@/lib/onboarding-constants'
import type { WizardData, GoalFormData, AccountFormData, PricingPlan } from '@/lib/onboarding-constants'

/** Orchestrates the 7-step onboarding wizard. UI-first — state is client-side only. */
export function OnboardingWizard() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [data, setData] = useState<WizardData>(INITIAL_WIZARD_DATA)

  const next = () => setStepIndex((i) => i + 1)
  const back = () => setStepIndex((i) => i - 1)
  const patch = (values: Partial<WizardData>) => setData((d) => ({ ...d, ...values }))

  const account = { name: data.name, email: data.email }

  switch (stepIndex) {
    case 0:
      return (
        <StepGoal
          defaultValues={{ name: data.name, brandName: data.brandName, goal: (data.goal ?? undefined) as GoalFormData['goal'] }}
          onNext={(values) => {
            patch(values)
            next()
          }}
        />
      )
    case 1:
      return (
        <StepAccount
          defaultValues={{ email: data.email, password: data.password } as AccountFormData}
          onBack={back}
          onNext={(values) => {
            patch(values)
            next()
          }}
        />
      )
    case 2:
      return <StepConfirm email={data.email} onBack={back} onNext={next} />
    case 3:
      return <StepConnectStore onBack={back} onNext={next} />
    case 4:
      return (
        <StepTeamVolume
          account={account}
          agentCount={data.agentCount}
          ticketVolume={data.ticketVolume}
          onChange={patch}
          onBack={back}
          onNext={next}
        />
      )
    case 5:
      return (
        <StepHearAbout
          account={account}
          referral={data.referral}
          referralDetails={data.referralDetails}
          onChange={patch}
          onBack={back}
          onNext={next}
        />
      )
    case 6:
      return (
        <StepPricing
          account={account}
          plan={data.plan}
          onSelect={(plan: PricingPlan['id']) => patch({ plan })}
          onBack={back}
          // Backend pass: hand off to Shopify managed billing. UI-first stub routes to login.
          onNext={() => router.push('/login')}
        />
      )
    default:
      return null
  }
}
