'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'
import Sidebar from '../../../components/Sidebar'

// Pure intent-saving page (ONBOARDING_SPEC v1.1 §6.1). Echte OAuth
// flow leeft op /api/auth/shopify; deze pagina schrijft alleen het
// store-domein als 'pending' naar integrations.
export default function ConnectShopifyPage() {
  const [mounted, setMounted]     = useState(false)
  const [token, setToken]         = useState(null)
  const [domain, setDomain]       = useState('')
  const [status, setStatus]       = useState('not_connected')   // 'not_connected' | 'pending' | 'connected'
  const [savedDomain, setSavedDomain] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]         = useState(null)              // { kind: 'ok'|'err', text }

  // Load current state
  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setToken(session.access_token)
      fetch('/api/settings/integrations/shopify', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache:   'no-store',
      })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d) return
          setStatus(d.status ?? 'not_connected')
          setSavedDomain(d.domain ?? null)
          if (d.domain) setDomain(d.domain)
        })
        .catch(() => {})
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!token || submitting) return
    setSubmitting(true)
    setToast(null)
    try {
      const res = await fetch('/api/settings/integrations/shopify', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast({ kind: 'err', text: data?.error || 'Failed to save settings.' })
      } else {
        setStatus(data.status ?? 'pending')
        setSavedDomain(data.domain ?? domain)
        setToast({ kind: 'ok', text: data.message || 'Settings saved.' })
      }
    } catch (e) {
      setToast({ kind: 'err', text: 'Network error. Please try again.' })
    }
    setSubmitting(false)
    // auto-clear toast
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
            Connect your Shopify store
          </h1>
          <p style={{ fontSize: 14, color: '#6B5E7B', lineHeight: 1.5, marginBottom: 24 }}>
            To pull order info into your tickets and unlock the AI Macro
            Generator, connect your Shopify store below.
          </p>

          {/* Status indicator */}
          <StatusPill status={status} subject={savedDomain} />

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            <label
              htmlFor="shopify-domain"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1C0F36', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Shopify store URL
            </label>
            <input
              id="shopify-domain"
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="your-store.myshopify.com"
              required
              autoComplete="off"
              spellCheck={false}
              style={{
                width:     '100%',
                padding:   '10px 14px',
                fontSize:  14,
                borderRadius: 8,
                border:    '1px solid #E5E0EB',
                background: '#FFFFFF',
                color:     '#1C0F36',
                fontFamily: 'inherit',
                outline:   'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 12,
                padding:   '10px 20px',
                borderRadius: 8,
                background: '#A175FC',
                color:      '#FFFFFF',
                border:     'none',
                fontSize:   13,
                fontWeight: 600,
                cursor:     submitting ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity:    submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Saving…' : 'Connect Shopify'}
            </button>
          </form>

          {/* Info banner */}
          <div
            style={{
              marginTop:   32,
              padding:     '12px 16px',
              background:  'rgba(245,158,11,0.08)',
              border:      '1px solid rgba(245,158,11,0.20)',
              borderRadius: 8,
              fontSize:    13,
              color:       '#92400E',
              lineHeight:  1.5,
            }}
          >
            ⚠️ Integration coming soon — your settings will be saved.
          </div>

          {/* Toast */}
          {toast && (
            <div
              role="status"
              style={{
                position:    'fixed',
                bottom:      24,
                right:       24,
                padding:     '10px 16px',
                borderRadius: 8,
                background:  toast.kind === 'ok' ? '#10B981' : '#EF4444',
                color:       '#FFFFFF',
                fontSize:    13,
                fontWeight:  500,
                boxShadow:   '0 4px 12px rgba(28,15,54,0.15)',
                zIndex:      100,
                maxWidth:    360,
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
