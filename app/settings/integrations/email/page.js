'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'
import Sidebar from '../../../components/Sidebar'

// Pure intent-saving page (ONBOARDING_SPEC v1.1 §6.2). Slaat alleen op
// welke provider de user heeft geklikt. Echte OAuth flows volgen later.
export default function ConnectEmailPage() {
  const [mounted, setMounted]       = useState(false)
  const [token, setToken]           = useState(null)
  const [provider, setProvider]     = useState(null)             // 'gmail' | 'outlook' | null
  const [status, setStatus]         = useState('not_connected')  // 'not_connected' | 'pending' | 'connected'
  const [savedEmail, setSavedEmail] = useState(null)
  const [submitting, setSubmitting] = useState(null)             // null | 'gmail' | 'outlook'
  const [toast, setToast]           = useState(null)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setToken(session.access_token)
      fetch('/api/settings/integrations/email', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache:   'no-store',
      })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d) return
          setStatus(d.status ?? 'not_connected')
          setProvider(d.provider ?? null)
          setSavedEmail(d.real_email ?? null)
        })
        .catch(() => {})
    })
  }, [])

  async function pickProvider(which) {
    if (!token || submitting) return
    setSubmitting(which)
    setToast(null)
    try {
      const res = await fetch('/api/settings/integrations/email', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ provider: which }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast({ kind: 'err', text: data?.error || 'Failed to save settings.' })
      } else {
        setStatus(data.status ?? 'pending')
        setProvider(data.provider ?? which)
        setSavedEmail(null)  // pending state has no real email yet
        setToast({ kind: 'ok', text: data.message || 'Settings saved.' })
      }
    } catch {
      setToast({ kind: 'err', text: 'Network error. Please try again.' })
    }
    setSubmitting(null)
    setTimeout(() => setToast(null), 4000)
  }

  if (!mounted) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9F8FF' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Back link */}
          <Link
            href="/settings"
            style={{ fontSize: 13, color: '#6B5E7B', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}
          >
            ← Back to Settings
          </Link>

          {/* Header */}
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1C0F36', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Connect your email account
          </h1>
          <p style={{ fontSize: 14, color: '#6B5E7B', lineHeight: 1.5, marginBottom: 24 }}>
            Choose your email provider to start receiving customer emails as tickets:
          </p>

          {/* Two big provider buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
            <ProviderButton
              providerKey="gmail"
              label="Connect Gmail"
              logo={<GmailLogo />}
              status={provider === 'gmail' ? status : 'not_connected'}
              busy={submitting === 'gmail'}
              onClick={() => pickProvider('gmail')}
            />
            <ProviderButton
              providerKey="outlook"
              label="Connect Outlook"
              logo={<OutlookLogo />}
              status={provider === 'outlook' ? status : 'not_connected'}
              busy={submitting === 'outlook'}
              onClick={() => pickProvider('outlook')}
            />
          </div>

          {/* Status indicator (current selection) */}
          {provider && (
            <StatusPill status={status} subject={savedEmail || (provider === 'gmail' ? 'Gmail' : 'Outlook')} />
          )}

          {/* Info banner */}
          <div
            style={{
              marginTop:    32,
              padding:      '12px 16px',
              background:   'rgba(245,158,11,0.08)',
              border:       '1px solid rgba(245,158,11,0.20)',
              borderRadius: 8,
              fontSize:     13,
              color:        '#92400E',
              lineHeight:   1.5,
            }}
          >
            ⚠️ Integration coming soon — your settings will be saved.
          </div>

          {/* Toast */}
          {toast && (
            <div
              role="status"
              style={{
                position:     'fixed',
                bottom:       24,
                right:        24,
                padding:      '10px 16px',
                borderRadius: 8,
                background:   toast.kind === 'ok' ? '#10B981' : '#EF4444',
                color:        '#FFFFFF',
                fontSize:     13,
                fontWeight:   500,
                boxShadow:    '0 4px 12px rgba(28,15,54,0.15)',
                zIndex:       100,
                maxWidth:     360,
              }}
            >
              {toast.text}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function ProviderButton({ providerKey, label, logo, status, busy, onClick }) {
  const isPending   = status === 'pending'
  const isConnected = status === 'connected'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            12,
        padding:        '14px 16px',
        background:     '#FFFFFF',
        border:         `1px solid ${isConnected ? 'rgba(34,197,94,0.35)' : isPending ? 'rgba(245,158,11,0.35)' : '#E5E0EB'}`,
        borderRadius:   10,
        cursor:         busy ? 'wait' : 'pointer',
        fontSize:       14,
        fontWeight:     600,
        color:          '#1C0F36',
        fontFamily:     'inherit',
        textAlign:      'left',
        transition:     'border-color .15s, transform .1s',
        opacity:        busy ? 0.7 : 1,
        boxShadow:      '0 1px 2px rgba(28,15,54,0.04)',
      }}
    >
      <span style={{ flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {logo}
      </span>
      <span style={{ flex: 1 }}>
        {busy ? 'Saving…' : label}
      </span>
      {isPending   && <span style={{ fontSize: 11, fontWeight: 500, color: '#92400E' }}>Pending</span>}
      {isConnected && <span style={{ fontSize: 11, fontWeight: 500, color: '#15803D' }}>Connected</span>}
    </button>
  )
}

function StatusPill({ status, subject }) {
  const meta =
    status === 'connected'
      ? { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.25)', dot: '#22C55E', text: '#15803D', label: 'Connected' }
      : status === 'pending'
      ? { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', dot: '#F59E0B', text: '#92400E', label: 'Pending' }
      : { bg: '#F1EEF5',                border: '#E5E0EB',              dot: '#9B91A8', text: '#6B5E7B', label: 'Not connected' }

  return (
    <div
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          8,
        padding:      '6px 12px',
        background:   meta.bg,
        border:       `1px solid ${meta.border}`,
        borderRadius: 100,
        fontSize:     12,
        fontWeight:   500,
        color:        meta.text,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
      <span>{meta.label}</span>
      {subject && <span style={{ opacity: 0.7 }}>· {subject}</span>}
    </div>
  )
}

// Gmail brand mark — official multi-color M envelope. Simple-Icons style.
function GmailLogo() {
  return (
    <svg width="22" height="16" viewBox="0 0 24 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 1.5v15a1.5 1.5 0 0 1-1.5 1.5h-2V6.27L12 11 5.5 6.27V18h-2A1.5 1.5 0 0 1 2 16.5v-15A1.5 1.5 0 0 1 3.5 0h.5l8 5.82L20 0h.5A1.5 1.5 0 0 1 22 1.5z" fill="#EA4335"/>
      <path d="M2 1.5A1.5 1.5 0 0 1 3.5 0h.5l8 5.82L20 0h.5A1.5 1.5 0 0 1 22 1.5l-10 7.27z" fill="#FBBC04"/>
      <path d="M2 1.5v15A1.5 1.5 0 0 0 3.5 18h2V6.27L2 1.5z" fill="#34A853"/>
      <path d="M22 1.5v15a1.5 1.5 0 0 1-1.5 1.5h-2V6.27L22 1.5z" fill="#4285F4"/>
    </svg>
  )
}

// Outlook brand mark — simplified blue O envelope.
function OutlookLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#0F6CBD"/>
      <text x="12" y="17" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">O</text>
    </svg>
  )
}
