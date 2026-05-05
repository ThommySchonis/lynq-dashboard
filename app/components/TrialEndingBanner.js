'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// Day 6 soft-warning banner per ONBOARDING_SPEC v1.1 §8.1.
// Caller is verantwoordelijk voor visibility gating (isTrialEndingSoon
// check). Dismiss is per-device per-browser via localStorage — bij
// volgende load binnen 24u verbergen we 'm. Geen DB call.
//
// Stijl: amber/oranje accent voor urgentie, contrast met de iris-paarse
// WelcomeBanner.

const DISMISS_KEY = 'trial_banner_dismissed_until'

export default function TrialEndingBanner({ onDismissed }) {
  const [hidden, setHidden] = useState(false)

  // Check de localStorage-dismissal na mount (SSR safe).
  useEffect(() => {
    try {
      const ts = window.localStorage.getItem(DISMISS_KEY)
      if (ts && Number.parseInt(ts, 10) > Date.now()) setHidden(true)
    } catch {
      // ignore — kunnen we lezen noch dismissen, dan toch maar tonen
    }
  }, [])

  function handleDismiss() {
    try {
      const until = Date.now() + 24 * 60 * 60 * 1000
      window.localStorage.setItem(DISMISS_KEY, String(until))
    } catch {
      // ignore
    }
    setHidden(true)
    if (onDismissed) onDismissed()
  }

  if (hidden) return null

  return (
    <div
      style={{
        position:     'relative',
        zIndex:       5,
        margin:       '16px 24px 0',
        padding:      '14px 18px',
        background:   'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.06) 100%)',
        border:       '1px solid rgba(245,158,11,0.30)',
        borderRadius: 12,
        display:      'flex',
        alignItems:   'center',
        gap:          16,
        flexWrap:     'wrap',
        boxShadow:    '0 1px 2px rgba(28,15,54,0.04)',
      }}
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div
          style={{
            fontSize:      14,
            fontWeight:    600,
            color:         '#92400E',
            marginBottom:  2,
            letterSpacing: '-0.01em',
          }}
        >
          ⏰ Your trial ends tomorrow
        </div>
        <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>
          Pick a plan to continue using Lynq &amp; Flow.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/settings/billing"
          style={{
            padding:        '8px 14px',
            borderRadius:   6,
            background:     '#F59E0B',
            color:          '#FFFFFF',
            textDecoration: 'none',
            fontSize:       12,
            fontWeight:     600,
            whiteSpace:     'nowrap',
          }}
        >
          See plans
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            padding:    '8px 12px',
            borderRadius: 6,
            background: 'transparent',
            border:     'none',
            color:      '#92400E',
            fontSize:   12,
            fontWeight: 500,
            cursor:     'pointer',
            fontFamily: 'inherit',
          }}
        >
          Remind me tomorrow
        </button>
      </div>
    </div>
  )
}
