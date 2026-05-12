'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { EmptyState } from '@/components/shared/empty-state'
import { Users } from 'lucide-react'

// Performance metrics page. Per ONBOARDING_SPEC v1.1 §4.2: empty state
// die de gebruiker naar de email-connect flow stuurt. De echte metrics
// (response time / ticket volume / agent activity) worden later
// opgebouwd op basis van email_conversations data — tot die er zijn
// blijft deze pagina permanent in empty-state modus.
export default function PerformancePage() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isLoading && !session) router.push('/login')
  }, [isLoading, session, router])

  if (!mounted) return null

  return (
    <EmptyState
      icon={Users}
      title="No performance data yet"
      description="Connect your email to start tracking response time, ticket volume, and agent activity."
      actionLabel="Connect email"
      onAction={() => router.push('/settings/integrations/email')}
    />
  )
}
