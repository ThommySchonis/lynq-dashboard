'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader } from 'lucide-react'
import AuthLayout from '@/components/features/auth/auth-layout'
import { supabase } from '@/lib/supabase'
import { getOnboardingStatus } from '@/lib/onboarding-status'

export default function ConfirmEmailPage() {
  const router = useRouter()
  // 'verifying' = checking the link; 'error' = expired/invalid link
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')

  useEffect(() => {
    let cancelled = false
    // Guard against redundant redirects: the listener and the session checks
    // can each resolve a valid session, but we only want to navigate once.
    let redirected = false
    const goTo = (path: string) => {
      if (cancelled || redirected) return
      redirected = true
      router.replace(path)
    }
    const settle = () => {
      void getOnboardingStatus().then((complete) => {
        goTo(complete ? '/home' : '/onboarding')
      })
    }

    // Expired/used links come back with error params in the URL hash fragment
    // (e.g. #error=access_denied&error_code=otp_expired). Detect that first.
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (hash.includes('error=')) {
      setStatus('error')
      return
    }

    // Supabase parses the hash from the confirmation link and establishes a
    // session. Listen for SIGNED_IN, plus do an initial + delayed session check.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_IN' && session) {
        settle()
      }
    })

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        settle()
        return
      }
      // Hash-parsing can be async; give the listener a brief window, then decide.
      setTimeout(() => {
        if (cancelled) return
        void supabase.auth.getSession().then(({ data: { session: s2 } }) => {
          if (cancelled) return
          if (s2) {
            settle()
          } else {
            // No session, no explicit error: ambiguous (e.g. direct navigation
            // to /auth/confirm without a valid link). Fall back to login.
            goTo('/login')
          }
        })
      }, 800)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [router])

  // ── Expired / invalid link ─────────────────────────────────────
  if (status === 'error') {
    return (
      <AuthLayout
        headline="Link expired"
        subhead="This confirmation link is invalid or has expired. Sign up again to get a new one."
        footer={
          <>
            Already verified?{' '}
            <Link href="/login" className="text-primary hover:text-[#C4B0FF] transition-colors">
              Sign in
            </Link>
          </>
        }
      >
        <div className="text-center">
          <Link
            href="/onboarding"
            className="flex items-center justify-center w-full h-14 rounded-xl text-[15px] font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
              boxShadow: '0 8px 28px rgba(127, 119, 221, 0.35)',
            }}
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Verifying ──────────────────────────────────────────────────
  return (
    <AuthLayout headline="Confirming your email" subhead="Just a moment…" footer={null}>
      <div className="flex items-center justify-center gap-2 py-3 text-sm text-white/60">
        <Loader size={16} className="animate-spin" />
        <span>Verifying…</span>
      </div>
    </AuthLayout>
  )
}
