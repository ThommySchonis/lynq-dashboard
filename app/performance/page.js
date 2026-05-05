'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import EmptyState from '../components/EmptyState'

// Performance metrics page. Per ONBOARDING_SPEC v1.1 §4.2: empty state
// die de gebruiker naar de email-connect flow stuurt. De echte metrics
// (response time / ticket volume / agent activity) worden later
// opgebouwd op basis van email_conversations data — tot die er zijn
// blijft deze pagina permanent in empty-state modus.
export default function PerformancePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/login'
    })
  }, [])

  if (!mounted) return null

  return (
    <EmptyState
      icon="👥"
      title="No performance data yet"
      description="Connect your email to start tracking response time, ticket volume, and agent activity."
      actions={[
        { label: 'Connect Gmail',   href: '/settings/integrations/email', variant: 'primary' },
        { label: 'Connect Outlook', href: '/settings/integrations/email', variant: 'primary' },
      ]}
    />
  )
}
