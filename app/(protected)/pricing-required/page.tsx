'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { apiUrl } from '@/lib/api-client'
import { useSignOut } from '@/hooks/auth'
import { Button } from '@/components/ui/button'
import { PRICING_PLANS, type PricingPlan } from '@/lib/pricing-constants'
import { isBillingUIEnabled } from '@/lib/billing-ui'

// Minimal stub voor /pricing-required (ONBOARDING_SPEC v1.1 §10.2).
// De definitieve premium UX wordt opgebouwd in een latere sprint
// samen met /settings/billing en de Day 7 modal. Voor nu: 4 plan
// cards + CTAs naar /settings/billing.
//
// Geen Sidebar — blocked users mogen alleen hier, /settings/billing
// of /logout. Sidebar weghalen voorkomt dat ze rondspringen naar
// pages die alsnog 402'en (server-side) of redirecten (client-side).

interface PlanCardProps {
  plan: PricingPlan
}

function PlanCard({ plan }: PlanCardProps) {
  return (
    <div
      className={[
        'relative px-5 py-6 bg-white rounded-xl text-center',
        plan.highlighted
          ? 'border border-primary shadow-[0_4px_20px_rgba(161,117,252,0.18)]'
          : 'border border-[#E5E0EB] shadow-[0_1px_2px_rgba(28,15,54,0.04)]',
      ].join(' ')}
    >
      {plan.highlighted && plan.badge && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full whitespace-nowrap">
          {plan.badge}
        </div>
      )}

      <div className="text-sm font-semibold text-foreground mb-1.5">
        {plan.name}
      </div>

      <div className="text-[28px] font-bold text-foreground tracking-tight mb-0.5">
        {plan.price}
        <span className="text-[13px] font-medium text-foreground-4">/mo</span>
      </div>

      <div className="text-xs text-muted-foreground mb-[18px]">
        {plan.ticketLimit}
      </div>

      <Button
        variant={plan.highlighted ? 'default' : 'outline'}
        className={[
          'w-full text-[13px] font-semibold',
          plan.highlighted
            ? 'bg-primary hover:bg-[#8F5EE8] text-white border-primary'
            : 'bg-white text-foreground border-[#E5E0EB] hover:bg-gray-50',
        ].join(' ')}
        render={<Link href="/settings/billing" />}
      >
        Continue with {plan.name}
      </Button>
    </div>
  )
}

export default function PricingRequiredPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isBillingUIEnabled()) router.replace('/home')
  }, [router])

  const [firstName, setFirstName] = useState('')
  const signOut = useSignOut()
  const user    = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)

  useEffect(() => {
    if (user) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>
      const raw = String(meta.name || meta.full_name || user.email?.split('@')[0] || '').split(/\s+/)[0]
      setFirstName(raw || '')
    }
  }, [user])

  // Platform admins should never be stuck on this page. If they land
  // here (bookmark, stale redirect, manual URL), send them to /home.
  // The is_platform_admin flag is set server-side and cannot be spoofed.
  useEffect(() => {
    if (!session?.access_token) return
    void fetch(apiUrl('onboarding/status'), {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache:   'no-store',
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { is_payment_exempt?: boolean } | null) => {
        if (data?.is_payment_exempt) router.replace('/home')
      })
      .catch(() => { /* fail-open: toon de normale pagina als de check mislukt */ })
  }, [session, router])

  if (!isBillingUIEnabled()) return null

  function handleLogout() {
    signOut.mutate(undefined, {
      onSuccess: () => router.push('/login'),
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-[#F1EEF5] flex items-start justify-center px-6 py-16 font-[Switzer,system-ui,sans-serif] antialiased">
      <div className="w-full max-w-[960px]">
        <header className="text-center mb-8">
          <h1 className="text-[30px] font-bold text-foreground tracking-[-0.02em] mb-2.5">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed max-w-[540px] mx-auto">
            Pick a plan to access your account again. Your data is saved
            for 60 days in case you change your mind.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {PRICING_PLANS.map(plan => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        <div className="text-center mb-4">
          <span className="text-[13px] text-muted-foreground">— or —</span>
        </div>

        <div className="text-center mb-8">
          <Link
            href="/settings/billing"
            className="text-[13px] text-primary underline font-medium"
          >
            Need more? Contact us for Enterprise
          </Link>
        </div>

        <p className="text-center text-xs text-foreground-4 mb-4">
          Your data is safe with us. We&apos;ll keep everything for 60 days
          in case you change your mind.
        </p>

        <div className="text-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={signOut.isPending}
            className="bg-transparent border-none text-foreground-4 text-xs cursor-pointer underline font-[inherit] disabled:opacity-50"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
