'use client'

import { Suspense } from 'react'
import { OnboardingSettings } from '@/components/features/settings/ai-agent/onboarding-settings'

// Static route — takes precedence over app/settings/[category]/[page]
// which renders the "this page is being built" placeholder otherwise.
//
// Suspense boundary required by Next.js because OnboardingSettings reads
// useSearchParams (for the ?store= query state).
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingSettings />
    </Suspense>
  )
}
