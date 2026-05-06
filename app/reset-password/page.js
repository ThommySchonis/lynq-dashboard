'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import AuthShell, { PasswordField } from '../components/AuthShell'

const PASSWORD_MIN = 8

export default function ResetPasswordPage() {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw1,   setShowPw1]   = useState(false)
  const [showPw2,   setShowPw2]   = useState(false)
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)

  // null = checking, true = recovery session aanwezig, false = invalid/expired
  const [sessionValid, setSessionValid] = useState(null)

  useEffect(() => {
    let cancelled = false

    // Supabase parsed het hash-fragment van de email recovery link
    // automatisch en stelt een session in. Listen op auth state changes
    // zodat we het PASSWORD_RECOVERY event opvangen, plus initial check.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionValid(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      // Geef de auth state listener een korte tijd om te triggeren
      // (hash-parsing kan async zijn). Daarna definitief beslissen.
      if (session) {
        setSessionValid(true)
      } else {
        setTimeout(() => {
          if (cancelled) return
          // Re-check na 500ms — hash-parsing zou nu klaar moeten zijn
          supabase.auth.getSession().then(({ data: { session: s2 } }) => {
            if (!cancelled) setSessionValid(!!s2)
          })
        }, 500)
      }
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  // Auto-redirect na success
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => { window.location.href = '/login' }, 1500)
    return () => clearTimeout(t)
  }, [success])

  function validate() {
    if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`
    if (password !== confirm)           return 'Passwords do not match'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const v = validate()
    if (v) { setError(v); return }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message || 'Could not update password.')
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  // ─── Loading: session check in flight ─────────────────────
  if (sessionValid === null) {
    return (
      <AuthShell
        headline="Set a new password"
        subhead="Verifying your reset link…"
        footer={null}
      >
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
          Loading…
        </div>
      </AuthShell>
    )
  }

  // ─── Invalid / expired link ───────────────────────────────
  if (!sessionValid) {
    return (
      <AuthShell
        headline="Link expired"
        subhead="This reset link is invalid or has expired. Request a new one to try again."
        footer={
          <>
            Remember your password?{' '}
            <Link href="/login" className="as-link">Sign in</Link>
          </>
        }
      >
        <div style={{ textAlign: 'center' }}>
          <Link
            href="/forgot-password"
            style={{
              display:        'inline-block',
              width:          '100%',
              height:         56,
              lineHeight:     '56px',
              background:     'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
              color:          '#FFFFFF',
              borderRadius:   12,
              fontSize:       15,
              fontWeight:     500,
              textDecoration: 'none',
              boxShadow:      '0 8px 28px rgba(127, 119, 221, 0.35)',
              fontFamily:     'inherit',
            }}
          >
            Request a new link
          </Link>
        </div>
      </AuthShell>
    )
  }

  // ─── Success: password updated, auto-redirect ─────────────
  if (success) {
    return (
      <AuthShell
        headline="Password updated"
        subhead="Redirecting you to sign in…"
        footer={null}
      >
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <Link href="/login" className="as-link" style={{ fontSize: 14 }}>
            Continue to sign in →
          </Link>
        </div>
      </AuthShell>
    )
  }

  // ─── Form state ───────────────────────────────────────────
  return (
    <AuthShell
      headline="Set a new password"
      subhead="Choose a strong password to secure your account."
      footer={
        <>
          Remember your password?{' '}
          <Link href="/login" className="as-link">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} autoComplete="on" noValidate>
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          show={showPw1}
          onToggleShow={() => setShowPw1(s => !s)}
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
        />

        <div style={{ marginTop: 12 }}>
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            show={showPw2}
            onToggleShow={() => setShowPw2(s => !s)}
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop:    16,
              padding:      '10px 14px',
              background:   'rgba(248,113,113,0.10)',
              border:       '1px solid rgba(248,113,113,0.30)',
              borderRadius: 10,
              color:        '#FCA5A5',
              fontSize:     13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              width:        '100%',
              height:       56,
              background:   'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
              color:        '#FFFFFF',
              border:       'none',
              borderRadius: 12,
              fontSize:     15,
              fontWeight:   500,
              fontFamily:   'inherit',
              cursor:       loading ? 'wait' : 'pointer',
              boxShadow:    '0 8px 28px rgba(127, 119, 221, 0.35)',
              transition:   'transform 200ms ease, box-shadow 200ms ease, opacity 200ms ease',
              opacity:      loading ? 0.65 : 1,
            }}
            onMouseEnter={e => {
              if (loading) return
              e.currentTarget.style.transform = 'scale(1.01)'
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(127, 119, 221, 0.50)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(127, 119, 221, 0.35)'
            }}
          >
            {loading ? 'Updating…' : 'Update password →'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}
