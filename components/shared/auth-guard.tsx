'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useAccountDeletionStatus } from '@/hooks/settings/use-account-deletion'

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)
  const { data: deletionStatus } = useAccountDeletionStatus()

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

  if (isLoading || !session) return null

  return children
}
