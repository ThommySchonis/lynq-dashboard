import { Suspense } from 'react'
import { ConsentForm } from './consent-form'

// The authorization endpoint. Renders a consent screen; the client component
// reads the browser Supabase session and approves via POST /api/oauth/authorize.
export default function AuthorizePage() {
  return (
    <Suspense fallback={null}>
      <ConsentForm />
    </Suspense>
  )
}
