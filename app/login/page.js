'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password')
      setLoading(false)
      return
    }

    window.location.href = '/inbox'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#08101F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '400px',
        background: 'radial-gradient(ellipse, rgba(48,136,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img
            src="/logo.png"
            alt="Lynq"
            style={{ height: '32px', filter: 'brightness(0) invert(1)', marginBottom: '12px' }}
          />
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.02em' }}>
            Sign in to your dashboard
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#0D1829',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px',
          padding: '32px',
        }}>
          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourstore.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#f87171',
                fontSize: '13px',
                marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? 'rgba(48,136,255,0.5)' : '#3088FF',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.25)',
        }}>
          Lynq & Flow — Customer Support Platform
        </div>
      </div>
    </div>
  )
}
