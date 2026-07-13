'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader } from 'lucide-react'
import AuthLayout from '@/components/features/auth/auth-layout'
import { supabase } from '@/lib/supabase'

const SESSION_TIMEOUT_MS = 8000

/**
 * Only allow same-origin app paths or a Shopify Managed Pricing URL as a
 * post-install redirect target — never an arbitrary external URL from the
 * query string (open-redirect guard). Parses the URL and checks the actual
 * host/protocol rather than doing a substring match, which a crafted URL
 * (e.g. `https://evil.com/admin/charges/x`) could otherwise slip past.
 */
function isSafeNext(next: string | null): next is string {
  if (!next) return false
  let url: URL
  try {
    url = new URL(next, window.location.origin)
  } catch {
    return false
  }
  // Our own app (same origin) — any path is fine.
  if (url.origin === window.location.origin) return true
  // Otherwise only a Shopify Managed Pricing URL: https on a *.myshopify.com host, /admin/charges/ path.
  return (
    url.protocol === 'https:' &&
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(url.hostname) &&
    url.pathname.startsWith('/admin/charges/')
  )
}

function PendingState() {
  return (
    <AuthLayout headline="Finishing installation" subhead="Just a moment…" footer={null}>
      <div className="flex items-center justify-center gap-2 py-3 text-sm text-white/60">
        <Loader size={16} className="animate-spin" />
        <span>Finishing installation…</span>
      </div>
    </AuthLayout>
  )
}

function ShopifyComplete() {
  const params = useSearchParams()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Guard against redundant redirects: the listener and the initial session
    // check can each resolve a valid session, but we only want to navigate once.
    let done = false
    const go = () => {
      if (cancelled || done) return
      done = true
      const next = params.get('next')
      window.location.href = isSafeNext(next) ? next : '/home'
    }

    // The Supabase action_link redirected here after establishing the session
    // (detectSessionInUrl parses the URL and persists it to localStorage).
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) go()
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session) go()
    })
    const timeout = setTimeout(() => {
      if (!cancelled && !done) setTimedOut(true)
    }, SESSION_TIMEOUT_MS)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [params])

  if (timedOut) {
    return (
      <AuthLayout headline="Sign-in didn't complete" subhead="Please try installing again." footer={null}>
        <p className="text-center text-sm text-white/60">
          We couldn&apos;t confirm your session in time.
        </p>
      </AuthLayout>
    )
  }

  return <PendingState />
}

export default function ShopifyCompletePage() {
  return (
    <Suspense fallback={<PendingState />}>
      <ShopifyComplete />
    </Suspense>
  )
}
