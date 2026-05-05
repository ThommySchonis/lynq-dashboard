'use client'

import { useState } from 'react'
import { Instrument_Serif, DM_Sans } from 'next/font/google'
import { supabase } from '../../lib/supabase'

// Display + body fonts — scoped to deze pagina via next/font.
// Instrument Serif heeft alleen weight 400 + italic; DM Sans 400/500/600.
const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], display: 'swap' })
const body    = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' })

// SVG noise texture als data-URL — depth-overlay zonder externe asset
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`
const NOISE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(NOISE_SVG)}")`

const NAME_MAX     = 50
const COMPANY_MIN  = 2
const COMPANY_MAX  = 100
const PASSWORD_MIN = 8

// Heuristische password strength score 0-4. Length-tier + class diversity.
function passwordStrength(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= PASSWORD_MIN) score++
  if (pw.length >= 12)           score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw))          score++
  if (/[^a-zA-Z0-9]/.test(pw))   score++
  return Math.min(score, 4)
}

const STRENGTH_META = [
  { label: '',         color: 'rgba(255,255,255,0.10)' },
  { label: 'Weak',     color: '#EF4444' },
  { label: 'Fair',     color: '#F59E0B' },
  { label: 'Good',     color: '#FBBF24' },
  { label: 'Strong',   color: '#22C55E' },
]

const CSS = `
  /* ─── Background orbs (langzaam ademend) ─── */
  @keyframes orbDriftA {
    0%,100% { transform: translate(0,0)        scale(1);    }
    33%     { transform: translate(80px,-40px) scale(1.08); }
    66%     { transform: translate(-50px,60px) scale(0.95); }
  }
  @keyframes orbDriftB {
    0%,100% { transform: translate(0,0)        scale(1);    }
    50%     { transform: translate(-90px,80px) scale(1.12); }
  }
  @keyframes orbDriftC {
    0%,100% { transform: translate(0,0)        scale(1);    }
    50%     { transform: translate(60px,-70px) scale(0.92); }
  }
  @keyframes orbDriftD {
    0%,100% { transform: translate(0,0)        scale(1);    }
    50%     { transform: translate(-40px,-50px) scale(1.06); }
  }

  /* ─── Page-load stagger ─── */
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  .signup-fade { opacity: 0; animation: fadeInUp 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .signup-d-0 { animation-delay:    0ms; }
  .signup-d-1 { animation-delay:   80ms; }
  .signup-d-2 { animation-delay:  160ms; }
  .signup-d-3 { animation-delay:  240ms; }
  .signup-d-4 { animation-delay:  320ms; }
  .signup-d-5 { animation-delay:  400ms; }
  .signup-d-6 { animation-delay:  480ms; }
  .signup-d-7 { animation-delay:  560ms; }
  .signup-d-8 { animation-delay:  640ms; }
  .signup-d-9 { animation-delay:  720ms; }

  /* ─── Floating labels via :placeholder-shown trick ─── */
  .field-wrap   { position: relative; }
  .field-input  {
    width: 100%;
    height: 52px;
    box-sizing: border-box;
    padding: 22px 16px 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    color: #FFFFFF;
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: border-color 200ms ease, box-shadow 200ms ease, background-color 200ms ease;
  }
  .field-input::placeholder { color: transparent; }
  .field-input:hover { background: rgba(255,255,255,0.05); }
  .field-input:focus {
    border-color: #7F77DD;
    box-shadow: 0 0 0 4px rgba(127, 119, 221, 0.14);
    background: rgba(255,255,255,0.06);
  }
  .field-input:focus + .field-label,
  .field-input:not(:placeholder-shown) + .field-label {
    top: 8px;
    font-size: 11px;
    letter-spacing: 0.05em;
    color: rgba(255,255,255,0.55);
  }
  .field-input:focus + .field-label { color: #C4B0FF; }
  .field-label {
    position: absolute;
    left: 16px;
    top: 16px;
    font-size: 14px;
    color: rgba(255,255,255,0.35);
    pointer-events: none;
    transition: top 180ms ease, font-size 180ms ease, color 180ms ease, letter-spacing 180ms ease;
    text-transform: none;
  }

  /* Password show/hide button */
  .pw-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.45);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    transition: color 150ms ease, background 150ms ease;
  }
  .pw-toggle:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.05); }
  .pw-toggle:focus-visible { outline: 2px solid #7F77DD; outline-offset: 2px; }

  /* CTA button */
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
    box-shadow: 0 8px 24px rgba(127, 119, 221, 0.25);
    transition: transform 200ms ease, box-shadow 200ms ease, opacity 200ms ease;
  }
  .cta-btn:hover:not(:disabled) {
    transform: scale(1.01);
    box-shadow: 0 10px 32px rgba(127, 119, 221, 0.40);
  }
  .cta-btn:active:not(:disabled) { transform: scale(0.99); }
  .cta-btn:disabled { opacity: 0.65; cursor: wait; }
  .cta-btn:focus-visible { outline: 2px solid #C4B0FF; outline-offset: 3px; }

  /* Sign-in link */
  .signin-link {
    color: #C4B0FF;
    text-decoration: none;
    transition: color 150ms ease;
  }
  .signin-link:hover { text-decoration: underline; }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .signup-headline   { font-size: clamp(36px, 9vw, 48px) !important; }
    .signup-card       { padding: 32px 24px !important; }
    .signup-name-row   { grid-template-columns: 1fr !important; }
  }

  /* Reduced motion: disable orbs + page-load fade */
  @media (prefers-reduced-motion: reduce) {
    .signup-orb { animation: none !important; }
    .signup-fade {
      opacity: 1 !important;
      animation: none !important;
      transform: none !important;
    }
  }
`

