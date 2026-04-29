'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

const CSS = `
  @keyframes revealUp {
    from { opacity:0; transform:translateY(18px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes spin {
    to { transform:rotate(360deg); }
  }
  @keyframes slideIn {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0); }
  }

  .settings-root * { box-sizing:border-box; margin:0; padding:0; }
  .settings-root {
    font-family:var(--font-rethink), -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing:antialiased;
  }

  .settings-input {
    background:var(--bg-surface-2);
    border:1px solid var(--border);
    border-radius:8px;
    padding:10px 14px;
    color:var(--text-1);
    width:100%;
    outline:none;
    font-size:14px;
    font-family:var(--font-rethink), -apple-system, BlinkMacSystemFont, sans-serif;
    transition:all 0.2s ease;
  }
  .settings-input:focus {
    border-color:#A175FC;
    box-shadow:0 0 0 3px rgba(161,117,252,0.1);
  }
  .settings-input:read-only {
    opacity:0.55;
    cursor:not-allowed;
  }
  .settings-input::placeholder {
    color:var(--text-3);
  }

  .tab-item {
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border-radius:10px;
    cursor:pointer;
    transition:all 0.15s ease;
    color:var(--text-2);
    font-size:13px;
    font-weight:400;
    border:none;
    background:transparent;
    width:100%;
    text-align:left;
    font-family:inherit;
  }
  .tab-item:hover {
    background:var(--bg-surface-2);
    color:var(--text-1);
  }
  .tab-item.active {
    background:rgba(161,117,252,0.15);
    color:#A175FC;
    font-weight:600;
  }

  .settings-card {
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:14px;
    padding:24px;
    box-shadow:var(--shadow-card);
    animation:revealUp 0.35s ease-out both;
  }

  .primary-btn {
    background:#A175FC;
    color:#fff;
    padding:10px 20px;
    border-radius:8px;
    font-weight:600;
    border:none;
    cursor:pointer;
    font-size:14px;
    font-family:inherit;
    display:inline-flex;
    align-items:center;
    gap:8px;
    transition:all 0.2s ease;
  }
  .primary-btn:hover:not(:disabled) {
    background:#B990FF;
    box-shadow:0 4px 20px rgba(161,117,252,0.3);
    transform:translateY(-1px);
  }
  .primary-btn:disabled {
    opacity:0.5;
    cursor:not-allowed;
    transform:none;
    box-shadow:none;
  }

  .danger-btn {
    background:transparent;
    color:#f87171;
    padding:10px 20px;
    border-radius:8px;
    font-weight:600;
    border:1px solid rgba(248,113,113,0.3);
    cursor:pointer;
    font-size:14px;
    font-family:inherit;
    display:inline-flex;
    align-items:center;
    gap:8px;
    transition:all 0.2s ease;
  }
  .danger-btn:hover {
    background:rgba(248,113,113,0.1);
    border-color:rgba(248,113,113,0.6);
  }

  .integration-card {
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:14px;
    padding:20px 24px;
    display:flex;
    align-items:center;
    gap:16px;
    box-shadow:var(--shadow-card);
    transition:all 0.2s ease;
  }
  .integration-card:hover {
    border-color:var(--border-hover);
    background:var(--bg-surface-2);
    box-shadow:var(--shadow-card-hover);
  }

  .toggle-track {
    width:44px;
    height:24px;
    border-radius:12px;
    position:relative;
    cursor:pointer;
    transition:background 0.25s ease;
    flex-shrink:0;
    border:none;
    padding:0;
  }
  .toggle-thumb {
    position:absolute;
    top:3px;
    width:18px;
    height:18px;
    border-radius:50%;
    background:#fff;
    transition:left 0.25s ease;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
  }

  .notification-row {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:16px 0;
    border-bottom:1px solid var(--border);
  }
  .notification-row:last-child { border-bottom:none; }

  .pw-input-wrap {
    position:relative;
  }
  .pw-toggle-btn {
    position:absolute;
    right:12px;
    top:50%;
    transform:translateY(-50%);
    background:transparent;
    border:none;
    cursor:pointer;
    color:var(--text-3);
    display:flex;
    align-items:center;
    justify-content:center;
    padding:0;
    transition:color 0.15s ease;
  }
  .pw-toggle-btn:hover { color:var(--text-2); }

  .label-text {
    font-size:12px;
    font-weight:600;
    color:var(--text-2);
    text-transform:uppercase;
    letter-spacing:0.07em;
    margin-bottom:8px;
  }

  .toast {
    position:fixed;
    bottom:32px;
    right:32px;
    background:var(--bg-surface);
    border:1px solid rgba(161,117,252,0.3);
    border-radius:10px;
    padding:14px 20px;
    color:var(--text-1);
    font-size:14px;
    font-weight:500;
    z-index:9999;
    animation:revealUp 0.3s ease-out both;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    display:flex;
    align-items:center;
    gap:10px;
  }
  .toast.error {
    border-color:rgba(248,113,113,0.3);
    background:var(--bg-surface);
  }

  .color-input-wrapper {
    display:flex;
    align-items:center;
    gap:12px;
    background:var(--bg-surface-2);
    border:1px solid var(--border);
    border-radius:8px;
    padding:8px 14px;
    transition:all 0.2s ease;
    cursor:pointer;
  }
  .color-input-wrapper:focus-within {
    border-color:#A175FC;
    box-shadow:0 0 0 3px rgba(161,117,252,0.1);
  }
  input[type="color"] {
    -webkit-appearance:none;
    width:28px;
    height:28px;
    border:none;
    border-radius:6px;
    cursor:pointer;
    background:transparent;
    padding:0;
    outline:none;
  }
  input[type="color"]::-webkit-color-swatch-wrapper { padding:0; border-radius:6px; }
  input[type="color"]::-webkit-color-swatch { border:none; border-radius:6px; }

  .section-header {
    margin-bottom:24px;
    animation:revealUp 0.3s ease-out both;
  }
  .section-header h2 {
    font-size:18px;
    font-weight:700;
    color:var(--text-1);
    margin-bottom:4px;
  }
  .section-header p {
    font-size:13px;
    color:var(--text-3);
  }

  .field-group {
    display:flex;
    flex-direction:column;
    gap:20px;
  }

  .scrollbar-thin::-webkit-scrollbar { width:3px; }
  .scrollbar-thin::-webkit-scrollbar-track { background:transparent; }
  .scrollbar-thin::-webkit-scrollbar-thumb { background:var(--bg-surface-2); border-radius:2px; }
`

