'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useSignOut } from '@/hooks/auth'
import { Button } from '@/components/ui/button'
import { PRICING_PLANS, type PricingPlan } from '@/lib/pricing-constants'

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
          ? 'border border-[#A175FC] shadow-[0_4px_20px_rgba(161,117,252,0.18)]'
          : 'border border-[#E5E0EB] shadow-[0_1px_2px_rgba(28,15,54,0.04)]',
      ].join(' ')}
    >
      {plan.highlighted && plan.badge && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#A175FC] text-white text-[10px] font-bold tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full whitespace-nowrap">
          {plan.badge}
        </div>
      )}

      <div className="text-sm font-semibold text-[#1C0F36] mb-1.5">
        {plan.name}
      </div>

      <div className="text-[28px] font-bold text-[#1C0F36] tracking-tight mb-0.5">
        {plan.price}
        <span className="text-[13px] font-medium text-[#9B91A8]">/mo</span>
      </div>

      <div className="text-xs text-[#6B5E7B] mb-[18px]">
        {plan.ticketLimit}
      </div>

      <Button
        variant={plan.highlighted ? 'default' : 'outline'}
        className={[
          'w-full text-[13px] font-semibold',
          plan.highlighted
            ? 'bg-[#A175FC] hover:bg-[#8F5EE8] text-white border-[#A175FC]'
            : 'bg-white text-[#1C0F36] border-[#E5E0EB] hover:bg-gray-50',
        ].join(' ')}
        render={<Link href="/settings/billing" />}
      >
        Continue with {plan.name}
      </Button>
    </div>
  )
}

export default function PricingRequiredPage() {
  const [firstName, setFirstName] = useState('')
  const router = useRouter()
  const signOut = useSignOut()
  const session = useAuthStore((s) => s.session)
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => {
    if (!isLoading && !session) { router.push('/login'); return }
    if (user) {
      const meta = user.user_metadata ?? {}
      const raw = (meta.name || meta.full_name || user.email?.split('@')[0] || '').split(/\s+/)[0]
      setFirstName(raw || '')
    }
  }, [isLoading, session, user, router])

  function handleLogout() {
    signOut.mutate(undefined, {
      onSuccess: () => router.push('/login'),
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F9F8FF] to-[#F1EEF5] flex items-start justify-center px-6 py-16 font-[Switzer,system-ui,sans-serif] antialiased">
      <div className="w-full max-w-[960px]">
        <header className="text-center mb-8">
          <h1 className="text-[30px] font-bold text-[#1C0F36] tracking-[-0.02em] mb-2.5">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-[15px] text-[#6B5E7B] leading-relaxed max-w-[540px] mx-auto">
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
          <span className="text-[13px] text-[#6B5E7B]">— or —</span>
        </div>

        <div className="text-center mb-8">
          <Link
            href="/settings/billing"
            className="text-[13px] text-[#A175FC] underline font-medium"
          >
            Need more? Contact us for Enterprise
          </Link>
        </div>

        <p className="text-center text-xs text-[#9B91A8] mb-4">
          Your data is safe with us. We&apos;ll keep everything for 60 days
          in case you change your mind.
        </p>

        <div className="text-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={signOut.isPending}
            className="bg-transparent border-none text-[#9B91A8] text-xs cursor-pointer underline font-[inherit] disabled:opacity-50"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
