'use client'

import { Suspense } from 'react'
import { BillingView } from '@/components/features/settings/workspace/billing/billing-view'

// Static route — takes precedence over app/settings/[category]/[page]
// which currently renders the "this page is being built" placeholder
// for workspace/billing.
//
// Suspense boundary required by Next.js because BillingView reads
// useSearchParams (for the ?tab= query state).
export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingView />
    </Suspense>
  )
}