/* ─── SVG Icons ─── */
function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}
function IconPalette() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function IconEye({ slash }) {
  if (slash) return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function IconCart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  )
}
function IconMail() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}
function IconHeadset() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  )
}
function IconPackage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function IconLogOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

/* ─── Spinner ─── */
function Spinner() {
  return (
    <div style={{
      width:14, height:14,
      border:'2px solid rgba(255,255,255,0.2)',
      borderTop:'2px solid #fff',
      borderRadius:'50%',
      animation:'spin 0.7s linear infinite',
      flexShrink:0,
    }}/>
  )
}

/* ─── Toast ─── */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`toast${type === 'error' ? ' error' : ''}`}>
      {type !== 'error' && (
        <span style={{
          width:20, height:20, borderRadius:'50%',
          background:'rgba(74,222,128,0.15)',
          border:'1px solid rgba(74,222,128,0.4)',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          color:'#4ade80', flexShrink:0,
        }}>
          <IconCheck/>
        </span>
      )}
      {message}
    </div>
  )
}

/* ─── Toggle Switch ─── */
function Toggle({ on, onChange }) {
  return (
    <button
      className="toggle-track"
      onClick={() => onChange(!on)}
      style={{ background: on ? '#A175FC' : 'var(--bg-surface-2)' }}
      aria-checked={on}
      role="switch"
    >
      <div className="toggle-thumb" style={{ left: on ? '23px' : '3px' }}/>
    </button>
  )
}

