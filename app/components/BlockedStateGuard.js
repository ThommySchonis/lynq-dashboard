'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { isTrialExpired } from '../../lib/trialStatus'

// Client-side guard die elke ingelogde dashboard-page checkt op
// blocked state (expired trial zonder upgrade). Routes naar
// /pricing-required als geblokkeerd.
//
// Wraps the entire app via app/layout.tsx. Allow-paths skip the check
// volledig (login, signup, billing, /pricing-required zelf, etc.).
// Server-side defense komt in proxy.js (returns 402 op /api/*).
//
// Voor v1: één fetch per page-load. Geen caching. Latency op cold
// pages is ~100-300ms (single supabase getSession + één fetch).

const ALLOW_PATHS = [
  '/pricing-required',
  '/settings/billing',
  '/login',
  '/signup',
  '/forgot-password',
  '/invites',
  '/admin',
]

function isAllowed(pathname) {
  if (!pathname) return true
  return ALLOW_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export default function BlockedStateGuard({ children }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Skip op allow-paths, of als we nog geen pathname hebben
    if (isAllowed(pathname)) { setChecked(true); return }

    let cancelled = false
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setChecked(true); return }  // niet ingelogd → laat andere guards afhandelen

      try {
        const res = await fetch('/api/onboarding/status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache:   'no-store',
        })
        if (!res.ok) {
          // 402 betekent: server-side denkt al dat we blocked zijn → redirect
          if (res.status === 402 && !cancelled) router.replace('/pricing-required')
          else if (!cancelled) setChecked(true)
          return
        }
        const data = await res.json()

        // Paying users zijn nooit geblokkeerd
        if (data?.subscription_status === 'paying') {
          if (!cancelled) setChecked(true)
          return
        }

        // Explicit 'expired' status, of trial die verlopen is volgens
        // trial_ends_at (lazy expiry: zie SPEC §8 component 4 keuze A).
        const blocked =
          data?.subscription_status === 'expired' ||
          isTrialExpired({
            subscription_status: data?.subscription_status,
            trial_ends_at:       data?.trial_ends_at,
          })

        if (blocked && !cancelled) {
          router.replace('/pricing-required')
        } else if (!cancelled) {
          setChecked(true)
        }
      } catch {
        if (!cancelled) setChecked(true)  // fail-open: niet blokkeren bij netwerkfout
      }
    }
    check()
    return () => { cancelled = true }
  }, [pathname, router])

  // Korte witte flits tijdens de check is acceptabel; geen spinner zodat
  // de ingelogde-naar-blocked flow snel voelt. Pages renderen pas zodra
  // de check is afgerond.
  if (!checked) return null
  return children
}
