'use client'

import { BillingView } from '@/components/features/settings/workspace/billing/billing-view'

// Static route — takes precedence over app/settings/[category]/[page]
// which currently renders the "this page is being built" placeholder
// for workspace/billing.
export default function BillingPage() {
  return <BillingView />
}
