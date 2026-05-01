'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { ChevronRight } from 'lucide-react'

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  .sg-root * { box-sizing: border-box; }
  .sg-root {
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #F8F7FA;
    min-height: 100vh;
  }

  .sg-input {
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
  .sg-input:focus {
    border-color: #A175FC;
    box-shadow: 0 0 0 3px rgba(161,117,252,0.12);
  }
  .sg-input:disabled {
    background: #F8F7FA;
    color: #9B91A8;
    cursor: not-allowed;
  }
  .sg-input::placeholder { color: #9B91A8; }

  .sg-select {
    width: 100%;
    border: 1px solid #E5E0EB;
    border-radius: 8px;
    padding: 9px 36px 9px 12px;
    font-size: 14px;
    color: #1C0F36;
    background: #FFFFFF;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239B91A8' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    line-height: 1.5;
  }
  .sg-select:focus {
    border-color: #A175FC;
    box-shadow: 0 0 0 3px rgba(161,117,252,0.12);
  }

  .sg-btn-primary {
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
    transition: background 0.15s, opacity 0.15s;
    outline: none;
  }
  .sg-btn-primary:hover:not(:disabled) { background: #B990FF; }
  .sg-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
  .sg-btn-primary:focus-visible { outline: 2px solid #A175FC; outline-offset: 2px; }

  .sg-btn-secondary {
    background: #FFFFFF;
    color: #6B5E7B;
    border: 1px solid #E5E0EB;
    border-radius: 8px;
    padding: 9px 16px;
    font-size: 14px;
    font-weight: 500;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s, border-color 0.15s;
    outline: none;
  }
  .sg-btn-secondary:hover { background: #F8F7FA; border-color: #C8C0D4; }
  .sg-btn-secondary:focus-visible { outline: 2px solid #A175FC; outline-offset: 2px; }

  .sg-btn-ghost-red {
    background: transparent;
    color: #EF4444;
    border: none;
    border-radius: 8px;
    padding: 9px 16px;
    font-size: 14px;
    font-weight: 500;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s;
    outline: none;
  }
  .sg-btn-ghost-red:hover { background: rgba(239,68,68,0.07); }
  .sg-btn-ghost-red:focus-visible { outline: 2px solid #EF4444; outline-offset: 2px; }

  .sg-btn-destructive {
    background: #EF4444;
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    padding: 9px 16px;
    font-size: 14px;
    font-weight: 600;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s;
    outline: none;
  }
  .sg-btn-destructive:hover { background: #DC2626; }
  .sg-btn-destructive:focus-visible { outline: 2px solid #EF4444; outline-offset: 2px; }

  .sg-toggle-track {
    width: 44px;
    height: 24px;
    border-radius: 12px;
    position: relative;
    cursor: pointer;
    transition: background 0.25s;
    flex-shrink: 0;
    border: none;
    padding: 0;
    outline: none;
  }
  .sg-toggle-track:focus-visible {
    outline: 2px solid #A175FC;
    outline-offset: 2px;
  }
  .sg-toggle-thumb {
    position: absolute;
    top: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #FFFFFF;
    transition: left 0.25s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  }

  .sg-radio-option {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }
  .sg-radio-circle {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #E5E0EB;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: border-color 0.15s;
  }
  .sg-radio-circle.checked {
    border-color: #A175FC;
    background: #A175FC;
  }
  .sg-radio-circle.checked::after {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #FFFFFF;
  }

  @keyframes sg-toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sg-toast-out {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  .sg-toast {
    position: fixed;
    bottom: 32px;
    right: 32px;
    background: #FFFFFF;
    border: 1px solid rgba(161,117,252,0.3);
    border-radius: 10px;
    padding: 12px 18px;
    color: #1C0F36;
    font-size: 14px;
    font-weight: 500;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    z-index: 9999;
    animation: sg-toast-in 0.25s ease-out both;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 320px;
  }
  .sg-toast.error {
    border-color: rgba(239,68,68,0.3);
  }

  @keyframes sg-overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sg-dialog-in {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`

/* ─────────────────────────────────────────────
   Helper: SettingsHeader
───────────────────────────────────────────── */
function SettingsHeader({ breadcrumb, title, subtitle }) {
  return (
    <div style={{
      borderBottom: '1px solid #F0EDF4',
      paddingBottom: 24,
      marginBottom: 32,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: '#9B91A8',
        marginBottom: 6,
        flexWrap: 'wrap',
      }}>
        {breadcrumb.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <ChevronRight size={12} strokeWidth={1.75} />}
            <span>{crumb}</span>
          </span>
        ))}
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1C0F36', margin: '0 0 4px 0', lineHeight: 1.2 }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: 14, color: '#6B5E7B', margin: 0, lineHeight: 1.6 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Helper: SettingsSection
───────────────────────────────────────────── */
function SettingsSection({ title, description, children }) {
  return (
    <div>
      <h3 style={{
        fontSize: 18,
        fontWeight: 500,
        color: '#1C0F36',
        margin: `0 0 ${description ? '4px' : '16px'} 0`,
        lineHeight: 1.3,
      }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 14, color: '#6B5E7B', margin: '0 0 16px 0', lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Helper: SettingsCard
───────────────────────────────────────────── */
function SettingsCard({ children, footer, style }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E0EB',
      borderRadius: 12,
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{ padding: 24 }}>
        {children}
      </div>
      {footer && (
        <div style={{
          borderTop: '1px solid #F0EDF4',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Helper: SettingsField
───────────────────────────────────────────── */
function SettingsField({ label, helpText, error, children }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
          {label}
        </div>
      )}
      {children}
      {helpText && !error && (
        <div style={{ fontSize: 12, color: '#9B91A8', marginTop: 4 }}>{helpText}</div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{error}</div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Helper: Toggle
───────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <button
      className="sg-toggle-track"
      onClick={() => onChange(!on)}
      style={{ background: on ? '#A175FC' : '#E5E0EB' }}
      aria-checked={on}
      role="switch"
      type="button"
    >
      <div className="sg-toggle-thumb" style={{ left: on ? '23px' : '3px' }} />
    </button>
  )
}

/* ─────────────────────────────────────────────
   Helper: RadioGroup
───────────────────────────────────────────── */
function RadioGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {options.map(opt => (
        <label key={opt.value} className="sg-radio-option" onClick={() => onChange(opt.value)}>
          <span className={`sg-radio-circle${value === opt.value ? ' checked' : ''}`} />
          <span style={{ fontSize: 14, color: value === opt.value ? '#1C0F36' : '#6B5E7B' }}>
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Helper: ConfirmDialog
───────────────────────────────────────────── */
function ConfirmDialog({ open, title, message, confirmText, typeToConfirm, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && open) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const canConfirm = typeToConfirm ? typed === typeToConfirm : true

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'sg-overlay-in 0.15s ease-out',
      }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E0EB',
        borderRadius: 12,
        padding: 28,
        maxWidth: 420,
        width: '90%',
        animation: 'sg-dialog-in 0.2s ease-out',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1C0F36', margin: '0 0 8px 0' }}>{title}</h3>
        <p style={{ fontSize: 14, color: '#6B5E7B', margin: '0 0 20px 0', lineHeight: 1.6 }}>{message}</p>
        {typeToConfirm && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#6B5E7B', marginBottom: 6 }}>
              Type <strong style={{ color: '#1C0F36' }}>{typeToConfirm}</strong> to confirm:
            </div>
            <input
              className="sg-input"
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={typeToConfirm}
              autoFocus
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="sg-btn-secondary" onClick={onCancel} type="button">Cancel</button>
          <button
            className="sg-btn-destructive"
            onClick={onConfirm}
            disabled={!canConfirm}
            type="button"
            style={{ opacity: canConfirm ? 1 : 0.45, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Helper: Toast
───────────────────────────────────────────── */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`sg-toast${type === 'error' ? ' error' : ''}`}>
      {type !== 'error' && (
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(74,222,128,0.15)',
          border: '1px solid rgba(74,222,128,0.4)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#4ade80', flexShrink: 0, fontSize: 11, fontWeight: 700,
        }}>
          ✓
        </span>
      )}
      {message}
    </div>
  )
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function WorkspaceGeneralPage() {
  const [session, setSession] = useState(null)
  const [toast, setToast] = useState(null)

  // Section 1: Workspace identity
  const [name, setName] = useState('Lynq & Flow')
  const [url, setUrl] = useState('lynqflow')
  const [logoPreview, setLogoPreview] = useState(null)
  const fileInputRef = useRef(null)
  const [initIdentity, setInitIdentity] = useState({ name: 'Lynq & Flow', url: 'lynqflow', logo: null })

  // Section 2: Regional settings
  const [timezone, setTimezone] = useState('Europe/Amsterdam')
  const [language, setLanguage] = useState('en')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [timeFormat, setTimeFormat] = useState('24h')
  const [firstDay, setFirstDay] = useState('Monday')
  const [initRegional, setInitRegional] = useState({ timezone: 'Europe/Amsterdam', language: 'en', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', firstDay: 'Monday' })

  // Section 3: Preferences toggles
  const [toggles, setToggles] = useState({
    showOrderData: true,
    autoTranslate: false,
    allowDelete: false,
  })
  const [initToggles, setInitToggles] = useState({
    showOrderData: true,
    autoTranslate: false,
    allowDelete: false,
  })

  // Danger zone dialogs
  const [transferOpen, setTransferOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setSession(session)
    })
  }, [])

  // Dirty checks
  const identityDirty = (
    name !== initIdentity.name ||
    url !== initIdentity.url ||
    logoPreview !== initIdentity.logo
  )
  const regionalDirty = (
    timezone !== initRegional.timezone ||
    language !== initRegional.language ||
    dateFormat !== initRegional.dateFormat ||
    timeFormat !== initRegional.timeFormat ||
    firstDay !== initRegional.firstDay
  )
  const togglesDirty = (
    toggles.showOrderData !== initToggles.showOrderData ||
    toggles.autoTranslate !== initToggles.autoTranslate ||
    toggles.allowDelete !== initToggles.allowDelete
  )

  function handleSaveIdentity() {
    setInitIdentity({ name, url, logo: logoPreview })
    showToast('Workspace identity saved')
  }

  function handleSaveRegional() {
    setInitRegional({ timezone, language, dateFormat, timeFormat, firstDay })
    showToast('Regional settings saved')
  }

  function handleSaveToggles() {
    setInitToggles({ ...toggles })
    showToast('Preferences saved')
  }

  function handleLogoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleRemoveLogo() {
    setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!session) return null

  const TIMEZONES = [
    'Europe/Amsterdam', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'Europe/Madrid', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Sao_Paulo', 'Asia/Tokyo', 'Asia/Singapore',
    'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
  ]

  return (
    <div className="sg-root">
      <style>{CSS}</style>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <ConfirmDialog
        open={transferOpen}
        title="Transfer workspace ownership"
        message="Are you sure you want to transfer ownership of this workspace? This action cannot be undone."
        confirmText="Transfer ownership"
        typeToConfirm="TRANSFER"
        onConfirm={() => { setTransferOpen(false); showToast('Transfer initiated') }}
        onCancel={() => setTransferOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete workspace"
        message="This will permanently delete the workspace and all associated data. This action cannot be undone."
        confirmText="Delete workspace"
        typeToConfirm="DELETE"
        onConfirm={() => { setDeleteOpen(false); showToast('Workspace deletion scheduled', 'error') }}
        onCancel={() => setDeleteOpen(false)}
      />

      <div style={{ maxWidth: 768, margin: '0 auto', padding: '48px 48px' }}>
        <SettingsHeader
          breadcrumb={['Settings', 'Workspace', 'General']}
          title="General"
          subtitle="Manage your workspace identity, regional preferences, and global settings."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

          {/* ── Section 1: Workspace identity ── */}
          <SettingsSection
            title="Workspace identity"
            description="Your workspace name, URL, and logo are shown to all members."
          >
            <SettingsCard footer={
              <button
                className="sg-btn-primary"
                onClick={handleSaveIdentity}
                disabled={!identityDirty}
              >
                Save changes
              </button>
            }>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <SettingsField label="Workspace name">
                  <input
                    className="sg-input"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your workspace name"
                  />
                </SettingsField>

                <SettingsField label="Workspace URL" helpText="Your unique workspace URL on lynqflow.app">
                  <div style={{ display: 'flex' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '9px 12px',
                      fontSize: 14, color: '#9B91A8',
                      background: '#F8F7FA',
                      border: '1px solid #E5E0EB',
                      borderRight: 'none',
                      borderRadius: '8px 0 0 8px',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.5,
                    }}>
                      lynqflow.app/
                    </span>
                    <input
                      className="sg-input"
                      type="text"
                      value={url}
                      onChange={e => setUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="your-workspace"
                      style={{ borderRadius: '0 8px 8px 0' }}
                    />
                  </div>
                </SettingsField>

                <SettingsField label="Workspace logo" helpText="PNG or JPG, max 2MB, square recommended">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 4 }}>
                    {/* Preview */}
                    <div style={{
                      width: 80, height: 80,
                      borderRadius: 10,
                      border: '1px solid #E5E0EB',
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: logoPreview ? 'transparent' : '#F0EDF4',
                    }}>
                      {logoPreview
                        ? <img src={logoPreview} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="3" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        )
                      }
                    </div>
                    {/* Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        style={{ display: 'none' }}
                        onChange={handleLogoFile}
                      />
                      <button
                        className="sg-btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        Upload image
                      </button>
                      {logoPreview && (
                        <button className="sg-btn-ghost-red" onClick={handleRemoveLogo} type="button">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </SettingsField>
              </div>
            </SettingsCard>
          </SettingsSection>

          {/* ── Section 2: Regional settings ── */}
          <SettingsSection
            title="Regional settings"
            description="Control how dates, times, and languages appear across your workspace."
          >
            <SettingsCard footer={
              <button
                className="sg-btn-primary"
                onClick={handleSaveRegional}
                disabled={!regionalDirty}
              >
                Save changes
              </button>
            }>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <SettingsField label="Timezone">
                  <select
                    className="sg-select"
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                    ))}
                  </select>
                </SettingsField>

                <SettingsField label="Default language">
                  <select
                    className="sg-select"
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="nl">Nederlands</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                  </select>
                </SettingsField>

                <SettingsField label="Date format">
                  <RadioGroup
                    options={[
                      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                    ]}
                    value={dateFormat}
                    onChange={setDateFormat}
                  />
                </SettingsField>

                <SettingsField label="Time format">
                  <RadioGroup
                    options={[
                      { value: '12h', label: '12-hour' },
                      { value: '24h', label: '24-hour' },
                    ]}
                    value={timeFormat}
                    onChange={setTimeFormat}
                  />
                </SettingsField>

                <SettingsField label="First day of week">
                  <RadioGroup
                    options={[
                      { value: 'Sunday', label: 'Sunday' },
                      { value: 'Monday', label: 'Monday' },
                    ]}
                    value={firstDay}
                    onChange={setFirstDay}
                  />
                </SettingsField>
              </div>
            </SettingsCard>
          </SettingsSection>

          {/* ── Section 3: Workspace preferences ── */}
          <SettingsSection
            title="Workspace preferences"
            description="Global feature toggles that apply to all agents in this workspace."
          >
            <SettingsCard footer={
              <button
                className="sg-btn-primary"
                onClick={handleSaveToggles}
                disabled={!togglesDirty}
              >
                Save changes
              </button>
            }>
              {[
                {
                  key: 'showOrderData',
                  title: 'Show order data inline in tickets',
                  desc: 'Display Shopify order details directly inside ticket view',
                },
                {
                  key: 'autoTranslate',
                  title: 'Auto-translate customer messages',
                  desc: 'Automatically translate non-English messages using AI',
                },
                {
                  key: 'allowDelete',
                  title: 'Allow agents to delete tickets',
                  desc: 'Agents can permanently delete tickets (cannot be undone)',
                },
              ].map((row, i, arr) => (
                <div
                  key={row.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: i === 0 ? 0 : 16,
                    paddingBottom: i === arr.length - 1 ? 0 : 16,
                    borderBottom: i === arr.length - 1 ? 'none' : '1px solid #F0EDF4',
                  }}
                >
                  <div style={{ flex: 1, paddingRight: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1C0F36', marginBottom: 2 }}>
                      {row.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#9B91A8', lineHeight: 1.5 }}>
                      {row.desc}
                    </div>
                  </div>
                  <Toggle
                    on={toggles[row.key]}
                    onChange={val => setToggles(prev => ({ ...prev, [row.key]: val }))}
                  />
                </div>
              ))}
            </SettingsCard>
          </SettingsSection>

          {/* ── Section 4: Danger zone ── */}
          <SettingsSection title="Danger zone">
            <div style={{
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {/* Danger header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(239,68,68,0.12)',
                background: 'rgba(239,68,68,0.02)',
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 500, color: '#EF4444', margin: '0 0 4px 0' }}>
                  Danger zone
                </h3>
                <p style={{ fontSize: 13, color: '#9B91A8', margin: 0 }}>
                  These actions are irreversible. Please proceed with caution.
                </p>
              </div>

              {/* Row 1: Transfer */}
              <div style={{
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(239,68,68,0.08)',
                gap: 24,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1C0F36', marginBottom: 2 }}>
                    Transfer ownership
                  </div>
                  <div style={{ fontSize: 13, color: '#9B91A8' }}>
                    Transfer this workspace to another member
                  </div>
                </div>
                <button
                  className="sg-btn-secondary"
                  onClick={() => setTransferOpen(true)}
                  type="button"
                  style={{ flexShrink: 0 }}
                >
                  Transfer...
                </button>
              </div>

              {/* Row 2: Delete */}
              <div style={{
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#EF4444', marginBottom: 2 }}>
                    Delete workspace
                  </div>
                  <div style={{ fontSize: 13, color: '#9B91A8' }}>
                    Permanently delete this workspace and all data
                  </div>
                </div>
                <button
                  className="sg-btn-destructive"
                  onClick={() => setDeleteOpen(true)}
                  type="button"
                  style={{ flexShrink: 0 }}
                >
                  Delete workspace...
                </button>
              </div>
            </div>
          </SettingsSection>

        </div>
      </div>
    </div>
  )
}
