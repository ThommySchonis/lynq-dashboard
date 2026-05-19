'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => {
    if (isLoading || session) return

    const search = searchParams.toString()
    const fullPath = search ? `${pathname}?${search}` : pathname
    router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`)
  }, [isLoading, session, router, pathname, searchParams])

  if (isLoading || !session) return null

  return children
}
