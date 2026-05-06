'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import AuthShell, { FloatField } from '../components/AuthShell'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmed = email.trim()
    if (!trimmed) return

    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      setError(resetError.message || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  // ─── Success state ────────────────────────────────────────
  if (sent) {
    return (
      <AuthShell
        headline="Check your email"
        subhead={
          <>
            We sent a reset link to{' '}
            <span style={{ color: '#FFFFFF', fontWeight: 500 }}>{email.trim()}</span>.{' '}
            Click it to choose a new password.
          </>
        }
        footer={
          <>
            Remember your password?{' '}
            <Link href="/login" className="as-link">Sign in</Link>
          </>
        }
      >
        {/* Empty card body — no form, only the divider/headline/subhead above */}
        <div style={{ textAlign: 'center', padding: '8px 4px' }}>
          <button
            type="button"
            onClick={() => { setSent(false); setError('') }}
            style={{
              background:     'transparent',
              border:         'none',
              color:          '#C4B0FF',
              fontSize:       14,
              fontWeight:     500,
              cursor:         'pointer',
              fontFamily:     'inherit',
              textDecoration: 'underline',
              padding:        0,
            }}
          >
            Didn&apos;t get it? Try again
          </button>
        </div>
      </AuthShell>
    )
  }

  // ─── Form state ───────────────────────────────────────────
  return (
    <AuthShell
      headline="Forgot your password?"
      subhead="Enter your email and we'll send you a reset link."
      footer={
        <>
          Remember your password?{' '}
          <Link href="/login" className="as-link">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} autoComplete="on" noValidate>
        <FloatField
          id="email" label="Email" type="email"
          value={email} onChange={setEmail}
          required autoComplete="email"
        />

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
            {loading ? 'Sending…' : 'Send reset link →'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}
