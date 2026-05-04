'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Loader2, Check, AlertCircle, X, Trash2,
  Monitor, Moon, Sun,
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const THEMES = [
  { value: 'system', label: 'System', desc: 'Match your device setting', Icon: Monitor },
  { value: 'dark',   label: 'Dark',   desc: 'Always use dark mode',     Icon: Moon    },
  { value: 'light',  label: 'Light',  desc: 'Always use light mode',    Icon: Sun     },
]

const CSS = `
  .pp-root { font-family: 'Rethink Sans', sans-serif; color: #1C0F36; }
  .pp-wrap { max-width: 768px; margin: 0 auto; padding: 48px 40px; }

  .pp-title { font-size: 22px; font-weight: 600; color: #1C0F36; margin: 0 0 4px; }
  .pp-subtitle { font-size: 14px; color: #6B5E7B; margin: 0 0 32px; }

  .pp-section {
    background: #fff; border: 1px solid #E5E0EB; border-radius: 12px;
    padding: 28px; margin-bottom: 20px;
  }
  .pp-section-title { font-size: 16px; font-weight: 600; color: #1C0F36; margin: 0 0 4px; }
  .pp-section-desc  { font-size: 13px; color: #6B5E7B; margin: 0 0 20px; }

  /* Personal info layout: form + avatar side-by-side */
  .pp-info-grid { display: grid; grid-template-columns: 1fr 140px; gap: 32px; align-items: flex-start; }
  @media (max-width: 600px) { .pp-info-grid { grid-template-columns: 1fr; } }

  .pp-field { margin-bottom: 16px; }
  .pp-field:last-child { margin-bottom: 0; }
  .pp-label { display: block; font-size: 13px; font-weight: 500; color: #1C0F36; margin-bottom: 6px; }
  .pp-input, .pp-textarea {
    width: 100%; padding: 9px 12px; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-family: inherit; color: #1C0F36; outline: none; box-sizing: border-box;
    background: #fff; transition: border-color 0.15s;
  }
  .pp-input:focus, .pp-textarea:focus {
    border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15);
  }
  .pp-input.error { border-color: #FCA5A5; box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
  .pp-input:disabled { background: #F8F7FA; color: #6B5E7B; cursor: not-allowed; }
  .pp-textarea { resize: vertical; min-height: 80px; line-height: 1.5; font-family: inherit; }
  .pp-hint { margin: 5px 0 0; font-size: 11px; color: #9B91A8; }
  .pp-fielderr { margin: 5px 0 0; font-size: 12px; color: #DC2626; }
  .pp-counter { float: right; }

  /* Avatar */
  .pp-avatar-col { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .pp-avatar {
    width: 96px; height: 96px; border-radius: 50%; background: #EDE5FE;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
    color: #A175FC; font-size: 26px; font-weight: 600; position: relative;
  }
  .pp-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .pp-avatar-overlay {
    position: absolute; inset: 0; background: rgba(28,15,54,0.45); border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: #fff;
  }
  .pp-avatar-help { font-size: 11px; color: #9B91A8; text-align: center; line-height: 1.4; max-width: 140px; }
  .pp-avatar-actions { display: flex; gap: 6px; }

  /* Theme cards */
  .pp-theme-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 600px) { .pp-theme-grid { grid-template-columns: 1fr; } }
  .pp-theme-card {
    border: 2px solid #E5E0EB; border-radius: 10px; padding: 14px 16px;
    cursor: pointer; background: #fff; position: relative;
    transition: border-color 0.15s, background 0.15s;
    display: flex; flex-direction: column; gap: 6px; text-align: left;
    font-family: inherit;
  }
  .pp-theme-card:hover { border-color: #C4A8FD; background: #F7F3FF; }
  .pp-theme-card.selected { border-color: #A175FC; background: #F7F3FF; }
  .pp-theme-icon { color: #6B5E7B; }
  .pp-theme-card.selected .pp-theme-icon { color: #A175FC; }
  .pp-theme-name { font-size: 14px; font-weight: 600; color: #1C0F36; }
  .pp-theme-desc { font-size: 12px; color: #9B91A8; }
  .pp-theme-check {
    position: absolute; top: 10px; right: 10px;
    width: 20px; height: 20px; border-radius: 50%; background: #A175FC;
    display: flex; align-items: center; justify-content: center; color: #fff;
  }

  /* Sticky footer */
  .pp-footer {
    position: sticky; bottom: 0; background: #F8F7FA;
    padding: 12px 0; margin-top: 24px;
    display: flex; gap: 8px; justify-content: flex-end;
    border-top: 1px solid #E5E0EB;
  }
  .pp-dirty {
    font-size: 12px; color: #9B91A8; align-self: center; margin-right: auto;
  }

  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px;
    background: #A175FC; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary:hover:not(:disabled) { background: #8B5CF6; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px;
    background: #fff; color: #1C0F36; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer;
  }
  .btn-secondary:hover:not(:disabled) { background: #F8F7FA; }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-icon-danger {
    width: 30px; height: 30px; padding: 0; border-radius: 6px;
    background: #fff; border: 1px solid #FECACA; color: #B91C1C;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .btn-icon-danger:hover:not(:disabled) { background: #FEF2F2; }
  .btn-icon-danger:disabled { opacity: 0.5; cursor: not-allowed; }

  .pp-loading { display: flex; align-items: center; justify-content: center; padding: 80px 24px; gap: 10px; color: #9B91A8; font-size: 14px; }

  /* Toast */
  .pp-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    display: flex; align-items: center; gap: 10px; padding: 11px 12px 11px 14px;
    border-radius: 10px; font-size: 14px; font-family: inherit; font-weight: 500;
    box-shadow: 0 8px 24px rgba(28,15,54,0.16); animation: pp-slide 0.2s ease; max-width: 420px;
  }
  .pp-toast-ok  { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
  .pp-toast-ok  .pp-toast-icon { color: #10B981; }
  .pp-toast-err { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
  .pp-toast-err .pp-toast-icon { color: #DC2626; }
  .pp-toast-msg { flex: 1; min-width: 0; }
  .pp-toast-close {
    border: none; background: transparent; cursor: pointer; color: inherit;
    padding: 4px; border-radius: 6px; flex-shrink: 0; opacity: 0.6;
    display: flex; align-items: center; justify-content: center;
  }
  .pp-toast-close:hover { opacity: 1; background: rgba(0,0,0,0.04); }
  @keyframes pp-slide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

function initials(name, email) {
  const src = (name || email || '?').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export default function ProfilePage() {
  const [loading,    setLoading]    = useState(true)
  const [apiError,   setApiError]   = useState(null)

  // Saved (server) values — what the form gets compared against to detect dirty state
  const [saved, setSaved] = useState({
    email:        '',
    display_name: '',
    bio:          '',
    avatar_url:   null,
    theme:        'system',
  })

  // Editable form state
  const [name,  setName]  = useState('')
  const [bio,   setBio]   = useState('')
  const [theme, setTheme] = useState('system')

  // Avatar handling
  const [avatarUrl,    setAvatarUrl]    = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [saving,    setSaving]    = useState(false)
  const [nameError, setNameError] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)
  }, [])
  const showToast = (msg, type = 'ok') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, type })
    if (type === 'ok') toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const loadProfile = useCallback(async () => {
    const token = await getToken()
    if (!token) { setApiError('Not authenticated.'); setLoading(false); return }
    const res  = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setApiError(body.error || `Request failed (${res.status})`)
      setLoading(false)
      return
    }
    const data = await res.json()
    const p = data.profile
    setSaved({
      email:        p.email ?? '',
      display_name: p.display_name ?? '',
      bio:          p.bio ?? '',
      avatar_url:   p.avatar_url ?? null,
      theme:        p.theme ?? 'system',
    })
    setName(p.display_name ?? '')
    setBio(p.bio ?? '')
    setTheme(p.theme ?? 'system')
    setAvatarUrl(p.avatar_url ?? null)
    setApiError(null)
    setLoading(false)
  }, [getToken])

  useEffect(() => {
    setLoading(true)
    loadProfile()
  }, [loadProfile])

  const isDirty =
    name.trim() !== (saved.display_name || '') ||
    bio.trim()  !== (saved.bio || '') ||
    theme       !== saved.theme

  const canSave = isDirty && !saving && !!name.trim()

  async function handleSave() {
    setNameError(null)
    if (!name.trim()) { setNameError('Name is required'); return }
    if (name.trim().length > 50) { setNameError('Name must be 50 characters or less'); return }

    setSaving(true)
    const token = await getToken()
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        display_name: name.trim(),
        bio:          bio.trim(),
        theme,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok || !data.profile) {
      showToast(data.error || 'Failed to save profile', 'err')
      return
    }
    const p = data.profile
    setSaved({
      email:        p.email ?? '',
      display_name: p.display_name ?? '',
      bio:          p.bio ?? '',
      avatar_url:   p.avatar_url ?? null,
      theme:        p.theme ?? 'system',
    })
    showToast('Profile updated')
  }

  async function handleAvatarFile(file) {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      showToast('Only PNG or JPG images are allowed.', 'err')
      return
    }
    if (file.size > 500 * 1024) {
      showToast('File is larger than 500KB.', 'err')
      return
    }

    setAvatarUploading(true)
    const token = await getToken()
    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/profile/avatar', {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    fd,
    })
    const data = await res.json().catch(() => ({}))
    setAvatarUploading(false)

    if (!res.ok || !data.avatar_url) {
      showToast(data.error || 'Failed to upload avatar', 'err')
      return
    }
    setAvatarUrl(data.avatar_url)
    setSaved(prev => ({ ...prev, avatar_url: data.avatar_url }))
    showToast('Avatar updated')
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true)
    const token = await getToken()
    const res = await fetch('/api/profile/avatar', {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setAvatarUploading(false)
    if (!res.ok) {
      showToast('Failed to remove avatar', 'err')
      return
    }
    setAvatarUrl(null)
    setSaved(prev => ({ ...prev, avatar_url: null }))
    showToast('Avatar removed')
  }

  if (loading) {
    return (
      <div className="pp-root">
        <style>{CSS}</style>
        <div className="pp-wrap">
          <div className="pp-loading">
            <Loader2 size={18} strokeWidth={1.75} className="spin" />
            Loading profile…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pp-root">
      <style>{CSS}</style>
      <div className="pp-wrap">
        <h1 className="pp-title">Your profile</h1>
        <p className="pp-subtitle">Manage how you appear across the workspace.</p>

        {apiError && (
          <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#DC2626', alignItems: 'flex-start' }}>
            <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{apiError}</span>
          </div>
        )}

        {/* Personal information */}
        <div className="pp-section">
          <h2 className="pp-section-title">Personal information</h2>
          <p className="pp-section-desc">Your name and bio appear on tickets and email signatures.</p>

          <div className="pp-info-grid">
            <div>
              <div className="pp-field">
                <label className="pp-label" htmlFor="pp-name">Your name</label>
                <input
                  id="pp-name"
                  type="text"
                  className={`pp-input${nameError ? ' error' : ''}`}
                  value={name}
                  onChange={e => { setName(e.target.value); if (nameError) setNameError(null) }}
                  maxLength={50}
                  placeholder="Jane Smith"
                />
                {nameError && <p className="pp-fielderr">{nameError}</p>}
              </div>

              <div className="pp-field">
                <label className="pp-label" htmlFor="pp-email">Your email</label>
                <input
                  id="pp-email"
                  type="email"
                  className="pp-input"
                  value={saved.email}
                  disabled
                  readOnly
                />
                <p className="pp-hint">Email is read-only. Contact support to change it.</p>
              </div>

              <div className="pp-field">
                <label className="pp-label" htmlFor="pp-bio">
                  Your bio <span className="pp-counter" style={{ color: '#9B91A8', fontSize: 11, fontWeight: 400 }}>{bio.length}/200</span>
                </label>
                <textarea
                  id="pp-bio"
                  className="pp-textarea"
                  value={bio}
                  onChange={e => setBio(e.target.value.slice(0, 200))}
                  maxLength={200}
                  placeholder="Customer success, based in Amsterdam"
                  rows={3}
                />
                <p className="pp-hint">Used in email signatures.</p>
              </div>
            </div>

            <div className="pp-avatar-col">
              <div className="pp-avatar">
                {avatarUrl
                  ? <img src={avatarUrl} alt="" />
                  : initials(name, saved.email)
                }
                {avatarUploading && (
                  <div className="pp-avatar-overlay">
                    <Loader2 size={22} strokeWidth={1.75} className="spin" />
                  </div>
                )}
              </div>
              <div className="pp-avatar-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  Select a file
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    className="btn-icon-danger"
                    onClick={handleAvatarRemove}
                    disabled={avatarUploading}
                    title="Remove avatar"
                    aria-label="Remove avatar"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''  // allow re-upload of same file
                  if (file) handleAvatarFile(file)
                }}
              />
              <p className="pp-avatar-help">PNG/JPG, max 500KB, square recommended</p>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="pp-section">
          <h2 className="pp-section-title">Theme</h2>
          <p className="pp-section-desc">Saved as your preference. Visual switching ships in a future update.</p>

          <div className="pp-theme-grid">
            {THEMES.map(t => {
              const Icon = t.Icon
              const selected = theme === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  className={`pp-theme-card${selected ? ' selected' : ''}`}
                  onClick={() => setTheme(t.value)}
                  aria-pressed={selected}
                >
                  {selected && (
                    <span className="pp-theme-check"><Check size={12} strokeWidth={2.5} /></span>
                  )}
                  <span className="pp-theme-icon"><Icon size={20} strokeWidth={1.75} /></span>
                  <span className="pp-theme-name">{t.label}</span>
                  <span className="pp-theme-desc">{t.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="pp-footer">
          {isDirty && <span className="pp-dirty">Unsaved changes</span>}
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving
              ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Saving…</>
              : <>Save changes</>
            }
          </button>
        </div>
      </div>

      {toast && (
        <div className={`pp-toast pp-toast-${toast.type}`} role="status" aria-live="polite">
          <span className="pp-toast-icon">
            {toast.type === 'err'
              ? <AlertCircle size={16} strokeWidth={1.75} />
              : <Check size={16} strokeWidth={2} />
            }
          </span>
          <span className="pp-toast-msg">{toast.msg}</span>
          <button type="button" className="pp-toast-close" onClick={dismissToast} aria-label="Dismiss">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
