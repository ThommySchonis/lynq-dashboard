'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

// Welcome banner — top of /home for trial users only. Caller is
// responsible for the visibility check (subscription_status === 'trial'
// AND user.welcome_dismissed_at IS NULL); this component only renders
// the UI and handles the dismiss action.
export default function WelcomeBanner({ firstName, onDismissed }) {
  const [dismissing, setDismissing] = useState(false)

  async function handleDismiss() {
    if (dismissing) return
    setDismissing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch('/api/profile', {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ dismiss_welcome: true }),
      })
    } catch {
      // network blip — let parent decide whether to retry on next mount
    }
    if (onDismissed) onDismissed()
  }

  return (
    <div
      style={{
        position:      'relative',
        zIndex:        5,
        margin:        '16px 24px 0',
        padding:       '16px 20px',
        background:    'linear-gradient(135deg, rgba(161,117,252,0.10) 0%, rgba(99,102,241,0.06) 100%)',
        border:        '1px solid rgba(161,117,252,0.20)',
        borderRadius:  12,
        display:       'flex',
        alignItems:    'center',
        gap:           16,
        flexWrap:      'wrap',
        boxShadow:     '0 1px 2px rgba(28,15,54,0.04)',
      }}
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div
          style={{
            fontSize:     14,
            fontWeight:   600,
            color:        '#1C0F36',
            marginBottom: 4,
            letterSpacing: '-0.01em',
          }}
        >
          👋 Welcome to Lynq &amp; Flow{firstName ? `, ${firstName}` : ''}
        </div>
        <div style={{ fontSize: 13, color: '#6B5E7B', lineHeight: 1.5 }}>
          You&apos;re on a 7-day free trial. Connect your email and Shopify
          below to start handling customer support.
        </div>
      </div>
      <div
        style={{
          display:   'flex',
          gap:       8,
          alignItems: 'center',
          flexWrap:  'wrap',
        }}
      >
        <CtaLink href="/settings/email">Connect Gmail</CtaLink>
        <CtaLink href="/settings/email">Connect Outlook</CtaLink>
        <CtaLink href="/settings">Connect Shopify</CtaLink>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          style={{
            padding:    '8px 12px',
            borderRadius: 6,
            background: 'transparent',
            border:     'none',
            color:      '#6B5E7B',
            fontSize:   12,
            fontWeight: 500,
            cursor:     dismissing ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {dismissing ? 'Dismissing…' : 'Dismiss'}
        </button>
      </div>
    </div>
  )
}

function CtaLink({ href, children }) {
  return (
    <Link
      href={href}
      style={{
        padding:        '8px 14px',
        borderRadius:   6,
        background:     '#A175FC',
        color:          '#FFFFFF',
        textDecoration: 'none',
        fontSize:       12,
        fontWeight:     600,
        whiteSpace:     'nowrap',
      }}
    >
      {children}
    </Link>
  )
}
