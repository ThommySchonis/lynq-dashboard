'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

// Signup form per ONBOARDING_SPEC v1.1 §3.2 + §3.3.
// - Verzamelt email, password, first/last name, company name
// - first/last/company → user_metadata.{first_name,last_name,company_name}
//   lib/auth.js Path C gebruikt company_name als workspace name
// - Auto-redirect naar /home na success (email confirmation is non-blocking
//   in Supabase Auth settings); fallback "Check your email" als de signUp
//   response geen session bevat (defensief, mocht de setting ooit
//   gewijzigd worden)

const NAME_MAX  = 50
const COMPANY_MIN = 2
const COMPANY_MAX = 100

export default function SignupPage() {
  const [email,       setEmail]       = useState('')
  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState('')
  const [pending,     setPending]     = useState(null)  // null | 'verify' (fallback state)
  const [loading,     setLoading]     = useState(false)

  function validate() {
    if (!firstName.trim() || firstName.trim().length > NAME_MAX) {
      return 'First name is required (max 50 characters)'
    }
    if (!lastName.trim() || lastName.trim().length > NAME_MAX) {
      return 'Last name is required (max 50 characters)'
    }
    const company = companyName.trim()
    if (company.length < COMPANY_MIN || company.length > COMPANY_MAX) {
      return `Company name must be between ${COMPANY_MIN} and ${COMPANY_MAX} characters`
    }
    if (password !== confirm) return 'Passwords do not match'
    if (password.length < 8)  return 'Password must be at least 8 characters'
    return null
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    const v = validate()
    if (v) { setError(v); return }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email:    email.trim(),
      password,
      options: {
        data: {
          first_name:   firstName.trim(),
          last_name:    lastName.trim(),
          company_name: companyName.trim(),
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Non-blocking verification: Supabase returnt direct een session
    // wanneer email-confirmation uit staat. Redirect naar /home zodat
    // BlockedStateGuard / WelcomeBanner / Setup checklist meteen kunnen
    // werken voor de nieuwe trial workspace.
    if (data?.session) {
      window.location.href = '/home'
      return
    }

    // Defensieve fallback: geen session betekent dat email-confirmation
    // toch ergens vereist is. Toon de "Check your email" UX van vroeger.
    setPending('verify')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#1C0F36',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(161,117,252,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#A175FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: '#fff', margin: '0 auto 12px' }}>L</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Create your Lynq account</div>
        </div>

        <div style={{ background: '#0D1829', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '32px' }}>
          {pending === 'verify' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px', color: '#fff' }}>Check your email</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and finish signup.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignup} autoComplete="on">
              <Field label="Work email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourstore.com" required autoComplete="email" />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="First name">
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jamie" maxLength={NAME_MAX} required autoComplete="given-name" />
                </Field>
                <Field label="Last name">
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Lee" maxLength={NAME_MAX} required autoComplete="family-name" />
                </Field>
              </div>

              <Field label="Company name">
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Apparel" maxLength={COMPANY_MAX} required autoComplete="organization" />
              </Field>

              <Field label="Password">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" required autoComplete="new-password" />
              </Field>

              <Field label="Confirm password" last>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required autoComplete="new-password" />
              </Field>

              {error && (
                <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px', border: 'none',
                background: loading ? 'rgba(161,117,252,0.5)' : '#A175FC',
                color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#A175FC', textDecoration: 'none' }}>Sign in</a>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, last }) {
  return (
    <div style={{ marginBottom: last ? '24px' : '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}
