'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

// SetupChecklist — sidebar widget. Caller is responsible for visibility
// gating (subscription_status === 'trial' AND
// user.setup_checklist_dismissed_at IS NULL). This component auto-hides
// itself if all items are completed.
//
// Props:
//   status: { macros_count, email_connected, shopify_connected,
//             team_member_count }  — output van /api/onboarding/status
//   onDismissed: callback after successful dismiss
export default function SetupChecklist({ status, onDismissed }) {
  const [dismissing, setDismissing] = useState(false)

  const items = buildItems(status)
  const done  = items.filter(i => i.done).length
  const total = items.length

  // Spec: "Niet alle 6 items completed (anders auto-hide)"
  if (done >= total) return null

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
        body: JSON.stringify({ dismiss_setup_checklist: true }),
      })
    } catch {
      // best-effort
    }
    if (onDismissed) onDismissed()
  }

  return (
    <div
      style={{
        margin:       '0 8px 8px',
        padding:      '10px 12px',
        background:   'rgba(161,117,252,0.10)',
        border:       '1px solid rgba(161,117,252,0.18)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   8,
        }}
      >
        <span style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 11 }}>
          Setup ({done}/{total})
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          aria-label="Hide setup checklist"
          title="Hide setup checklist"
          style={{
            background: 'none',
            border:     'none',
            color:      'rgba(255,255,255,0.4)',
            cursor:     dismissing ? 'wait' : 'pointer',
            fontSize:   16,
            lineHeight: 1,
            padding:    '0 2px',
            fontFamily: 'inherit',
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(item => (
          <ChecklistRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  )
}

function buildItems(status) {
  const s = status ?? {}
  return [
    { key: 'account',  label: 'Account created',         done: true,                                 href: null                                 },
    { key: 'workspace',label: 'Workspace ready',         done: true,                                 href: null                                 },
    { key: 'macros',   label: 'Generate AI macro library',
      done: (s.macros_count ?? 0) > 0,
      href: '/settings/workspace/macros/generate' },
    { key: 'email',    label: 'Connect email',
      done: !!s.email_connected,
      href: '/settings/email' },
    { key: 'shopify',  label: 'Connect Shopify',
      done: !!s.shopify_connected,
      href: '/settings' },
    { key: 'team',     label: 'Invite first team member',
      done: (s.team_member_count ?? 0) > 1,
      href: '/settings/workspace/members' },
  ]
}

function ChecklistRow({ item }) {
  const checkbox = item.done ? '✓' : '○'
  const checkColor = item.done ? '#22C55E' : 'rgba(255,255,255,0.4)'

  if (item.done || !item.href) {
    return (
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        8,
          fontSize:   11,
          color:      item.done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.7)',
        }}
      >
        <span style={{ width: 12, textAlign: 'center', color: checkColor, fontWeight: 700 }}>
          {checkbox}
        </span>
        <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>
          {item.label}
        </span>
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        fontSize:       11,
        color:          'rgba(255,255,255,0.7)',
        textDecoration: 'none',
      }}
    >
      <span style={{ width: 12, textAlign: 'center', color: checkColor, fontWeight: 700 }}>
        {checkbox}
      </span>
      <span>{item.label}</span>
    </Link>
  )
}
