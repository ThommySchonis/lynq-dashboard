'use client'

import { Suspense } from 'react'
import { RulesSettings } from '@/components/features/settings/ai-agent/rules-settings'

// Static route — takes precedence over app/settings/[category]/[page]
// which renders the "this page is being built" placeholder otherwise.
//
// Suspense boundary required by Next.js because RulesSettings reads
// useSearchParams (for the ?store= query state).
export default function RulesPage() {
  return (
    <Suspense fallback={null}>
      <RulesSettings />
    </Suspense>
  )
}
