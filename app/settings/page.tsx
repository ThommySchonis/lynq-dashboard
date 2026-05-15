'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Primary redirect is in next.config.ts (HTTP-level).
// This client fallback covers client-side navigations that bypass it.
export default function SettingsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/settings/workspace/general')
  }, [router])
  return null
}