export default function SignupPage() {
  const [email,       setEmail]       = useState('')
  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password,    setPassword]    = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [error,       setError]       = useState('')
  const [pending,     setPending]     = useState(null)  // null | 'verify'
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
    if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`
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

    // Non-blocking flow: direct redirect zodra Supabase een session
    // teruggeeft. Als email-confirmation blocking is (geen session in
    // response), valt 'verify' UX in.
    if (data?.session) {
      window.location.href = '/home'
      return
    }
    setPending('verify')
    setLoading(false)
  }

  const pwScore = passwordStrength(password)
  const pwMeta  = STRENGTH_META[pwScore]

  return (
    <div
      className={body.className}
      style={{
        position:   'relative',
        minHeight:  '100vh',
        background: '#0A0612',
        color:      '#FFFFFF',
        overflow:   'hidden',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:    '48px 24px',
      }}
    >
      <style>{CSS}</style>

      {/* ─── Animated gradient orbs ─── */}
      <Orb
        cls="signup-orb"
        style={{
          top:        '-15%',
          left:       '-10%',
          width:      720,
          height:     720,
          background: 'radial-gradient(circle, rgba(127, 119, 221, 0.50) 0%, transparent 70%)',
          filter:     'blur(120px)',
          animation:  'orbDriftA 75s ease-in-out infinite',
        }}
      />
      <Orb
        cls="signup-orb"
        style={{
          top:        '20%',
          right:      '-15%',
          width:      640,
          height:     640,
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.42) 0%, transparent 70%)',
          filter:     'blur(110px)',
          animation:  'orbDriftB 90s ease-in-out infinite',
        }}
      />
      <Orb
        cls="signup-orb"
        style={{
          bottom:     '-20%',
          left:       '20%',
          width:      560,
          height:     560,
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.32) 0%, transparent 70%)',
          filter:     'blur(100px)',
          animation:  'orbDriftC 80s ease-in-out infinite',
        }}
      />
      <Orb
        cls="signup-orb"
        style={{
          top:        '50%',
          left:       '40%',
          width:      400,
          height:     400,
          background: 'radial-gradient(circle, rgba(127, 119, 221, 0.25) 0%, transparent 70%)',
          filter:     'blur(80px)',
          animation:  'orbDriftD 65s ease-in-out infinite',
        }}
      />

      {/* ─── Noise texture overlay ─── */}
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

      {/* ─── Main content ─── */}
      <div
        style={{
          position: 'relative',
          zIndex:   2,
          width:    '100%',
          maxWidth: 480,
          textAlign: 'center',
        }}
      >
        {pending === 'verify' ? (
          <VerifyPanel email={email} />
        ) : (
          <>
            <h1
              className={`signup-headline signup-fade signup-d-0 ${display.className}`}
              style={{
                fontSize:      'clamp(48px, 5vw, 72px)',
                fontWeight:    400,
                lineHeight:    1.05,
                letterSpacing: '-0.025em',
                marginBottom:  16,
              }}
            >
              Start your 7-day<br />free trial
            </h1>

            <p
              className="signup-fade signup-d-1"
              style={{
                fontSize:    16,
                color:       'rgba(255,255,255,0.55)',
                marginBottom: 36,
              }}
            >
              No credit card required. Set up in 5 minutes.
            </p>

            {/* Glassmorphism card */}
            <div
              className="signup-card signup-fade signup-d-2"
              style={{
                background:        'rgba(255, 255, 255, 0.035)',
                backdropFilter:    'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border:            '1px solid rgba(255, 255, 255, 0.10)',
                borderRadius:      24,
                padding:           '48px 40px',
                boxShadow:         '0 0 80px rgba(127, 119, 221, 0.15), 0 8px 32px rgba(0,0,0,0.35)',
                textAlign:         'left',
              }}
            >
              <form onSubmit={handleSignup} autoComplete="on" noValidate>
                <FloatField
                  className="signup-fade signup-d-3"
                  id="email" label="Email" type="email" value={email} onChange={setEmail}
                  required autoComplete="email"
                />

                <div
                  className="signup-name-row"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}
                >
                  <FloatField
                    className="signup-fade signup-d-4"
                    id="first_name" label="First name" value={firstName} onChange={setFirstName}
                    maxLength={NAME_MAX} required autoComplete="given-name"
                  />
                  <FloatField
                    className="signup-fade signup-d-4"
                    id="last_name" label="Last name" value={lastName} onChange={setLastName}
                    maxLength={NAME_MAX} required autoComplete="family-name"
                  />
                </div>

                <div className="signup-fade signup-d-5" style={{ marginTop: 12 }}>
                  <FloatField
                    id="company_name" label="Company name" value={companyName} onChange={setCompanyName}
                    maxLength={COMPANY_MAX} required autoComplete="organization"
                  />
                </div>

                <div className="signup-fade signup-d-6" style={{ marginTop: 12 }}>
                  <PasswordField
                    value={password} onChange={setPassword}
                    show={showPw} onToggleShow={() => setShowPw(s => !s)}
                  />
                  {/* Strength indicator (always reserve height to avoid layout shift) */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          style={{
                            flex:         1,
                            height:       3,
                            borderRadius: 2,
                            background:   i < pwScore ? pwMeta.color : 'rgba(255,255,255,0.08)',
                            transition:   'background-color 200ms ease',
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 42 }}>
                      {pwMeta.label || (password ? ' ' : ' ')}
                    </span>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    style={{
                      marginTop:  16,
                      padding:    '10px 14px',
                      background: 'rgba(248,113,113,0.10)',
                      border:     '1px solid rgba(248,113,113,0.25)',
                      borderRadius: 10,
                      color:      '#FCA5A5',
                      fontSize:   13,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div className="signup-fade signup-d-7" style={{ marginTop: 24 }}>
                  <button type="submit" className="cta-btn" disabled={loading}>
                    {loading ? 'Creating account…' : 'Start free trial →'}
                  </button>
                </div>
              </form>

              {/* Trust row */}
              <div
                className="signup-fade signup-d-8"
                style={{
                  display:    'flex',
                  flexWrap:   'wrap',
                  gap:        '8px 20px',
                  justifyContent: 'center',
                  marginTop:  24,
                  fontSize:   13,
                  color:      'rgba(255,255,255,0.5)',
                }}
              >
                <TrustItem>No credit card</TrustItem>
                <TrustItem>7-day trial</TrustItem>
                <TrustItem>Cancel anytime</TrustItem>
              </div>
            </div>

            {/* Footer */}
            <p
              className="signup-fade signup-d-9"
              style={{
                marginTop: 24,
                fontSize:  14,
                color:     'rgba(255,255,255,0.5)',
              }}
            >
              Already have an account?{' '}
              <a href="/login" className="signin-link">Sign in</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Orb({ cls, style }) {
  return (
    <div
      aria-hidden="true"
      className={cls}
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
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
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

function TrustItem({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Check />
      {children}
    </span>
  )
}

function VerifyPanel({ email }) {
  return (
    <div
      className="signup-fade signup-d-0"
      style={{
        background:     'rgba(255, 255, 255, 0.035)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border:         '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius:   24,
        padding:        '48px 40px',
        boxShadow:      '0 0 80px rgba(127, 119, 221, 0.15)',
        textAlign:      'center',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Check your email</div>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
        We sent a confirmation link to <strong style={{ color: '#FFFFFF' }}>{email}</strong>.
        Click it to activate your account.
      </p>
    </div>
  )
}

// ─── Icons (inline SVG, geen externe assets) ────────────────────────────────

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

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
