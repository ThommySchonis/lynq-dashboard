'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/shared/empty-state'
import { Users } from 'lucide-react'

export default function PerformancePage() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

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
