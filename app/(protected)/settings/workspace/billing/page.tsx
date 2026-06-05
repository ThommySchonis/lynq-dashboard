'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BillingView } from '@/components/features/settings/workspace/billing/billing-view'
import { isBillingUIEnabled } from '@/lib/billing-ui'

// Static route — takes precedence over app/settings/[category]/[page]
// which currently renders the "this page is being built" placeholder
// for workspace/billing.
//
// Suspense boundary required by Next.js because BillingView reads
// useSearchParams (for the ?tab= query state).
export default function BillingPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isBillingUIEnabled()) router.replace('/home')
  }, [router])

  if (!isBillingUIEnabled()) return null

  return (
    <Suspense fallback={null}>
      <BillingView />
    </Suspense>
  )
}
