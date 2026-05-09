'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { supabase } from '../../lib/supabase'

// Sole owner of Sentry user-context. Mounted once in app/layout.tsx so
// every auth state change in the app passes through here:
//   - SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED → setUser({ id, email })
//   - SIGNED_OUT                                 → setUser(null)
//
// On initial mount we also seed the user from the current session so
// errors thrown before the first auth event still carry user context.
export default function SentryUserSync() {
  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.user) {
        Sentry.setUser({ id: session.user.id, email: session.user.email })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        Sentry.setUser(null)
        return
      }
      Sentry.setUser({ id: session.user.id, email: session.user.email })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return null
}
