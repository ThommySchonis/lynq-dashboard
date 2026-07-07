'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useSignUp } from '@/hooks/auth/use-auth-mutations'
import { useSaveBrand, useCompleteOnboarding } from '@/hooks/onboarding'
import { getOnboardingStatus } from '@/lib/onboarding-status'
import { StepGoal } from './steps/step-goal'
import { StepAccount } from './steps/step-account'
import { StepConfirm } from './steps/step-confirm'
import { StepConnectStore } from './steps/step-connect-store'
import { StepTeamVolume } from './steps/step-team-volume'
import { StepHearAbout } from './steps/step-hear-about'
import { StepPricing } from './steps/step-pricing'
import { INITIAL_WIZARD_DATA } from '@/lib/onboarding-constants'
import type { WizardData, PricingPlan, AccountFormData } from '@/lib/onboarding-constants'

const CONNECT_STORE_STEP = 3

/** Reads a string field from Supabase user_metadata without using `any`. */
function metaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = meta?.[key]
  return typeof value === 'string' ? value : undefined
}

/** Orchestrates the 7-step onboarding wizard (now the canonical signup funnel). */
export function OnboardingWizard() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.isLoading)
  const signUp = useSignUp()
  const saveBrand = useSaveBrand()
  const completeOnboarding = useCompleteOnboarding()

  const [stepIndex, setStepIndex] = useState(0)
  const [data, setData] = useState<WizardData>(INITIAL_WIZARD_DATA)
  // Until we've resolved an existing session's onboarding status, we hold the
  // UI to avoid flashing step 0 to a user who should resume at Connect-store.
  const [booted, setBooted] = useState(false)

  const next = () => setStepIndex((i) => i + 1)
  const back = () => setStepIndex((i) => i - 1)
  const patch = (values: Partial<WizardData>) => setData((d) => ({ ...d, ...values }))

  const account = { name: data.name, email: data.email, storeName: data.brandName }

  // On mount: if already authenticated, branch on onboarding status. Completed
  // users leave; incomplete users resume at Connect-store with name/brand/goal
  // restored from signUp metadata (which survives a fresh-session email click).
  useEffect(() => {
    if (booted || authLoading) return
    if (!session || !user) {
      setBooted(true)
      return
    }
    let cancelled = false
    void getOnboardingStatus().then((complete) => {
      if (cancelled) return
      if (complete) {
        router.replace('/home')
        return
      }
      const meta = user.user_metadata as Record<string, unknown> | undefined
      const brand = metaString(meta, 'brand_name')
      const goalMeta = metaString(meta, 'goal')
      setData((d) => ({
        ...d,
        name: metaString(meta, 'full_name') ?? d.name,
        brandName: brand ?? d.brandName,
        goal: (goalMeta as WizardData['goal']) ?? d.goal,
      }))
      if (brand) {
        saveBrand.mutate({ brandName: brand, language: 'English', tone: 'professional' })
      }
      setStepIndex(CONNECT_STORE_STEP)
      setBooted(true)
    })
    return () => {
      cancelled = true
    }
    // saveBrand is a stable mutation object; intentionally excluded.
  }, [booted, authLoading, session, user, router]) // eslint-disable-line react-hooks/exhaustive-deps

  // Account step: create the real account, then wait on email confirmation.
  function handleAccountNext(values: AccountFormData) {
    patch(values)
    const trimmed = data.name.trim()
    const firstSpace = trimmed.indexOf(' ')
    const firstName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
    const lastName = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1)
    signUp.mutate(
      {
        email: values.email,
        password: values.password,
        first_name: firstName,
        last_name: lastName,
        company_name: data.brandName,
        brand_name: data.brandName,
        full_name: data.name,
        goal: data.goal ?? undefined,
      },
      {
        onSuccess: (res) => {
          // Email confirmation on => no session yet: show the confirm step.
          // Auto-confirm fallback => session present: persist brand and skip
          // straight to Connect-store in the same tab.
          if (res.session) {
            if (data.brandName) {
              saveBrand.mutate({
                brandName: data.brandName,
                language: 'English',
                tone: 'professional',
              })
            }
            setStepIndex(CONNECT_STORE_STEP)
          } else {
            next()
          }
        },
      },
    )
  }

  // Final step: mark onboarding complete, then continue to the dashboard.
  function handleFinish() {
    if (user) {
      completeOnboarding.mutate(undefined, { onSuccess: () => router.push('/home') })
    } else {
      router.push('/login')
    }
  }

  // Hold rendering while we resolve an authenticated user's resume target.
  if (session && !booted) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground-3">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  const signUpError =
    signUp.error instanceof Error ? signUp.error.message : undefined

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
          onNext={handleAccountNext}
          submitting={signUp.isPending}
          errorMessage={signUpError}
        />
      )
    case 2:
      return <StepConfirm stepIndex={stepIndex} email={data.email} onBack={back} />
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
