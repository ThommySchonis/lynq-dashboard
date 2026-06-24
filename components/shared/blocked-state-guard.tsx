'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useSubscription } from '@/hooks/billing/use-billing-data'

const ALLOW_PATHS = [
  '/pricing-required',
  '/settings/workspace/billing',
  '/settings/billing',
  '/login',
  '/signup',
  '/onboarding',
  '/forgot-password',
  '/invites',
  '/admin',
]

function isAllowed(pathname: string | null) {
  if (!pathname) return true
  return ALLOW_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function BlockedStateGuardInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)
  const { data: subData, isLoading: subLoading } = useSubscription()

  useEffect(() => {
    if (!session || isLoading || subLoading || isAllowed(pathname)) return

    const sub = subData?.subscription
    const blocked = subData?.blocked

    // No subscription data yet — wait
    if (!sub) return

    // Grandfathered workspaces always pass
    if (sub.isGrandfathered) return

    // Shopify reported a plan we can't map — block until an admin fixes the mapping.
    if (blocked?.planUnmapped) {
      router.replace('/pricing-required')
      return
    }

    // Active or trialing — allow
    if (sub.status === 'active' || sub.status === 'trial') return

    // Blocked on ticket or AI suggest limit
    if (blocked?.tickets || blocked?.aiSuggest) {
      router.replace('/pricing-required')
      return
    }

    // Suspended Shopify charge status
    const shopifyStatus = sub.shopifyChargeStatus?.toLowerCase() ?? ''
    if (['frozen', 'expired', 'cancelled'].includes(shopifyStatus)) {
      router.replace('/pricing-required')
    }
  }, [session, isLoading, subLoading, subData, pathname, router])

  if (isLoading || (session && subLoading && !isAllowed(pathname))) return null
  return children
}

export function BlockedStateGuard({ children }: { children: ReactNode }) {
  return <BlockedStateGuardInner>{children}</BlockedStateGuardInner>
}

export default BlockedStateGuard