/* ─── Avatar ─── */
function Avatar({ email, name, size = 56 }) {
  const initials = name
    ? name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email ? email.split('@')[0].slice(0, 2).toUpperCase() : '??'
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:'linear-gradient(135deg,#A175FC 0%,#7C3AED 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size * 0.29, fontWeight:700, color:'#fff',
      flexShrink:0,
      boxShadow:'0 4px 20px rgba(161,117,252,0.25)',
    }}>
      {initials}
    </div>
  )
}

/* ─── Password Input ─── */
function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-input-wrap">
      <input
        className="settings-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingRight:40 }}
      />
      <button className="pw-toggle-btn" onClick={() => setShow(s => !s)} type="button" tabIndex={-1}>
        <IconEye slash={show}/>
      </button>
    </div>
  )
}

/* ─── TAB: Profile ─── */
function ProfileTab({ session }) {
  const email = session?.user?.email || ''
  const meta  = session?.user?.user_metadata || {}
  const [displayName, setDisplayName] = useState(meta.full_name || meta.name || email.split('@')[0] || '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  async function handleSave() {
    if (!displayName.trim()) {
      setToast({ message: 'Name cannot be empty', type: 'error' })
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName.trim() } })
    setSaving(false)
    if (error) {
      setToast({ message: error.message || 'Failed to save', type: 'error' })
    } else {
      setToast({ message: 'Profile saved — refresh the home page to see your name', type: 'success' })
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
      <div className="section-header">
        <h2>Profile</h2>
        <p>Manage your account details and display preferences</p>
      </div>

      {/* Avatar row */}
      <div className="settings-card" style={{ display:'flex', alignItems:'center', gap:20, animationDelay:'0.05s' }}>
        <Avatar email={email} name={displayName} size={56}/>
        <div>
          <div style={{ color:'var(--text-1)', fontWeight:600, fontSize:15, marginBottom:4 }}>
            {displayName || email.split('@')[0]}
          </div>
          <div style={{ color:'var(--text-3)', fontSize:13 }}>{email}</div>
        </div>
      </div>

      {/* Fields */}
      <div className="settings-card" style={{ animationDelay:'0.1s' }}>
        <div className="field-group">
          <div>
            <div className="label-text">Display Name</div>
            <input
              className="settings-input"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <div className="label-text">Email Address</div>
            <div style={{ position:'relative' }}>
              <input
                className="settings-input"
                type="email"
                value={email}
                readOnly
                style={{ paddingRight:40 }}
              />
              <span style={{
                position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                color:'var(--text-3)',
              }}>
                <IconLock/>
              </span>
            </div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginTop:6 }}>
              Email is managed by your authentication provider
            </div>
          </div>

          <div>
            <button className="primary-btn" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner/> : null}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── TAB: Integrations ─── */
