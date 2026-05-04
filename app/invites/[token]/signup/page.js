'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'
import { Loader, Eye, EyeOff, AlertCircle, Building2, Check } from 'lucide-react'

const ROLE_LABELS = {
  owner:    'Owner',
  admin:    'Admin',
  agent:    'Agent',
  observer: 'Observer',
}

export default function InviteSignupPage() {
  const params = useParams()
  const router = useRouter()
  const token  = params?.token

  const [invite, setInvite]       = useState(null)
  const [status, setStatus]       = useState('loading')   // loading | ready | submitting | done
  const [errorBanner, setErrorBanner] = useState(null)    // { msg, code }

  const [fullName,    setFullName]    = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [fieldError, setFieldError] = useState({})  // { name, password, confirm }

  // ── Validate token + fetch invite metadata on mount ───────────────────
  useEffect(() => {
    if (!token) { router.replace('/invites/missing'); return }

    fetch(`/api/invites/${token}`)
      .then(async r => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (!ok || body.error) {
          // Punt to the invite landing page which has proper error rendering
          router.replace(`/invites/${token}`)
          return
        }
        setInvite(body)
        setStatus('ready')
      })
      .catch(() => router.replace(`/invites/${token}`))
  }, [token, router])

  function validateFields() {
    const errors = {}
    if (!fullName.trim()) errors.name = 'Please enter your name.'
    if (password.length < 8) errors.password = 'At least 8 characters.'
    if (password !== confirm) errors.confirm = 'Passwords do not match.'
    setFieldError(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorBanner(null)
    if (!validateFields()) return

    setStatus('submitting')

    const res = await fetch(`/api/invites/${token}/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ full_name: fullName.trim(), password }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.ok) {
      setStatus('ready')
      if (data.code === 'email_exists') {
        setErrorBanner({ code: 'email_exists', msg: data.error })
      } else if (data.code === 'expired' || data.code === 'not_found' || data.code === 'already_accepted') {
        // Punt back to landing page
        router.replace(`/invites/${token}`)
      } else if (data.code === 'weak_password') {
        setFieldError(prev => ({ ...prev, password: data.error || 'Password too weak.' }))
      } else if (data.code === 'name_required') {
        setFieldError(prev => ({ ...prev, name: data.error || 'Name is required.' }))
      } else {
        setErrorBanner({ msg: data.error || 'Could not create your account. Please try again.' })
      }
      return
    }

    // Server created the user + accepted the invite. Sign in client-side
    // using the password we just used so the Supabase JS client picks up
    // the session into localStorage, then redirect.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    invite.invite_email,
      password,
    })

    if (signInError) {
      setStatus('ready')
      setErrorBanner({
        msg: 'Account created but auto sign-in failed. Please go to login and sign in with your new password.',
      })
      return
    }

    setStatus('done')
    setTimeout(() => router.push('/'), 800)
  }

  // ── layout wrapper ──
  const wrap = (content) => (
    <div style={{
      minHeight: '100vh', background: '#F8F7FA',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: "'Switzer', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#1C0F36', padding: '8px 16px', borderRadius: 8,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
              Lynq &amp; Flow
            </span>
          </div>
        </div>
        {content}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (status === 'loading' || !invite) {
    return wrap(
      <div style={card}>
        <Loader size={28} strokeWidth={1.75} color="#9B91A8" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#9B91A8', textAlign: 'center' }}>Loading invite…</p>
      </div>
    )
  }

  if (status === 'done') {
    return wrap(
      <div style={card}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: 'rgba(16,185,129,0.1)',
          margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={24} strokeWidth={2} color="#10B981" />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: '#1C0F36', textAlign: 'center' }}>
          Welcome to {invite.workspace_name}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6B5E7B', lineHeight: 1.6, textAlign: 'center' }}>
          Signing you in…
        </p>
      </div>
    )
  }

  return wrap(
    <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #A175FC, #6366F1)' }} />

      <div style={{ padding: '36px 32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, background: '#EDE5FE',
            margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={24} strokeWidth={1.5} color="#A175FC" />
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 600, color: '#1C0F36' }}>
            Join {invite.workspace_name}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6B5E7B' }}>
            Create your account to accept the invite as {ROLE_LABELS[invite.role] || invite.role}
          </p>
        </div>

        {errorBanner && (
          <div style={{
            display: 'flex', gap: 10, padding: '12px 14px', background: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 8, marginBottom: 18,
            fontSize: 13, color: '#B91C1C', alignItems: 'flex-start',
          }}>
            <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              {errorBanner.msg}
              {errorBanner.code === 'email_exists' && (
                <>
                  {' '}
                  <Link href="/login" style={{ color: '#7C3AED', fontWeight: 500 }}>Go to login →</Link>
                </>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email — locked */}
          <div style={field}>
            <label style={label}>Email</label>
            <input
              type="email"
              value={invite.invite_email}
              readOnly
              disabled
              style={{ ...input, background: '#F8F7FA', color: '#6B5E7B', cursor: 'not-allowed' }}
            />
            <p style={hint}>Locked to your invite address</p>
          </div>

          {/* Full name */}
          <div style={field}>
            <label style={label} htmlFor="signup-name">Your name</label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              placeholder="Jane Smith"
              value={fullName}
              onChange={e => { setFullName(e.target.value); if (fieldError.name) setFieldError(prev => ({ ...prev, name: undefined })) }}
              required
              maxLength={100}
              style={{ ...input, ...(fieldError.name ? inputError : {}) }}
              autoFocus
            />
            {fieldError.name && <p style={fieldErrorStyle}>{fieldError.name}</p>}
          </div>

          {/* Password */}
          <div style={field}>
            <label style={label} htmlFor="signup-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => { setPassword(e.target.value); if (fieldError.password) setFieldError(prev => ({ ...prev, password: undefined })) }}
                required
                minLength={8}
                style={{ ...input, paddingRight: 40, ...(fieldError.password ? inputError : {}) }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={revealBtn}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
            {fieldError.password && <p style={fieldErrorStyle}>{fieldError.password}</p>}
          </div>

          {/* Confirm */}
          <div style={field}>
            <label style={label} htmlFor="signup-confirm">Confirm password</label>
            <input
              id="signup-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); if (fieldError.confirm) setFieldError(prev => ({ ...prev, confirm: undefined })) }}
              required
              style={{ ...input, ...(fieldError.confirm ? inputError : {}) }}
            />
            {fieldError.confirm && <p style={fieldErrorStyle}>{fieldError.confirm}</p>}
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            style={{
              ...btnPrimary,
              width: '100%',
              opacity: status === 'submitting' ? 0.7 : 1,
              cursor: status === 'submitting' ? 'default' : 'pointer',
            }}
          >
            {status === 'submitting' ? (
              <>
                <Loader size={15} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                Creating account…
              </>
            ) : (
              <>Create account &amp; join {invite.workspace_name}</>
            )}
          </button>

          <p style={{ marginTop: 16, fontSize: 12, color: '#9B91A8', textAlign: 'center' }}>
            Already have an account?{' '}
            <Link href={`/login?redirect=/invites/${token}`} style={{ color: '#7C3AED', fontWeight: 500 }}>
              Sign in instead
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

// ── inline styles ─────────────────────────────────────────────
const card = {
  background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12,
  padding: '48px 32px', textAlign: 'center',
}
const field = { marginBottom: 14 }
const label = {
  display: 'block', fontSize: 13, fontWeight: 500, color: '#1C0F36', marginBottom: 6,
}
const input = {
  width: '100%', padding: '10px 12px', border: '1px solid #E5E0EB', borderRadius: 8,
  fontSize: 14, fontFamily: "'Switzer', -apple-system, sans-serif",
  color: '#1C0F36', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}
const inputError = { borderColor: '#FCA5A5', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' }
const hint = { margin: '4px 0 0', fontSize: 11, color: '#9B91A8' }
const fieldErrorStyle = { margin: '5px 0 0', fontSize: 12, color: '#DC2626' }
const revealBtn = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
  width: 30, height: 30, padding: 0, border: 'none', background: 'transparent',
  color: '#9B91A8', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', borderRadius: 6,
}
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 44, padding: '0 16px', borderRadius: 8, border: 'none',
  background: '#A175FC', color: '#fff', fontSize: 14, fontWeight: 500,
  fontFamily: "'Switzer', -apple-system, sans-serif", marginTop: 4,
}
