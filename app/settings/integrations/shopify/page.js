'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  .shp-root * { box-sizing: border-box; }
  .shp-root {
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #F8F7FA;
    min-height: 100vh;
  }

  .shp-input {
    width: 100%;
    border: 1px solid #E5E0EB;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 14px;
    color: #1C0F36;
    background: #FFFFFF;
    outline: none;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s;
    line-height: 1.5;
  }
  .shp-input:focus {
    border-color: #A175FC;
    box-shadow: 0 0 0 3px rgba(161,117,252,0.12);
  }
  .shp-input::placeholder { color: #9B91A8; }

  .shp-input-wrap {
    position: relative;
  }
  .shp-input-wrap .shp-input {
    padding-right: 40px;
  }
  .shp-eye-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #9B91A8;
    padding: 2px;
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }
  .shp-eye-btn:hover { color: #6B5E7B; }

  .shp-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #1C0F36;
    margin-bottom: 6px;
    letter-spacing: 0.02em;
  }

  .shp-btn-primary {
    background: #A175FC;
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    padding: 9px 20px;
    font-size: 14px;
    font-weight: 600;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.15s;
  }
  .shp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .shp-btn-primary:hover:not(:disabled) { opacity: 0.88; }

  .shp-btn-danger {
    background: transparent;
    color: #EF4444;
    border: 1px solid rgba(239,68,68,0.3);
    border-radius: 8px;
    padding: 9px 20px;
    font-size: 14px;
    font-weight: 600;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s, border-color 0.15s;
  }
  .shp-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
  .shp-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.06); }

  .shp-btn-ghost {
    background: transparent;
    color: #6B5E7B;
    border: 1px solid #E5E0EB;
    border-radius: 8px;
    padding: 9px 20px;
    font-size: 14px;
    font-weight: 500;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    transition: background 0.15s;
  }
  .shp-btn-ghost:hover { background: rgba(0,0,0,0.04); }

  .modal-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.35); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: shpFadeIn 0.2s ease both;
  }
  .modal-box {
    background: #FFFFFF; border: 1px solid #E5E0EB;
    border-radius: 16px; padding: 28px; width: 100%; max-width: 440px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.14);
    animation: shpRevealUp 0.3s ease-out both;
    margin: 16px;
  }

  @keyframes shpFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes shpRevealUp {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }
`

/* ─────────────────────────────────────────────
   Password input with show/hide toggle
───────────────────────────────────────────── */
function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="shp-input-wrap">
      <input
        className="shp-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="shp-eye-btn"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide token' : 'Show token'}
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Shopify Connect Modal
───────────────────────────────────────────── */
function ShopifyConnectModal({ session: parentSession, onClose, onSuccess }) {
  const [shop, setShop] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    if (!shop.trim() || !accessToken.trim()) {
      setError('Both fields are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      // Refresh session to avoid expired token
      const { data: { session: freshSession } } = await supabase.auth.getSession()
      const authToken = freshSession?.access_token || parentSession?.access_token
      if (!authToken) {
        setError('Session expired. Please refresh the page and log in again.')
        setLoading(false)
        return
      }
      const res = await fetch('/api/shopify/manual-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ shop: shop.trim(), accessToken: accessToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Connection failed')
        setLoading(false)
        return
      }
      onSuccess(data.shop)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleConnect()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C0F36', marginBottom: 4, marginTop: 0 }}>
          Connect Shopify
        </h3>
        <p style={{ fontSize: 13, color: '#6B5E7B', marginBottom: 20, lineHeight: 1.5, marginTop: 0 }}>
          Enter your Shopify store domain and Admin API access token
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="shp-label">Store domain</label>
            <input
              className="shp-input"
              type="text"
              value={shop}
              onChange={e => setShop(e.target.value)}
              placeholder="your-store.myshopify.com"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="shp-label">Access token</label>
            <PasswordInput
              value={accessToken}
              onChange={setAccessToken}
              placeholder="shpat_..."
            />
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            fontSize: 13, color: '#DC2626',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="shp-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="shp-btn-primary" onClick={handleConnect} disabled={loading}>
            {loading ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : null}
            {loading ? 'Connecting…' : 'Connect Shopify'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Status pill
───────────────────────────────────────────── */
function StatusPill({ connected, domain }) {
  if (connected) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 100,
        background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)',
        fontSize: 12, fontWeight: 500, color: '#15803D',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
        <span>Connected</span>
        {domain && <span style={{ opacity: 0.7 }}>· {domain}</span>}
      </div>
    )
  }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 100,
      background: '#F1EEF5', border: '1px solid #E5E0EB',
      fontSize: 12, fontWeight: 500, color: '#6B5E7B',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9B91A8' }} />
      <span>Not connected</span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function ConnectShopifyPage() {
  const [mounted, setMounted]         = useState(false)
  const [session, setSession]         = useState(null)
  const [connected, setConnected]     = useState(false)
  const [shopDomain, setShopDomain]   = useState(null)
  const [showModal, setShowModal]     = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [toast, setToast]             = useState(null)   // { kind: 'ok'|'err', text }

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)
      // Load current connection status from integrations table
      fetch('/api/settings/integrations/shopify', {
        headers: { Authorization: `Bearer ${s.access_token}` },
        cache: 'no-store',
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return
          const isConnected = d.status === 'connected' || (d.domain && d.connected_at)
          setConnected(isConnected)
          setShopDomain(d.domain ?? null)
        })
        .catch(() => {})
    })
  }, [])

  function showToast(text, kind = 'ok') {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Shopify? Order data will no longer be available.')) return
    setDisconnecting(true)
    try {
      await fetch('/api/shopify/manual-connect', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      setConnected(false)
      setShopDomain(null)
      showToast('Shopify disconnected')
    } catch {
      showToast('Failed to disconnect', 'err')
    } finally {
      setDisconnecting(false)
    }
  }

  if (!mounted) return null

  return (
    <>
      <style>{CSS}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="shp-root" style={{ padding: '40px 32px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>

            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1C0F36', letterSpacing: '-0.02em', marginBottom: 6, marginTop: 0 }}>
                Shopify
              </h1>
              <p style={{ fontSize: 14, color: '#6B5E7B', lineHeight: 1.6, margin: 0 }}>
                Connect your Shopify store to pull order data into tickets and unlock the AI Macro Generator.
              </p>
            </div>

            {/* Card */}
            <div style={{
              background: '#FFFFFF', border: '1px solid #E5E0EB',
              borderRadius: 12, padding: '24px',
            }}>
              {/* Status + actions row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <StatusPill connected={connected} domain={shopDomain} />

                {connected ? (
                  <button
                    className="shp-btn-danger"
                    style={{ padding: '6px 16px', fontSize: 13 }}
                    disabled={disconnecting}
                    onClick={handleDisconnect}
                  >
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    className="shp-btn-primary"
                    style={{ padding: '7px 18px', fontSize: 13 }}
                    onClick={() => setShowModal(true)}
                  >
                    Connect Shopify
                  </button>
                )}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid #F0EDF4', margin: '20px 0' }} />

              {/* Info section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C0F36' }}>What you&apos;ll need</div>
                {[
                  { label: 'Store domain', desc: 'Your store\'s .myshopify.com address' },
                  { label: 'Admin API access token', desc: 'From Shopify Admin → Apps → develop apps → API credentials' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#A175FC', flexShrink: 0, marginTop: 6 }} />
                    <div>
                      <div style={{ fontSize: 13, color: '#1C0F36', fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: '#9B91A8', marginTop: 1 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {connected && shopDomain && (
                <>
                  <div style={{ borderTop: '1px solid #F0EDF4', margin: '20px 0' }} />
                  <div style={{ fontSize: 12, color: '#9B91A8' }}>
                    Connected store: <span style={{ color: '#6B5E7B', fontWeight: 500 }}>{shopDomain}</span>
                  </div>
                </>
              )}
            </div>

          </div>
      </div>

      {/* Modal */}
      {showModal && session && (
        <ShopifyConnectModal
          session={session}
          onClose={() => setShowModal(false)}
          onSuccess={(domain) => {
            setShowModal(false)
            setConnected(true)
            setShopDomain(domain)
            showToast('Shopify connected successfully!')
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 24, right: 24,
            padding: '10px 16px', borderRadius: 8,
            background: toast.kind === 'ok' ? '#10B981' : '#EF4444',
            color: '#FFFFFF', fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 12px rgba(28,15,54,0.15)',
            zIndex: 2000, maxWidth: 360,
          }}
        >
          {toast.text}
        </div>
      )}
    </>
  )
}
