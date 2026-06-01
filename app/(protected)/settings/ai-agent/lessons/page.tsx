'use client'

import { Suspense } from 'react'
import { LessonsSettings } from '@/components/features/settings/ai-agent/lessons-settings'

// Static route — takes precedence over app/settings/[category]/[page]
// which renders the "this page is being built" placeholder otherwise.
//
// Suspense boundary required by Next.js because LessonsSettings reads
// useSearchParams (for the ?store= query state).
export default function LessonsPage() {
  return (
    <Suspense fallback={null}>
      <LessonsSettings />
    </Suspense>
  )
}
