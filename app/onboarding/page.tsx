import type { Metadata } from 'next'
import { OnboardingWizard } from '@/components/features/onboarding/onboarding-wizard'

export const metadata: Metadata = {
  title: 'Get started — Lynq',
  description: 'Set up your Lynq workspace in a few quick steps.',
}

export default function OnboardingPage() {
  return <OnboardingWizard />
}
