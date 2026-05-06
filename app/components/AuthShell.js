'use client'

// Shared visual shell voor auth-related pages (forgot-password,
// reset-password, en toekomstige). Identiek aan /login en /signup
// qua orbs, fonts, glass card, word-stagger headline.
//
// /signup en /login zijn al productie-stable met hun eigen kopie van
// deze styling — die blijven ongewijzigd. Nieuwe pages gebruiken deze
// shell om duplication te vermijden.
//
// Usage:
//   <AuthShell
//     headline="Forgot your password?"
//     subhead="Enter your email and we'll send you a reset link."
//     footer={<>Remember? <Link href="/login">Sign in</Link></>}
//   >
//     <form>...</form>  ← form en/of success state als children
//   </AuthShell>
//
// Exports also: FloatField, PasswordField — drop-in vorm-elementen.

import { Instrument_Serif, DM_Sans } from 'next/font/google'

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

const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`
const NOISE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(NOISE_SVG)}")`

const CSS = `
  /* Orbs */
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

  /* Page-load stagger fades */
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  .as-fade { opacity: 0; animation: fadeInUp 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .as-d-0 { animation-delay:    0ms; }
  .as-d-2 { animation-delay:  160ms; }
  .as-d-3 { animation-delay:  240ms; }
  .as-d-4 { animation-delay:  320ms; }
  .as-d-8 { animation-delay:  640ms; }

  /* Headline word reveal */
  @keyframes wordReveal {
    from { opacity: 0; transform: translateY(20px); filter: blur(10px); }
    to   { opacity: 1; transform: translateY(0);    filter: blur(0);    }
  }
  .word-reveal {
    display: inline-block;
    opacity: 0;
    animation: wordReveal 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    will-change: opacity, transform, filter;
  }

  /* Field styling */
  .as-field-wrap   { position: relative; }
  .as-field-input  {
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
  .as-field-input::placeholder { color: rgba(255, 255, 255, 0.4); }
  .as-field-input:hover { background: rgba(255, 255, 255, 0.075); }
  .as-field-input:focus {
    border-color: #7F77DD;
    box-shadow:
      0 0 0 4px rgba(127, 119, 221, 0.15),
      0 0 20px rgba(127, 119, 221, 0.20);
    background: rgba(255, 255, 255, 0.10);
  }
  .as-field-input:focus + .as-field-label,
  .as-field-input:not(:placeholder-shown) + .as-field-label {
    top: 8px;
    font-size: 11px;
    letter-spacing: 0.05em;
    color: rgba(255,255,255,0.6);
  }
  .as-field-input:focus + .as-field-label { color: #C4B0FF; }
  .as-field-label {
    position: absolute;
    left: 16px;
    top: 16px;
    font-size: 14px;
    color: rgba(255,255,255,0.4);
    pointer-events: none;
    transition: top 180ms ease, font-size 180ms ease, color 180ms ease, letter-spacing 180ms ease;
  }

  /* Password show/hide button */
  .as-pw-toggle {
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
  .as-pw-toggle:hover { color: #FFFFFF; background: rgba(255,255,255,0.06); }
  .as-pw-toggle:focus-visible { outline: 2px solid #7F77DD; outline-offset: 2px; }

  /* Inline link styling */
  .as-link {
    color: #C4B0FF;
    text-decoration: none;
    transition: color 150ms ease;
  }
  .as-link:hover { text-decoration: underline; }

  /* Mobile */
  @media (max-width: 640px) {
    .as-headline { font-size: clamp(38px, 10vw, 52px) !important; }
    .as-card     { padding: 32px 24px !important; }
    .as-wordmark { margin-bottom: 16px !important; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .as-orb { animation: none !important; }
    .as-fade,
    .word-reveal {
      opacity: 1 !important;
      animation: none !important;
      transform: none !important;
      filter: none !important;
    }
  }
`

export default function AuthShell({
  headline,        // string — wordt op spaces gesplitst voor word-stagger
  subhead,         // string of ReactNode
  children,        // form / success-content / etc.
  footer,          // optional ReactNode (onder de card)
  headlineSize,    // optional override CSS clamp(...)
}) {
  const words = (headline || '').trim().split(/\s+/).filter(Boolean)

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

      {/* Orbs */}
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

      {/* Noise */}
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

      {/* Content stack */}
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
          className="as-wordmark as-fade as-d-0"
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

        {/* Headline — word stagger */}
        {headline && (
          <h1
            className={`as-headline ${display.className}`}
            style={{
              fontFamily:    display.style.fontFamily,
              fontSize:      headlineSize || 'clamp(40px, 5.2vw, 60px)',
              fontWeight:    400,
              lineHeight:    1.05,
              letterSpacing: '-0.02em',
              margin:        0,
            }}
          >
            {words.map((word, i) => (
              <span
                key={i}
                className="word-reveal"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {word}{i < words.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>
        )}

        {/* Gradient divider */}
        <div
          className="as-fade as-d-2"
          aria-hidden="true"
          style={{
            width:      140,
            height:     1,
            margin:     '20px auto 16px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(127,119,221,0.45) 50%, transparent 100%)',
          }}
        />

        {/* Subhead */}
        {subhead && (
          <div
            className="as-fade as-d-3"
            style={{
              fontSize:     15,
              color:        'rgba(255,255,255,0.6)',
              marginBottom: 28,
              marginTop:    0,
              lineHeight:   1.55,
            }}
          >
            {subhead}
          </div>
        )}

        {/* Glass card */}
        <div
          className="as-card as-fade as-d-4"
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
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="as-fade as-d-8"
            style={{
              marginTop: 20,
              fontSize:  14,
              color:     'rgba(255,255,255,0.55)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Orb({ style }) {
  return (
    <div
      aria-hidden="true"
      className="as-orb"
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

// ─── Form-element exports (drop-in voor /forgot-password en
//     /reset-password) ────────────────────────────────────────────

export function FloatField({ id, label, type = 'text', value, onChange, className, ...rest }) {
  return (
    <div className={`as-field-wrap ${className || ''}`}>
      <input
        id={id}
        name={id}
        type={type}
        className="as-field-input"
        placeholder=" "
        value={value}
        onChange={e => onChange(e.target.value)}
        {...rest}
      />
      <label htmlFor={id} className="as-field-label">{label}</label>
    </div>
  )
}

export function PasswordField({ id = 'password', label = 'Password', value, onChange, show, onToggleShow, autoComplete = 'new-password', minLength, className }) {
  return (
    <div className={`as-field-wrap ${className || ''}`}>
      <input
        id={id}
        name={id}
        type={show ? 'text' : 'password'}
        className="as-field-input"
        style={{ paddingRight: 48 }}
        placeholder=" "
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        minLength={minLength}
      />
      <label htmlFor={id} className="as-field-label">{label}</label>
      <button
        type="button"
        className="as-pw-toggle"
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
