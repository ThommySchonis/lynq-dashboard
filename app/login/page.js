'use client'

import { useState } from 'react'
import { Instrument_Serif, DM_Sans } from 'next/font/google'
import { supabase } from '../../lib/supabase'

// Display + body fonts via next/font (matched met /signup voor
// consistente brand voice).
const display = Instrument_Serif({
  subsets:  ['latin'],
  weight:   '400',
  style:    ['normal', 'italic'],
  display:  'swap',
  fallback: ['Cormorant Garamond', 'Georgia', 'Cambria', 'serif'],
})
const body = DM_Sans({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  display:  'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

// SVG noise texture as data-URL — matched met /signup
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`
const NOISE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(NOISE_SVG)}")`

const CSS = `
  /* ─── Orbs (identiek aan /signup) ─── */
  @keyframes orbDriftA {
    0%,100% { transform: translate(0, 0)        scale(1);    }
    50%     { transform: translate(240px, 180px) scale(1.12); }
  }
  @keyframes orbDriftB {
    0%,100% { transform: translate(0, 0)         scale(1);    }
    50%     { transform: translate(-280px, 140px) scale(1.08); }
  }
  @keyframes orbDriftC {
    0%,100% { transform: translate(0, 0)         scale(1);    }
    50%     { transform: translate(-200px, -220px) scale(1.10); }
  }

  /* ─── Page-load stagger ─── */
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  .login-fade { opacity: 0; animation: fadeInUp 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .login-d-0 { animation-delay:    0ms; }
  .login-d-2 { animation-delay:  160ms; }
  .login-d-3 { animation-delay:  240ms; }
  .login-d-4 { animation-delay:  320ms; }
  .login-d-5 { animation-delay:  400ms; }
  .login-d-6 { animation-delay:  480ms; }
  .login-d-7 { animation-delay:  560ms; }
  .login-d-8 { animation-delay:  640ms; }

  /* ─── Headline word-by-word reveal ─── */
  @keyframes wordReveal {
    from {
      opacity: 0;
      transform: translateY(20px);
      filter: blur(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }
  .word-reveal {
    display: inline-block;
    opacity: 0;
    animation: wordReveal 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    will-change: opacity, transform, filter;
  }

  /* ─── Inputs (identiek aan /signup) ─── */
  .field-wrap   { position: relative; }
  .field-input  {
    width: 100%;
    height: 54px;
    box-sizing: border-box;
    padding: 22px 16px 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.95);
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: border-color 200ms ease, box-shadow 200ms ease, background-color 200ms ease;
  }
  .field-input::placeholder { color: rgba(255, 255, 255, 0.4); }
  .field-input:hover { background: rgba(255, 255, 255, 0.075); }
  .field-input:focus {
    border-color: #7F77DD;
    box-shadow:
      0 0 0 4px rgba(127, 119, 221, 0.15),
      0 0 20px rgba(127, 119, 221, 0.20);
    background: rgba(255, 255, 255, 0.10);
  }
  .field-input:focus + .field-label,
  .field-input:not(:placeholder-shown) + .field-label {
    top: 8px;
    font-size: 11px;
    letter-spacing: 0.05em;
    color: rgba(255,255,255,0.6);
  }
  .field-input:focus + .field-label { color: #C4B0FF; }
  .field-label {
    position: absolute;
    left: 16px;
    top: 16px;
    font-size: 14px;
    color: rgba(255,255,255,0.4);
    pointer-events: none;
    transition: top 180ms ease, font-size 180ms ease, color 180ms ease, letter-spacing 180ms ease;
  }

  /* Password toggle */
  .pw-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    transition: color 150ms ease, background 150ms ease;
  }
  .pw-toggle:hover { color: #FFFFFF; background: rgba(255,255,255,0.06); }
  .pw-toggle:focus-visible { outline: 2px solid #7F77DD; outline-offset: 2px; }

  /* CTA button (identiek aan /signup) */
  .cta-btn {
    width: 100%;
    height: 56px;
    background: linear-gradient(135deg, #7F77DD 0%, #6366F1 100%);
    color: #FFFFFF;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 8px 28px rgba(127, 119, 221, 0.35);
    transition: transform 200ms ease, box-shadow 200ms ease, opacity 200ms ease;
  }
  .cta-btn:hover:not(:disabled) {
    transform: scale(1.01);
    box-shadow: 0 12px 36px rgba(127, 119, 221, 0.50);
  }
  .cta-btn:active:not(:disabled) { transform: scale(0.99); }
  .cta-btn:disabled { opacity: 0.65; cursor: wait; }
  .cta-btn:focus-visible { outline: 2px solid #C4B0FF; outline-offset: 3px; }

  /* Inline links */
  .login-link {
    color: #C4B0FF;
    text-decoration: none;
    transition: color 150ms ease;
  }
  .login-link:hover { text-decoration: underline; }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .login-headline { font-size: clamp(38px, 10vw, 52px) !important; }
    .login-card     { padding: 32px 24px !important; }
    .login-wordmark { margin-bottom: 16px !important; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .login-orb { animation: none !important; }
    .login-fade,
    .word-reveal {
      opacity: 1 !important;
      animation: none !important;
      transform: none !important;
      filter: none !important;
    }
  }
`

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    })

    if (signInError) {
      setError('Incorrect email or password')
      setLoading(false)
      return
    }

    // BlockedStateGuard handelt expired-trial redirect af op /inbox.
    window.location.href = '/inbox'
  }

  return (
    <div
      className={body.className}
      style={{
        position:       'relative',
        minHeight:      '100vh',
        background:     '#0A0612',
        color:          '#FFFFFF',
        overflow:       'hidden',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '40px 24px',
      }}
    >
      <style>{CSS}</style>

      {/* ─── Orbs (identiek aan /signup) ─── */}
      <Orb
        style={{
          top:        '-12%',
          left:       '-10%',
          width:      800,
          height:     800,
          background: 'radial-gradient(circle, rgba(127, 119, 221, 0.75) 0%, rgba(127, 119, 221, 0.15) 45%, transparent 75%)',
          filter:     'blur(80px)',
          animation:  'orbDriftA 60s ease-in-out infinite',
        }}
      />
      <Orb
        style={{
          top:        '-8%',
          right:      '-12%',
          width:      720,
          height:     720,
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.70) 0%, rgba(99, 102, 241, 0.12) 45%, transparent 75%)',
          filter:     'blur(75px)',
          animation:  'orbDriftB 70s ease-in-out infinite',
        }}
      />
      <Orb
        style={{
          bottom:     '-25%',
          left:       '20%',
          width:      760,
          height:     760,
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.55) 0%, rgba(6, 182, 212, 0.10) 45%, transparent 75%)',
          filter:     'blur(85px)',
          animation:  'orbDriftC 80s ease-in-out infinite',
        }}
      />

      {/* ─── Noise overlay ─── */}
      <div
        aria-hidden="true"
        style={{
          position:        'absolute',
          inset:           0,
          backgroundImage: NOISE_URL,
          opacity:         0.06,
          mixBlendMode:    'overlay',
          pointerEvents:   'none',
          zIndex:          1,
        }}
      />

      {/* ─── Content stack ─── */}
      <div
        style={{
          position:  'relative',
          zIndex:    2,
          width:     '100%',
          maxWidth:  440,
          textAlign: 'center',
        }}
      >
        {/* Wordmark */}
        <div
          className="login-wordmark login-fade login-d-0"
          style={{
            fontSize:      11,
            fontWeight:    600,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color:         'rgba(255,255,255,0.55)',
            marginBottom:  20,
          }}
        >
          Lynq &amp; Flow
        </div>

        {/* Headline — 2 woorden, sneller dan signup */}
        <h1
          className={`login-headline ${display.className}`}
          style={{
            fontSize:      'clamp(44px, 5.4vw, 64px)',
            fontWeight:    400,
            lineHeight:    1.05,
            letterSpacing: '-0.02em',
            margin:        0,
          }}
        >
          <span className="word-reveal" style={{ animationDelay: '0ms' }}>Welcome</span>{' '}
          <span className="word-reveal" style={{ animationDelay: '100ms' }}>back</span>
        </h1>

        {/* Gradient divider */}
        <div
          className="login-fade login-d-2"
          aria-hidden="true"
          style={{
            width:      140,
            height:     1,
            margin:     '20px auto 16px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(127,119,221,0.45) 50%, transparent 100%)',
          }}
        />

        {/* Subhead */}
        <p
          className="login-fade login-d-3"
          style={{
            fontSize:     15,
            color:        'rgba(255,255,255,0.6)',
            marginBottom: 28,
            marginTop:    0,
          }}
        >
          Sign in to your Lynq &amp; Flow workspace.
        </p>

        {/* Glass card */}
        <div
          className="login-card login-fade login-d-4"
          style={{
            background:           'linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
            backdropFilter:       'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border:               '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius:         24,
            padding:              '40px 36px',
            boxShadow: [
              '0 0 100px rgba(127, 119, 221, 0.25)',
              '0 0 60px rgba(99, 102, 241, 0.15)',
              '0 8px 32px rgba(0, 0, 0, 0.45)',
              'inset 0 1px 0 rgba(255, 255, 255, 0.10)',
            ].join(', '),
            textAlign:            'left',
          }}
        >
          <form onSubmit={handleLogin} autoComplete="on" noValidate>
            <FloatField
              className="login-fade login-d-5"
              id="email" label="Email" type="email"
              value={email} onChange={setEmail}
              required autoComplete="email"
            />

            <div className="login-fade login-d-6" style={{ marginTop: 12 }}>
              <PasswordField
                value={password} onChange={setPassword}
                show={showPw} onToggleShow={() => setShowPw(s => !s)}
              />
              <div style={{ marginTop: 8, textAlign: 'right' }}>
                <a href="/forgot-password" className="login-link" style={{ fontSize: 13 }}>
                  Forgot password?
                </a>
              </div>
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

            <div className="login-fade login-d-7" style={{ marginTop: 24 }}>
              <button type="submit" className="cta-btn" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p
          className="login-fade login-d-8"
          style={{
            marginTop: 20,
            fontSize:  14,
            color:     'rgba(255,255,255,0.55)',
          }}
        >
          New here?{' '}
          <a href="/signup" className="login-link">Start your free trial</a>
        </p>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Orb({ style }) {
  return (
    <div
      aria-hidden="true"
      className="login-orb"
      style={{
        position:      'absolute',
        borderRadius:  '50%',
        pointerEvents: 'none',
        zIndex:        0,
        ...style,
      }}
    />
  )
}

function FloatField({ id, label, type = 'text', value, onChange, className, ...rest }) {
  return (
    <div className={`field-wrap ${className || ''}`}>
      <input
        id={id}
        name={id}
        type={type}
        className="field-input"
        placeholder=" "
        value={value}
        onChange={e => onChange(e.target.value)}
        {...rest}
      />
      <label htmlFor={id} className="field-label">{label}</label>
    </div>
  )
}

function PasswordField({ value, onChange, show, onToggleShow }) {
  return (
    <div className="field-wrap">
      <input
        id="password"
        name="password"
        type={show ? 'text' : 'password'}
        className="field-input"
        style={{ paddingRight: 48 }}
        placeholder=" "
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        autoComplete="current-password"
      />
      <label htmlFor="password" className="field-label">Password</label>
      <button
        type="button"
        className="pw-toggle"
        onClick={onToggleShow}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  )
}

// ─── Inline icons ──────────────────────────────────────────────────────────

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
