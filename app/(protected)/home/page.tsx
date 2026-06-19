'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { WelcomeBanner } from '@/components/shared/welcome-banner'
import { TrialEndingBanner } from '@/components/shared/trial-ending-banner'
import { isTrialEndingSoon } from '@/lib/trialStatus'
import { useOnboardingStatus } from '@/hooks/home'
import { Button } from '@/components/ui/button'
import { HomeHeader } from '@/components/features/home/home-header'
import { AiHeroCard } from '@/components/features/home/ai-hero-card'
import { PromoCard } from '@/components/features/home/promo-card'
import { GetStartedCard } from '@/components/features/home/get-started-card'
import { HelpdeskGlance } from '@/components/features/home/helpdesk-glance'
import { ComingSoonSection } from '@/components/features/home/coming-soon-section'
import {
  IMPORT_PROMO,
  ONBOARDING_CALL_PROMO,
  CALENDLY_ONBOARDING_URL,
} from '@/lib/home-constants'
import { deriveUserName } from '@/lib/home-utils'

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const [mounted, setMounted] = useState(false)
  const [welcomeHidden, setWelcomeHidden] = useState(false)
  const [importHidden, setImportHidden] = useState(false)

  const { data: onboarding } = useOnboardingStatus()

  useEffect(() => {
    setMounted(true)
  }, [])

  const userName = deriveUserName(user, onboarding)

  const trialEndingShouldShow =
    !!onboarding &&
    isTrialEndingSoon({
      subscription_status: onboarding.subscription_status,
      trial_ends_at: onboarding.trial_ends_at,
    })

  const welcomeShouldShow =
    !trialEndingShouldShow &&
    !welcomeHidden &&
    onboarding?.subscription_status === 'trial' &&
    !onboarding?.user?.welcome_dismissed_at

  if (!mounted) return null

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-accent-soft blur-[80px] motion-safe:animate-orb-float-1" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 size-[640px] rounded-full bg-info-soft blur-[80px] motion-safe:animate-orb-float-2" />

      {/* Banners */}
      {trialEndingShouldShow && <TrialEndingBanner />}
      {welcomeShouldShow && (
        <WelcomeBanner
          firstName={onboarding?.user?.first_name ?? userName}
          onDismissed={() => setWelcomeHidden(true)}
        />
      )}

      <div className="relative z-[1] mx-auto flex max-w-[1180px] flex-col gap-6 px-6 py-10 md:px-12">
        <HomeHeader userName={userName} />

        <AiHeroCard />

        {!importHidden && (
          <PromoCard
            config={IMPORT_PROMO}
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => setImportHidden(true)}>
                  Skip for now
                </Button>
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/settings/integrations/migrations" />}
                >
                  Start import
                </Button>
              </>
            }
          />
        )}

        <PromoCard
          config={ONBOARDING_CALL_PROMO}
          actions={
            <Button
              size="sm"
              nativeButton={false}
              render={
                <a href={CALENDLY_ONBOARDING_URL} target="_blank" rel="noopener noreferrer" />
              }
            >
              Book a call
            </Button>
          }
        />

        <GetStartedCard />

        <HelpdeskGlance />

        <ComingSoonSection />
      </div>
    </div>
  )
}
