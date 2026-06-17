'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useSaveBrand, useCompleteOnboarding } from '@/hooks/onboarding'
import { StepGoal } from './steps/step-goal'
import { StepAccount } from './steps/step-account'
import { StepConfirm } from './steps/step-confirm'
import { StepConnectStore } from './steps/step-connect-store'
import { StepTeamVolume } from './steps/step-team-volume'
import { StepHearAbout } from './steps/step-hear-about'
import { StepPricing } from './steps/step-pricing'
import { INITIAL_WIZARD_DATA } from '@/lib/onboarding-constants'
import type { WizardData, PricingPlan } from '@/lib/onboarding-constants'

/** Orchestrates the 7-step onboarding wizard. UI-first — state is client-side only. */
export function OnboardingWizard() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const saveBrand = useSaveBrand()
  const completeOnboarding = useCompleteOnboarding()

  const [stepIndex, setStepIndex] = useState(0)
  const [data, setData] = useState<WizardData>(INITIAL_WIZARD_DATA)

  const next = () => setStepIndex((i) => i + 1)
  const back = () => setStepIndex((i) => i - 1)
  const patch = (values: Partial<WizardData>) => setData((d) => ({ ...d, ...values }))

  const account = { name: data.name, email: data.email }

  // Leaving the email-confirm step into the authenticated portion: persist the
  // brand captured on step 1. No-op until a real session exists (account
  // creation + email-confirm resume is the remaining backend gap).
  // language/tone aren't collected in this flow yet — seed sensible defaults.
  function handleConfirmNext() {
    if (session) {
      saveBrand.mutate({ brandName: data.brandName, language: 'English', tone: 'professional' })
    }
    next()
  }

  // Final step: mark onboarding complete, then continue. Real billing handoff to
  // Shopify managed pricing is wired in a later pass.
  function handleFinish() {
    if (user) {
      completeOnboarding.mutate(user.id, { onSuccess: () => router.push('/home') })
    } else {
      router.push('/login')
    }
  }

  switch (stepIndex) {
    case 0:
      return (
        <StepGoal
          stepIndex={stepIndex}
          defaultValues={{ name: data.name, brandName: data.brandName, goal: data.goal ?? undefined }}
          onNext={(values) => {
            patch(values)
            next()
          }}
        />
      )
    case 1:
      return (
        <StepAccount
          stepIndex={stepIndex}
          defaultValues={{ email: data.email, password: data.password }}
          onBack={back}
          onNext={(values) => {
            patch(values)
            next()
          }}
        />
      )
    case 2:
      return <StepConfirm stepIndex={stepIndex} email={data.email} onBack={back} onNext={handleConfirmNext} />
    case 3:
      return <StepConnectStore stepIndex={stepIndex} onBack={back} onNext={next} />
    case 4:
      return (
        <StepTeamVolume
          stepIndex={stepIndex}
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
          stepIndex={stepIndex}
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
          stepIndex={stepIndex}
          account={account}
          plan={data.plan}
          onSelect={(plan: PricingPlan['id']) => patch({ plan })}
          onBack={back}
          onNext={handleFinish}
        />
      )
    default:
      return null
  }
}