function IntegrationsTab({ session }) {
  const [integrations, setIntegrations] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/settings/integrations', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(data => { setIntegrations(data); setLoading(false) })
      .catch(() => { setIntegrations({}); setLoading(false) })
  }, [session])

  const items = [
    {
      id: 'shopify',
      label: 'Shopify',
      desc: 'Sync orders, refunds and customer data',
      icon: <IconCart/>,
      color: '#4ade80',
      bg: 'rgba(74,222,128,0.12)',
      connected: integrations?.shopify,
    },
    {
      id: 'gmail',
      label: 'Gmail',
      desc: 'Manage customer support emails',
      icon: <IconMail/>,
      color: '#f87171',
      bg: 'rgba(248,113,113,0.12)',
      connected: integrations?.gmail,
    },
    {
      id: 'gorgias',
      label: 'Gorgias',
      desc: 'Helpdesk ticketing integration',
      icon: <IconHeadset/>,
      color: 'var(--text-3)',
      bg: 'var(--bg-input)',
      comingSoon: true,
    },
    {
      id: 'parcelpanel',
      label: 'ParcelPanel',
      desc: 'Track shipment status for customers',
      icon: <IconPackage/>,
      color: '#c084fc',
      bg: 'rgba(192,132,252,0.12)',
      connected: integrations?.parcelpanel,
    },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
      <div className="section-header">
        <h2>Integrations</h2>
        <p>Connect your tools and data sources to Lynq</p>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {items.map((item, i) => (
          <div
            key={item.id}
            className="integration-card"
            style={{ animationDelay:`${0.05 + i * 0.06}s`, animation:'revealUp 0.35s ease-out both' }}
          >
            {/* Icon */}
            <div style={{
              width:44, height:44, borderRadius:11,
              background: item.bg,
              display:'flex', alignItems:'center', justifyContent:'center',
              color: item.color,
              flexShrink:0,
            }}>
              {item.icon}
            </div>

            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'var(--text-1)', fontWeight:600, fontSize:14, marginBottom:3 }}>
                {item.label}
              </div>
              <div style={{ color:'var(--text-3)', fontSize:13 }}>
                {item.desc}
              </div>
            </div>

            {/* Status / action */}
            <div style={{ flexShrink:0 }}>
              {loading && !item.comingSoon ? (
                <div style={{
                  width:80, height:30, borderRadius:8,
                  background:'var(--bg-input)',
                  border:'1px solid rgba(255,255,255,0.06)',
                  animation:'revealUp 0.5s ease both',
                }}/>
              ) : item.comingSoon ? (
                <span style={{
                  padding:'5px 12px', borderRadius:20,
                  background:'var(--bg-surface-2)',
                  border:'1px solid var(--border)',
                  fontSize:12, fontWeight:600,
                  color:'var(--text-3)',
                }}>
                  Coming Soon
                </span>
              ) : item.connected ? (
                <span style={{
                  padding:'5px 12px', borderRadius:20,
                  background:'rgba(74,222,128,0.1)',
                  border:'1px solid rgba(74,222,128,0.25)',
                  fontSize:12, fontWeight:600, color:'#4ade80',
                  display:'inline-flex', alignItems:'center', gap:6,
                }}>
                  <span style={{
                    width:6, height:6, borderRadius:'50%',
                    background:'#4ade80',
                    boxShadow:'0 0 6px #4ade80',
                  }}/>
                  Connected
                </span>
              ) : (
                <button
                  className="primary-btn"
                  style={{ padding:'7px 16px', fontSize:13 }}
                  onClick={() => setToast({ message: `${item.label} connection coming soon`, type: 'success' })}
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── TAB: Brand ─── */
function BrandTab({ session }) {
  const [brandName, setBrandName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#A175FC')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/settings/brand', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(({ settings }) => {
        setBrandName(settings?.brand_name || '')
        setSupportEmail(session.user.email || '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [session])

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/settings/brand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ brandName }),
      })
      setToast({ message: 'Brand settings saved', type: 'success' })
    } catch {
      setToast({ message: 'Failed to save. Please try again.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
      <div className="section-header">
        <h2>Brand</h2>
        <p>Customize your brand identity used across Lynq</p>
      </div>

      <div className="settings-card" style={{ animationDelay:'0.05s' }}>
        <div className="field-group">
          <div>
            <div className="label-text">Brand Name</div>
            <input
              className="settings-input"
              type="text"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="e.g. Earthly Sheets"
              disabled={loading}
            />
          </div>

          <div>
            <div className="label-text">Support Email</div>
            <input
              className="settings-input"
              type="email"
              value={supportEmail}
              onChange={e => setSupportEmail(e.target.value)}
              placeholder="support@yourbrand.com"
              disabled={loading}
            />
          </div>

          <div>
            <div className="label-text">Primary Color</div>
            <label className="color-input-wrapper" style={{ display:'inline-flex', cursor:'pointer' }}>
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
              />
              <span style={{ color:'var(--text-1)', fontSize:14, fontWeight:500, letterSpacing:'0.02em' }}>
                {primaryColor.toUpperCase()}
              </span>
              <span style={{ fontSize:12, color:'var(--text-3)', marginLeft:4 }}>
                — Click to change
              </span>
            </label>
          </div>

          <div>
            <button className="primary-btn" onClick={handleSave} disabled={saving || loading}>
              {saving ? <Spinner/> : null}
              {saving ? 'Saving…' : 'Save Brand Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── TAB: Notifications ─── */
function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    newTicketAlerts: true,
    weeklyReport: false,
    refundAlerts: true,
  })
  const [toast, setToast] = useState(null)

  function toggle(key) {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  const rows = [
    {
      key: 'emailNotifications',
      title: 'Email Notifications',
      desc: 'Receive email updates on new tickets',
    },
    {
      key: 'newTicketAlerts',
      title: 'New Ticket Alerts',
      desc: 'Get notified when a new ticket arrives',
    },
    {
      key: 'weeklyReport',
      title: 'Weekly Report',
      desc: 'Weekly performance summary every Monday',
    },
    {
      key: 'refundAlerts',
      title: 'Refund Alerts',
      desc: 'Alert when a refund is submitted',
    },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
      <div className="section-header">
        <h2>Notifications</h2>
        <p>Control how and when Lynq alerts you</p>
      </div>

      <div className="settings-card" style={{ animationDelay:'0.05s' }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            className="notification-row"
            style={{ animation:`revealUp 0.3s ease-out ${0.05 + i * 0.07}s both` }}
          >
            <div>
              <div style={{ color:'var(--text-1)', fontWeight:500, fontSize:14, marginBottom:4 }}>
                {row.title}
              </div>
              <div style={{ color:'var(--text-3)', fontSize:13 }}>
                {row.desc}
              </div>
            </div>
            <Toggle on={prefs[row.key]} onChange={() => toggle(row.key)}/>
          </div>
        ))}
      </div>

      <div>
        <button
          className="primary-btn"
          onClick={() => setToast({ message: 'Notification preferences saved', type: 'success' })}
        >
          Save Preferences
        </button>
      </div>
    </div>
  )
}

/* ─── TAB: Security ─── */
function SecurityTab({ session }) {
  const email = session?.user?.email || ''
  const lastSignIn = session?.user?.last_sign_in_at
    ? new Date(session.user.last_sign_in_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Unknown'

  const [current, setCurrent] = useState('')
  const [newPw, setNewPw]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState(null)

  async function handlePasswordChange() {
    if (!newPw || newPw !== confirm) {
      setToast({ message: 'Passwords do not match', type: 'error' })
      return
    }
    if (newPw.length < 8) {
      setToast({ message: 'Password must be at least 8 characters', type: 'error' })
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)
    if (error) {
      setToast({ message: error.message || 'Failed to update password', type: 'error' })
    } else {
      setCurrent(''); setNewPw(''); setConfirm('')
      setToast({ message: 'Password updated successfully', type: 'success' })
    }
  }

  async function handleSignOutAll() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
      <div className="section-header">
        <h2>Security</h2>
        <p>Manage your password and active sessions</p>
      </div>

      {/* Change password */}
      <div className="settings-card" style={{ animationDelay:'0.05s' }}>
        <div style={{ color:'var(--text-1)', fontWeight:600, fontSize:15, marginBottom:20 }}>
          Change Password
        </div>
        <div className="field-group">
          <div>
            <div className="label-text">Current Password</div>
            <PasswordInput value={current} onChange={setCurrent} placeholder="Enter current password"/>
          </div>
          <div>
            <div className="label-text">New Password</div>
            <PasswordInput value={newPw} onChange={setNewPw} placeholder="Min. 8 characters"/>
          </div>
          <div>
            <div className="label-text">Confirm New Password</div>
            <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat new password"/>
          </div>
          <div>
            <button
              className="primary-btn"
              onClick={handlePasswordChange}
              disabled={saving || !newPw || !confirm}
            >
              {saving ? <Spinner/> : null}
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Session info */}
      <div className="settings-card" style={{ animationDelay:'0.12s' }}>
        <div style={{ color:'var(--text-1)', fontWeight:600, fontSize:15, marginBottom:16 }}>
          Current Session
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'var(--text-2)' }}>Signed in as</span>
            <span style={{ fontSize:13, color:'var(--text-1)', fontWeight:500 }}>{email}</span>
          </div>
          <div style={{ height:1, background:'var(--bg-surface-2)' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'var(--text-2)' }}>Last sign-in</span>
            <span style={{ fontSize:13, color:'var(--text-1)', fontWeight:500 }}>{lastSignIn}</span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="settings-card"
        style={{
          animationDelay:'0.18s',
          border:'1px solid rgba(248,113,113,0.15)',
          background:'rgba(248,113,113,0.03)',
        }}
      >
        <div style={{ color:'#f87171', fontWeight:600, fontSize:15, marginBottom:8 }}>
          Danger Zone
        </div>
        <div style={{ color:'var(--text-3)', fontSize:13, marginBottom:16 }}>
          Signing out of all sessions will immediately invalidate all active tokens across all devices.
        </div>
        <button className="danger-btn" onClick={handleSignOutAll}>
          <IconLogOut/>
          Sign out of all sessions
        </button>
      </div>
    </div>
  )
}

