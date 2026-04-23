'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e) {
    e.preventDefault()
    setError('')

    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#08101F',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(48,136,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#3088FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: '#fff', margin: '0 auto 12px' }}>L</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Create your Lynq account</div>
        </div>

        <div style={{ background: '#0D1829', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '32px' }}>
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Check your email</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignup}>
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourstore.com" required autoComplete="email" />
              </Field>
              <Field label="Password">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
              </Field>
              <Field label="Confirm Password" last>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
              </Field>

              {error && (
                <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px',
                background: loading ? 'rgba(48,136,255,0.5)' : '#3088FF',
                color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#3088FF', textDecoration: 'none' }}>Sign in</a>
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
