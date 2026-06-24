'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useAccountDeletionStatus } from '@/hooks/settings/use-account-deletion'
import { useSubscription } from '@/hooks/billing'

const BILLING_GATE_EXEMPT = [
  '/pricing-required',
  '/settings/workspace/billing',
  '/account/scheduled-deletion',
  '/logout',
]

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)
  const { data: deletionStatus } = useAccountDeletionStatus()
  const { data: subData, isLoading: subLoading } = useSubscription()

  useEffect(() => {
    if (isLoading || session) return

    const search = searchParams.toString()
    const fullPath = search ? `${pathname}?${search}` : pathname
    router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`)
  }, [isLoading, session, router, pathname, searchParams])

  useEffect(() => {
    if (!session || !deletionStatus?.scheduled) return
    if (pathname === '/account/scheduled-deletion') return

    router.replace('/account/scheduled-deletion')
  }, [session, deletionStatus, pathname, router])

  // Billing gate: redirect to /pricing-required when subscription is not
  // active, trialing, or grandfathered. Exempt the pricing-required route
  // itself (and logout/deletion) to avoid redirect loops.
  useEffect(() => {
    if (!session || subLoading || subData === undefined) return
    if (BILLING_GATE_EXEMPT.some((exempt) => pathname.startsWith(exempt))) return

    const sub = subData?.subscription
    const ok =
      sub?.isGrandfathered === true ||
      sub?.status === 'active' ||
      sub?.status === 'trial'

    if (!ok) router.replace('/pricing-required')
  }, [session, subLoading, subData, pathname, router])

  if (isLoading || !session) return null

  return children
}
