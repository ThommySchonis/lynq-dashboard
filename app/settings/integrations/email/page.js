'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  .em-root * { box-sizing: border-box; }
  .em-root {
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #F8F7FA;
    min-height: 100vh;
  }

  .em-input {
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
  .em-input:focus {
    border-color: #A175FC;
    box-shadow: 0 0 0 3px rgba(161,117,252,0.12);
  }
  .em-input::placeholder { color: #9B91A8; }

  .em-input-wrap {
    position: relative;
  }
  .em-input-wrap .em-input {
    padding-right: 40px;
  }
  .em-eye-btn {
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
  .em-eye-btn:hover { color: #6B5E7B; }

  .em-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #1C0F36;
    margin-bottom: 6px;
    letter-spacing: 0.02em;
  }

  .em-btn-primary {
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
  .em-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .em-btn-primary:hover:not(:disabled) { opacity: 0.88; }

  .em-btn-danger {
    background: transparent;
    color: #EF4444;
    border: 1px solid rgba(239,68,68,0.3);
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 0.15s, border-color 0.15s;
  }
  .em-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
  .em-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.06); }

  .em-btn-ghost {
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
  .em-btn-ghost:hover { background: rgba(0,0,0,0.04); }

  .em-provider-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: #FFFFFF;
    border: 1px solid #E5E0EB;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: #1C0F36;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
    box-shadow: 0 1px 2px rgba(28,15,54,0.04);
    width: 100%;
  }
  .em-provider-btn:hover {
    border-color: #A175FC;
    box-shadow: 0 0 0 3px rgba(161,117,252,0.10);
    transform: translateY(-1px);
  }
  .em-provider-btn:active { transform: translateY(0); }

  .modal-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.35); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: emFadeIn 0.2s ease both;
  }
  .modal-box {
    background: #FFFFFF; border: 1px solid #E5E0EB;
    border-radius: 16px; padding: 28px; width: 100%; max-width: 480px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.14);
    animation: emRevealUp 0.3s ease-out both;
    margin: 16px;
    max-height: 90vh;
    overflow-y: auto;
  }

  @keyframes emFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes emRevealUp {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes emSpin {
    to { transform: rotate(360deg); }
  }
`

/* ─────────────────────────────────────────────
   Password input with show/hide toggle
───────────────────────────────────────────── */
function PasswordInput({ value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false)
  return (
    <div className="em-input-wrap">
      <input
        id={id}
        className="em-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
      />
      <button
        type="button"
        className="em-eye-btn"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
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
   Custom Email Modal
───────────────────────────────────────────── */
function CustomEmailModal({ token, onClose, onSuccess }) {
  const [fields, setFields] = useState({
    email:     '',
    imapHost:  '',
    imapPort:  '993',
    smtpHost:  '',
    smtpPort:  '587',
    username:  '',
    password:  '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function set(key) {
    return value => setFields(prev => ({ ...prev, [key]: value }))
  }

  function validate() {
    if (!fields.email.trim())    return 'Email address is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) return 'Enter a valid email address'
    if (!fields.imapHost.trim()) return 'IMAP host is required'
    if (!fields.imapPort.trim() || isNaN(Number(fields.imapPort))) return 'IMAP port must be a number'
    if (!fields.smtpHost.trim()) return 'SMTP host is required'
    if (!fields.smtpPort.trim() || isNaN(Number(fields.smtpPort))) return 'SMTP port must be a number'
    if (!fields.username.trim()) return 'Username is required'
    if (!fields.password.trim()) return 'Password is required'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/custom-email/connect', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          email:     fields.email.trim(),
          imap_host: fields.imapHost.trim(),
          imap_port: Number(fields.imapPort),
          smtp_host: fields.smtpHost.trim(),
          smtp_port: Number(fields.smtpPort),
          username:  fields.username.trim(),
          password:  fields.password,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Connection failed. Check your credentials and try again.')
        setLoading(false)
        return
      }
      onSuccess(fields.email.trim())
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C0F36', marginBottom: 4, marginTop: 0 }}>
          Connect custom email
        </h3>
        <p style={{ fontSize: 13, color: '#6B5E7B', marginBottom: 20, lineHeight: 1.5, marginTop: 0 }}>
          Enter your IMAP / SMTP credentials to connect any email account.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Email address */}
            <div>
              <label className="em-label" htmlFor="ce-email">Email address</label>
              <input
                id="ce-email"
                className="em-input"
                type="email"
                value={fields.email}
                onChange={e => set('email')(e.target.value)}
                placeholder="you@yourdomain.com"
                autoFocus
                autoComplete="email"
              />
            </div>

            {/* IMAP row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
              <div>
                <label className="em-label" htmlFor="ce-imap-host">IMAP host</label>
                <input
                  id="ce-imap-host"
                  className="em-input"
                  type="text"
                  value={fields.imapHost}
                  onChange={e => set('imapHost')(e.target.value)}
                  placeholder="imap.yourdomain.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="em-label" htmlFor="ce-imap-port">Port</label>
                <input
                  id="ce-imap-port"
                  className="em-input"
                  type="number"
                  value={fields.imapPort}
                  onChange={e => set('imapPort')(e.target.value)}
                  placeholder="993"
                  min="1"
                  max="65535"
                />
              </div>
            </div>

            {/* SMTP row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
              <div>
                <label className="em-label" htmlFor="ce-smtp-host">SMTP host</label>
                <input
                  id="ce-smtp-host"
                  className="em-input"
                  type="text"
                  value={fields.smtpHost}
                  onChange={e => set('smtpHost')(e.target.value)}
                  placeholder="smtp.yourdomain.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="em-label" htmlFor="ce-smtp-port">Port</label>
                <input
                  id="ce-smtp-port"
                  className="em-input"
                  type="number"
                  value={fields.smtpPort}
                  onChange={e => set('smtpPort')(e.target.value)}
                  placeholder="587"
                  min="1"
                  max="65535"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="em-label" htmlFor="ce-username">Username</label>
              <input
                id="ce-username"
                className="em-input"
                type="text"
                value={fields.username}
                onChange={e => set('username')(e.target.value)}
                placeholder="Usually your full email address"
                autoComplete="username"
                spellCheck={false}
              />
            </div>

            {/* Password */}
            <div>
              <label className="em-label" htmlFor="ce-password">Password</label>
              <PasswordInput
                id="ce-password"
                value={fields.password}
                onChange={set('password')}
                placeholder="App password or account password"
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
            <button type="button" className="em-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="em-btn-primary" disabled={loading}>
              {loading && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ animation: 'emSpin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              )}
              {loading ? 'Connecting…' : 'Connect account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Status badge
───────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    active:       { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)',   dot: '#22C55E', text: '#15803D', label: 'Active' },
    disconnected: { bg: '#F1EEF5',                border: '#E5E0EB',               dot: '#9B91A8', text: '#6B5E7B', label: 'Disconnected' },
    error:        { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',  dot: '#EF4444', text: '#DC2626', label: 'Error' },
  }
  const meta = map[status] ?? map.disconnected
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 100,
      background: meta.bg, border: `1px solid ${meta.border}`,
      fontSize: 11, fontWeight: 600, color: meta.text,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.dot }} />
      {meta.label}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Provider icon
───────────────────────────────────────────── */
function ProviderIcon({ provider }) {
  if (provider === 'gmail') return <GmailLogo />
  if (provider === 'outlook') return <OutlookLogo />
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B5E7B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-10 7L2 7"/>
    </svg>
  )
}

function providerLabel(provider) {
  if (provider === 'gmail')   return 'Gmail'
  if (provider === 'outlook') return 'Outlook'
  return 'Custom email'
}

/* ─────────────────────────────────────────────
   Connected accounts list
───────────────────────────────────────────── */
function AccountRow({ account, token, onDisconnected }) {
  const [busy, setBusy] = useState(false)

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${account.email ?? providerLabel(account.provider)}?`)) return
    setBusy(true)
    try {
      await fetch(`/api/inbox/accounts/${account.id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      onDisconnected(account.id)
    } catch {
      alert('Failed to disconnect. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: '#FFFFFF', border: '1px solid #E5E0EB',
      borderRadius: 10,
    }}>
      <span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <ProviderIcon provider={account.provider} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1C0F36', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {account.email || providerLabel(account.provider)}
        </div>
        <div style={{ fontSize: 12, color: '#9B91A8', marginTop: 1 }}>
          {providerLabel(account.provider)}
        </div>
      </div>
      <StatusBadge status={account.status ?? 'active'} />
      <button
        className="em-btn-danger"
        style={{ flexShrink: 0 }}
        disabled={busy}
        onClick={handleDisconnect}
      >
        {busy ? 'Removing…' : 'Disconnect'}
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Provider logos
───────────────────────────────────────────── */
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

function OutlookLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#0F6CBD"/>
      <text x="12" y="17" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">O</text>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function ConnectEmailPage() {
  const [mounted, setMounted]         = useState(false)
  const [token, setToken]             = useState(null)
  const [accounts, setAccounts]       = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [toast, setToast]             = useState(null)  // { kind: 'ok'|'err', text }

  function showToast(text, kind = 'ok') {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchAccounts = useCallback(async (authToken) => {
    setLoadingAccounts(true)
    try {
      const res = await fetch('/api/inbox/accounts', {
        headers: { Authorization: `Bearer ${authToken}` },
        cache:   'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setAccounts(Array.isArray(data) ? data : (data.accounts ?? []))
      }
    } catch {
      // non-fatal — list stays empty
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)

    // Handle OAuth redirect success
    const params = new URLSearchParams(window.location.search)
    if (params.get('status') === 'connected') {
      showToast('Email account connected successfully!')
      window.history.replaceState({}, '', window.location.pathname)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setToken(session.access_token)
      fetchAccounts(session.access_token)
    })
  }, [fetchAccounts])

  function connectGmail() {
    window.location.href = `/api/auth/gmail?t=${token}`
  }

  function connectOutlook() {
    window.location.href = `/api/auth/outlook?t=${token}`
  }

  function handleAccountDisconnected(id) {
    setAccounts(prev => prev.filter(a => a.id !== id))
    showToast('Account disconnected')
  }

  function handleCustomSuccess(email) {
    setShowCustomModal(false)
    showToast(`${email} connected successfully!`)
    if (token) fetchAccounts(token)
  }

  if (!mounted) return null

  return (
    <>
      <style>{CSS}</style>
      <div className="em-root" style={{ padding: '40px 32px' }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>

          {/* Back link */}
          <Link
            href="/settings"
            style={{ fontSize: 13, color: '#6B5E7B', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Settings
          </Link>

          {/* Header */}
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1C0F36', letterSpacing: '-0.02em', marginBottom: 6, marginTop: 0 }}>
            Email accounts
          </h1>
          <p style={{ fontSize: 14, color: '#6B5E7B', lineHeight: 1.6, margin: '0 0 32px' }}>
            Connect email accounts to receive customer emails as support tickets.
          </p>

          {/* Add account card */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E5E0EB',
            borderRadius: 12, padding: 24, marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1C0F36', marginBottom: 16 }}>
              Add an account
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              {/* Gmail */}
              <button type="button" className="em-provider-btn" onClick={connectGmail}>
                <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <GmailLogo />
                </span>
                <span style={{ flex: 1 }}>Gmail</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9B91A8', flexShrink: 0 }}>
                  <path d="M7 17L17 7M17 7H7M17 7v10"/>
                </svg>
              </button>

              {/* Outlook */}
              <button type="button" className="em-provider-btn" onClick={connectOutlook}>
                <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <OutlookLogo />
                </span>
                <span style={{ flex: 1 }}>Outlook</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9B91A8', flexShrink: 0 }}>
                  <path d="M7 17L17 7M17 7H7M17 7v10"/>
                </svg>
              </button>

              {/* Custom */}
              <button type="button" className="em-provider-btn" onClick={() => setShowCustomModal(true)}>
                <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B5E7B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-10 7L2 7"/>
                  </svg>
                </span>
                <span style={{ flex: 1 }}>Custom (IMAP)</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9B91A8', flexShrink: 0 }}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Connected accounts */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E5E0EB',
            borderRadius: 12, padding: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1C0F36', marginBottom: 16 }}>
              Connected accounts
            </div>

            {loadingAccounts ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: '#9B91A8', fontSize: 13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ animation: 'emSpin 0.8s linear infinite', flexShrink: 0 }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Loading accounts…
              </div>
            ) : accounts.length === 0 ? (
              <div style={{
                padding: '24px 0', textAlign: 'center',
                color: '#9B91A8', fontSize: 13, lineHeight: 1.6,
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"
                  style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }}>
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-10 7L2 7"/>
                </svg>
                No accounts connected yet.<br/>Add one above to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {accounts.map(account => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    token={token}
                    onDisconnected={handleAccountDisconnected}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Custom email modal */}
      {showCustomModal && token && (
        <CustomEmailModal
          token={token}
          onClose={() => setShowCustomModal(false)}
          onSuccess={handleCustomSuccess}
        />
      )}

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
            zIndex:       2000,
            maxWidth:     360,
          }}
        >
          {toast.text}
        </div>
      )}
    </>
  )
}