/* ─── MAIN PAGE ─── */
const TABS = [
  { id: 'profile',       label: 'Profile',       icon: <IconUser/> },
  { id: 'integrations',  label: 'Integrations',  icon: <IconLink/> },
  { id: 'brand',         label: 'Brand',         icon: <IconPalette/> },
  { id: 'notifications', label: 'Notifications', icon: <IconBell/> },
  { id: 'security',      label: 'Security',      icon: <IconShield/> },
]

export default function SettingsPage() {
  const [session, setSession]   = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setSession(session)
    })
  }, [])

  if (!mounted || !session) return null

  function renderContent() {
    switch (activeTab) {
      case 'profile':       return <ProfileTab session={session}/>
      case 'integrations':  return <IntegrationsTab session={session}/>
      case 'brand':         return <BrandTab session={session}/>
      case 'notifications': return <NotificationsTab/>
      case 'security':      return <SecurityTab session={session}/>
      default:              return null
    }
  }

  return (
    <div className="settings-root" style={{ display:'flex', minHeight:'100vh', background:'var(--bg-page)' }}>
      <style>{CSS}</style>
      <Sidebar/>

      <main
        className="scrollbar-thin"
        style={{ flex:1, overflowY:'auto', padding:'40px 48px' }}
      >
        <div style={{ maxWidth:900, margin:'0 auto' }}>

          {/* Page header */}
          <div style={{ marginBottom:32, animation:'revealUp 0.4s ease-out both' }}>
            <h1 style={{
              fontSize:28, fontWeight:800, letterSpacing:'-0.03em',
              color:'var(--text-1)',
            }}>
              Settings
            </h1>
            <p style={{ fontSize:14, color:'var(--text-3)', marginTop:6 }}>
              Manage your account, integrations and preferences
            </p>
          </div>

          {/* Grid: nav + content */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'200px 1fr',
            gap:32,
            alignItems:'start',
          }}>

            {/* Left nav */}
            <nav
              style={{
                background:'var(--bg-surface-2)',
                border:'1px solid var(--border)',
                borderRadius:14,
                padding:'8px',
                display:'flex',
                flexDirection:'column',
                gap:2,
                position:'sticky',
                top:0,
                animation:'revealUp 0.4s ease-out 0.06s both',
              }}
            >
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span style={{ flexShrink:0, display:'flex' }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {activeTab === tab.id && (
                    <span style={{
                      width:5, height:5, borderRadius:'50%',
                      background:'#A175FC',
                      marginLeft:'auto',
                      flexShrink:0,
                      boxShadow:'0 0 6px #A175FC',
                    }}/>
                  )}
                </button>
              ))}
            </nav>

            {/* Right content */}
            <div key={activeTab} style={{ animation:'slideIn 0.25s ease-out both' }}>
              {renderContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
