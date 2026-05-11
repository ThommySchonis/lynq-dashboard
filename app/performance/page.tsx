'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
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

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
  }, [router])

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
