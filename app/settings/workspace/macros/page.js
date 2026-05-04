'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  Plus, Search, MoreHorizontal, FileText, AlertCircle, Loader2, Check, X,
  Edit2, Copy, Archive, ArchiveRestore, Trash2, Sparkles,
} from 'lucide-react'
import { TAG_PALETTE } from '../../../../lib/tags'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LANGUAGES = [
  { value: '',     label: 'All languages' },
  { value: 'auto', label: 'Auto detect' },
  { value: 'en',   label: 'English' },
  { value: 'nl',   label: 'Dutch' },
  { value: 'fr',   label: 'French' },
  { value: 'de',   label: 'German' },
  { value: 'es',   label: 'Spanish' },
  { value: 'it',   label: 'Italian' },
]
const LANG_LABEL = Object.fromEntries(LANGUAGES.map(l => [l.value || 'all', l.label]))

const CSS = `
  .mp-root { font-family: 'Rethink Sans', sans-serif; color: #1C0F36; }
  .mp-wrap { max-width: 1100px; margin: 0 auto; padding: 48px 40px; }

  .mp-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; }
  .mp-title { font-size: 22px; font-weight: 600; color: #1C0F36; margin: 0 0 4px; }
  .mp-subtitle { font-size: 14px; color: #6B5E7B; margin: 0; }

  .mp-tabs { display: flex; gap: 4px; border-bottom: 1px solid #E5E0EB; margin-bottom: 16px; }
  .mp-tab {
    padding: 10px 14px; border: none; background: none; font-family: inherit;
    font-size: 14px; color: #6B5E7B; cursor: pointer; border-bottom: 2px solid transparent;
    margin-bottom: -1px; transition: color 0.15s, border-color 0.15s;
  }
  .mp-tab:hover { color: #1C0F36; }
  .mp-tab.active { color: #A175FC; border-bottom-color: #A175FC; font-weight: 500; }
  .mp-tab-count { margin-left: 6px; font-size: 11px; color: #9B91A8; background: #F1EEF5; padding: 1px 6px; border-radius: 10px; }
  .mp-tab.active .mp-tab-count { background: #EDE5FE; color: #7C3AED; }

  .mp-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .mp-search-wrap { position: relative; flex: 1; min-width: 220px; max-width: 320px; }
  .mp-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9B91A8; pointer-events: none; }
  .mp-search {
    width: 100%; padding: 8px 12px 8px 34px; border: 1px solid #E5E0EB;
    border-radius: 8px; font-size: 14px; font-family: inherit; color: #1C0F36;
    background: #fff; outline: none; transition: border-color 0.15s; box-sizing: border-box;
  }
  .mp-search:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }
  .mp-select {
    padding: 8px 32px 8px 12px; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 13px; font-family: inherit; color: #1C0F36; background: #fff;
    -webkit-appearance: none; appearance: none; cursor: pointer; outline: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239B91A8' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
  }
  .mp-select:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }

  .mp-tags-input-wrap { position: relative; min-width: 200px; }
  .mp-tags-input {
    padding: 8px 12px; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 13px; font-family: inherit; color: #1C0F36; background: #fff; outline: none;
    width: 200px;
  }
  .mp-tags-input:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }

  .mp-table-wrap { border: 1px solid #E5E0EB; border-radius: 12px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th {
    padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; color: #9B91A8;
    background: #F8F7FA; border-bottom: 1px solid #E5E0EB;
  }
  td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #F0EDF4; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr.mp-row:hover td { background: #FAFAFB; }

  .mp-name-cell { display: flex; align-items: center; gap: 10px; }
  .mp-name-icon {
    width: 32px; height: 32px; border-radius: 8px; background: #F1F5F9;
    display: flex; align-items: center; justify-content: center;
    color: #6B5E7B; flex-shrink: 0;
  }
  .mp-name {
    font-weight: 500; color: #1C0F36; font-size: 14px; cursor: pointer;
    background: none; border: none; padding: 0; text-align: left; font-family: inherit;
  }
  .mp-name:hover { color: #A175FC; }

  .mp-tag-pill {
    display: inline-flex; align-items: center; padding: 1px 8px; margin-right: 4px;
    background: #F1F5F9; color: #475569; border-radius: 20px; font-size: 11px; font-weight: 500;
  }
  .mp-lang-pill {
    display: inline-flex; align-items: center; padding: 2px 9px;
    background: #F8F7FA; color: #6B5E7B; border-radius: 6px; font-size: 12px;
  }
  .mp-usage-pill {
    display: inline-flex; align-items: center; padding: 2px 9px;
    background: #F1F5F9; color: #1E293B; border-radius: 20px; font-size: 12px; font-weight: 500;
  }
  .mp-usage-zero { color: #9B91A8; font-size: 12px; }

  .mp-relative-time { font-size: 13px; color: #6B5E7B; }

  .mp-actions { text-align: right; position: relative; }
  .mp-dot-btn {
    width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    color: #9B91A8; transition: background 0.15s, color 0.15s;
  }
  .mp-dot-btn:hover { background: #F1EEF5; color: #1C0F36; }
  .mp-dot-btn:focus { outline: none; box-shadow: 0 0 0 3px rgba(161,117,252,0.25); }

  .mp-dropdown {
    position: fixed; z-index: 9999;
    background: #fff; border: 1px solid #E5E0EB; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(28,15,54,0.12); min-width: 180px; overflow: hidden;
    padding: 4px 0;
  }
  .mp-dd-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    font-size: 13px; color: #1C0F36; cursor: pointer; background: none; border: none;
    width: 100%; text-align: left; font-family: inherit; transition: background 0.1s;
  }
  .mp-dd-item:hover { background: #F8F7FA; }
  .mp-dd-item.danger { color: #EF4444; }
  .mp-dd-item.danger:hover { background: #FEF2F2; }
  .mp-dd-divider { height: 1px; background: #F0EDF4; margin: 2px 0; }

  .mp-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 64px 24px; text-align: center; gap: 12px;
  }
  .mp-empty-icon {
    width: 56px; height: 56px; border-radius: 14px; background: #F1F5F9;
    display: flex; align-items: center; justify-content: center; color: #94A3B8;
  }
  .mp-empty-title { font-size: 17px; font-weight: 600; color: #1C0F36; margin: 0; }
  .mp-empty-desc { font-size: 14px; color: #9B91A8; margin: 0; max-width: 320px; }

  .mp-error-bar {
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px;
    background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;
    margin-bottom: 16px; font-size: 13px; color: #DC2626;
  }

  /* Skeletons */
  .mp-skel {
    background: linear-gradient(90deg, #F1EEF5 0%, #E5E0EB 50%, #F1EEF5 100%);
    background-size: 200% 100%;
    animation: mp-shimmer 1.6s linear infinite;
    border-radius: 4px;
    display: inline-block;
  }
  .mp-skel-icon { width: 32px; height: 32px; border-radius: 8px; }
  .mp-skel-line { height: 12px; }
  @keyframes mp-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Buttons */
  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: #A175FC; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s; white-space: nowrap; text-decoration: none;
  }
  .btn-primary:hover:not(:disabled) { background: #8B5CF6; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: #fff; color: #1C0F36; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s; text-decoration: none;
  }
  .btn-secondary:hover { background: #F8F7FA; }
  .btn-danger {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: #EF4444; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s;
  }
  .btn-danger:hover:not(:disabled) { background: #DC2626; }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Modal */
  .mp-overlay {
    position: fixed; inset: 0; background: rgba(28,15,54,0.4); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .mp-modal {
    background: #fff; border-radius: 16px; width: 100%; max-width: 440px;
    box-shadow: 0 24px 48px rgba(28,15,54,0.16); overflow: hidden;
  }
  .mp-modal-hd {
    padding: 20px 24px 0; display: flex; align-items: flex-start; justify-content: space-between;
  }
  .mp-modal-title { font-size: 18px; font-weight: 600; color: #1C0F36; }
  .mp-modal-body { padding: 16px 24px 8px; font-size: 14px; color: #1C0F36; line-height: 1.55; }
  .mp-modal-ft { padding: 16px 24px 20px; display: flex; gap: 8px; justify-content: flex-end; }

  /* Toast */
  .mp-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    display: flex; align-items: center; gap: 10px; padding: 11px 12px 11px 14px;
    border-radius: 10px; font-size: 14px; font-family: inherit; font-weight: 500;
    box-shadow: 0 8px 24px rgba(28,15,54,0.16); animation: mp-slide 0.2s ease; max-width: 420px;
  }
  .mp-toast-ok  { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
  .mp-toast-ok  .mp-toast-icon { color: #10B981; }
  .mp-toast-err { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
  .mp-toast-err .mp-toast-icon { color: #DC2626; }
  .mp-toast-msg { flex: 1; min-width: 0; }
  .mp-toast-close {
    border: none; background: transparent; cursor: pointer;
    color: inherit; padding: 4px; border-radius: 6px; flex-shrink: 0;
    opacity: 0.6; display: flex; align-items: center; justify-content: center;
  }
  .mp-toast-close:hover { opacity: 1; background: rgba(0,0,0,0.04); }
  @keyframes mp-slide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function MacrosPage() {
  const router = useRouter()

  const [tab,        setTab]        = useState('active')   // active | archived
  const [macros,     setMacros]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [apiError,   setApiError]   = useState(null)
  const [myRole,     setMyRole]     = useState(null)

  const [search,     setSearch]     = useState('')
  const debouncedSearch             = useDebounce(search, 250)
  const [language,   setLanguage]   = useState('')
  const [tagFilter,  setTagFilter]  = useState('')
  const debouncedTagFilter          = useDebounce(tagFilter, 250)

  const [openMenu,        setOpenMenu]        = useState(null)
  const [dotMenuCoords,   setDotMenuCoords]   = useState(null)
  const dotMenuRef = useRef(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  const [hasOnboarding,    setHasOnboarding]    = useState(false)
  const [showRegenModal,   setShowRegenModal]   = useState(false)
  const [regenerating,     setRegenerating]     = useState(false)
  const [regenError,       setRegenError]       = useState(null)

  const [toast, setToast] = useState(null)
  const toastTimerRef     = useRef(null)

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null }
    setToast(null)
  }, [])

  const showToast = (msg, type = 'ok') => {
    if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null }
    setToast({ msg, type })
    if (type === 'ok') {
      toastTimerRef.current = setTimeout(() => setToast(null), 4000)
    }
  }

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const fetchMacros = useCallback(async () => {
    const token = await getToken()
    if (!token) { setApiError('Not authenticated — please refresh the page.'); setLoading(false); return }

    const params = new URLSearchParams()
    if (tab === 'archived') params.set('archived', 'true')
    if (debouncedSearch)    params.set('search',   debouncedSearch)
    if (language)           params.set('language', language)
    if (debouncedTagFilter) params.set('tags',     debouncedTagFilter)
    const url = `/api/macros${params.toString() ? `?${params}` : ''}`

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setApiError(body.error || `Request failed (${res.status})`)
      setLoading(false)
      return
    }
    const data = await res.json()
    setApiError(null)
    setMacros(data.macros || [])
    setMyRole(data.currentUserRole || null)
    setLoading(false)
  }, [getToken, tab, debouncedSearch, language, debouncedTagFilter])

  useEffect(() => {
    setLoading(true)
    fetchMacros()
  }, [fetchMacros])

  // Pull a one-shot toast from sessionStorage (e.g. wizard redirected here)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('mp:lastToast')
      if (raw) {
        const t = JSON.parse(raw)
        sessionStorage.removeItem('mp:lastToast')
        if (t?.msg) showToast(t.msg, t.type === 'err' ? 'err' : 'ok')
      }
    } catch (_) { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check whether onboarding has been completed (to decide CTA destination)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token) return
      const res  = await fetch('/api/macros/onboarding', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (cancelled) return
      setHasOnboarding(!!data.onboarding?.completed_at)
    })()
    return () => { cancelled = true }
  }, [getToken])

  // Close 3-dot menu on outside click + Escape
  useEffect(() => {
    if (!openMenu) return
    const handler = (e) => {
      if (dotMenuRef.current?.contains(e.target)) return
      if (e.target.closest?.(`[data-dot-trigger="${openMenu}"]`)) return
      setOpenMenu(null)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenu(null) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown',   onKey)
    }
  }, [openMenu])

  const canManage = ['owner', 'admin', 'agent'].includes(myRole)
  const canDelete = ['owner', 'admin'].includes(myRole)

  async function callJson(url, method = 'POST') {
    const token = await getToken()
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  }

  async function handleDuplicate(id) {
    setOpenMenu(null)
    const r = await callJson(`/api/macros/${id}/duplicate`)
    if (!r.ok) { showToast(r.data.error || 'Failed to duplicate', 'err'); return }
    showToast('Macro duplicated')
    fetchMacros()
  }

  async function handleArchive(id) {
    setOpenMenu(null)
    const r = await callJson(`/api/macros/${id}/archive`)
    if (!r.ok) { showToast(r.data.error || 'Failed to archive', 'err'); return }
    showToast('Macro archived')
    fetchMacros()
  }

  async function handleRestore(id) {
    setOpenMenu(null)
    const r = await callJson(`/api/macros/${id}/restore`)
    if (!r.ok) { showToast(r.data.error || 'Failed to restore', 'err'); return }
    showToast('Macro restored')
    fetchMacros()
  }

  async function handleRegenerate() {
    setRegenError(null)
    setRegenerating(true)
    const token = await getToken()
    if (!token) {
      setRegenerating(false)
      setRegenError('Not authenticated. Please refresh.')
      return
    }
    const res  = await fetch('/api/macros/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    setRegenerating(false)
    if (!res.ok || !data.ok) {
      setRegenError(data.error || 'Generation failed. Try again.')
      return
    }
    setShowRegenModal(false)
    showToast(`${data.count} new macros created`)
    fetchMacros()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const token = await getToken()
    const res = await fetch(`/api/macros/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    setDeleting(false)
    if (!res.ok) { showToast(data.error || 'Failed to delete', 'err'); return }
    showToast(`"${deleteTarget.name}" deleted`)
    setDeleteTarget(null)
    setMacros(prev => prev.filter(m => m.id !== deleteTarget.id))
    fetchMacros()
  }

  return (
    <div className="mp-root">
      <style>{CSS}</style>
      <div className="mp-wrap">

        <div className="mp-header">
          <div>
            <h1 className="mp-title">Macros</h1>
            <p className="mp-subtitle">Pre-made responses with variables. Apply to tickets with one click.</p>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {hasOnboarding ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setRegenError(null); setShowRegenModal(true) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid #E5E0EB', background: '#fff',
                    color: '#1C0F36', fontSize: 14, fontWeight: 500,
                    fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <Sparkles size={16} strokeWidth={1.75} />
                  Regenerate
                </button>
              ) : (
                <Link
                  href="/settings/workspace/macros/generate"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid #E5E0EB', background: '#fff',
                    color: '#1C0F36', fontSize: 14, fontWeight: 500,
                    fontFamily: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  <Sparkles size={16} strokeWidth={1.75} />
                  Generate from your store
                </Link>
              )}
              <Link href="/settings/workspace/macros/new" className="btn-primary">
                <Plus size={16} strokeWidth={1.75} />
                Create macro
              </Link>
            </div>
          )}
        </div>

        {apiError && (
          <div className="mp-error-bar">
            <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{apiError}</span>
          </div>
        )}

        <div className="mp-tabs">
          <button className={`mp-tab${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>
            Active
          </button>
          <button className={`mp-tab${tab === 'archived' ? ' active' : ''}`} onClick={() => setTab('archived')}>
            Archived
          </button>
        </div>

        <div className="mp-toolbar">
          <div className="mp-search-wrap">
            <Search size={14} strokeWidth={1.75} className="mp-search-icon" />
            <input
              className="mp-search"
              type="text"
              placeholder="Search macros…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="mp-select" value={language} onChange={e => setLanguage(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.value || 'all'} value={l.value}>{l.label}</option>)}
          </select>
          <input
            className="mp-tags-input"
            type="text"
            placeholder="Filter by tag…"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            title="Comma-separated tags"
          />
        </div>

        <div className="mp-table-wrap">
          {loading ? (
            <table>
              <thead>
                <tr><th>Macro name</th><th>Tags</th><th>Language</th><th>Usage</th><th>Last updated</th><th></th></tr>
              </thead>
              <tbody>
                {[0, 1, 2].map(i => (
                  <tr key={`skel-${i}`}>
                    <td>
                      <div className="mp-name-cell">
                        <div className="mp-skel mp-skel-icon" />
                        <div className="mp-skel mp-skel-line" style={{ width: 160 }} />
                      </div>
                    </td>
                    <td><div className="mp-skel mp-skel-line" style={{ width: 100 }} /></td>
                    <td><div className="mp-skel mp-skel-line" style={{ width: 60 }} /></td>
                    <td><div className="mp-skel mp-skel-line" style={{ width: 30 }} /></td>
                    <td><div className="mp-skel mp-skel-line" style={{ width: 80 }} /></td>
                    <td><div className="mp-skel mp-skel-line" style={{ width: 24 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : macros.length === 0 ? (
            <div className="mp-empty">
              <div className="mp-empty-icon"><FileText size={28} strokeWidth={1.5} /></div>
              <h3 className="mp-empty-title">
                {tab === 'archived' ? 'No archived macros' : (search || language || tagFilter) ? 'No macros match your filters' : 'No macros yet'}
              </h3>
              <p className="mp-empty-desc">
                {tab === 'archived'
                  ? 'Macros you archive will appear here.'
                  : (search || language || tagFilter)
                    ? 'Try clearing some filters or searching for something different.'
                    : 'Create your first macro to start replying faster.'}
              </p>
              {tab === 'active' && !search && !language && !tagFilter && canManage && (
                <Link href="/settings/workspace/macros/new" className="btn-primary">
                  <Plus size={16} strokeWidth={1.75} />
                  Create your first macro
                </Link>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Macro name</th>
                  <th>Tags</th>
                  <th>Language</th>
                  <th>Usage</th>
                  <th>Last updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {macros.map(m => (
                  <tr key={m.id} className="mp-row">
                    <td>
                      <div className="mp-name-cell">
                        <div className="mp-name-icon"><FileText size={16} strokeWidth={1.75} /></div>
                        <button className="mp-name" onClick={() => router.push(`/settings/workspace/macros/${m.id}`)}>
                          {m.name}
                        </button>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        // Prefer tagObjects (colored, from join) over legacy string array
                        const objs = Array.isArray(m.tagObjects) && m.tagObjects.length
                          ? m.tagObjects
                          : (m.tags || []).map(name => ({ name, color: 'slate' }))
                        if (objs.length === 0) {
                          return <span style={{ color: '#9B91A8', fontSize: 12 }}>—</span>
                        }
                        return (
                          <>
                            {objs.slice(0, 4).map((t, i) => {
                              const p = TAG_PALETTE[t.color] || TAG_PALETTE.slate
                              return (
                                <span
                                  key={t.id || `${t.name}-${i}`}
                                  className="mp-tag-pill"
                                  style={{ background: p.bg, color: p.text, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                >
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot }} />
                                  {t.name}
                                </span>
                              )
                            })}
                            {objs.length > 4 && (
                              <span style={{ color: '#9B91A8', fontSize: 11, marginLeft: 4 }}>+{objs.length - 4}</span>
                            )}
                          </>
                        )
                      })()}
                    </td>
                    <td>
                      <span className="mp-lang-pill">{LANG_LABEL[m.language] || m.language}</span>
                    </td>
                    <td>
                      {m.usage_count > 0
                        ? <span className="mp-usage-pill">{m.usage_count}</span>
                        : <span className="mp-usage-zero">0</span>
                      }
                    </td>
                    <td>
                      <span className="mp-relative-time">{m.last_updated_relative ?? '—'}</span>
                    </td>
                    <td className="mp-actions">
                      {canManage && (
                        <button
                          type="button"
                          data-dot-trigger={m.id}
                          className="mp-dot-btn"
                          aria-label="Macro actions"
                          aria-haspopup="menu"
                          aria-expanded={openMenu === m.id}
                          onClick={(e) => {
                            if (openMenu === m.id) { setOpenMenu(null); return }
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDotMenuCoords({
                              top:   rect.bottom + 6,
                              right: window.innerWidth - rect.right,
                            })
                            setOpenMenu(m.id)
                          }}
                        >
                          <MoreHorizontal size={16} strokeWidth={1.75} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* 3-dot menu — portaled */}
      {openMenu && dotMenuCoords && typeof document !== 'undefined' && (() => {
        const target = macros.find(m => m.id === openMenu)
        if (!target) return null
        const isArchived = !!target.archived_at
        return createPortal(
          <div
            ref={dotMenuRef}
            className="mp-dropdown"
            role="menu"
            style={{ top: dotMenuCoords.top, right: dotMenuCoords.right }}
          >
            <button className="mp-dd-item" onClick={() => { setOpenMenu(null); router.push(`/settings/workspace/macros/${target.id}`) }} role="menuitem">
              <Edit2 size={14} strokeWidth={1.75} /> Edit
            </button>
            <button className="mp-dd-item" onClick={() => handleDuplicate(target.id)} role="menuitem">
              <Copy size={14} strokeWidth={1.75} /> Duplicate
            </button>
            {isArchived ? (
              <button className="mp-dd-item" onClick={() => handleRestore(target.id)} role="menuitem">
                <ArchiveRestore size={14} strokeWidth={1.75} /> Restore
              </button>
            ) : (
              <button className="mp-dd-item" onClick={() => handleArchive(target.id)} role="menuitem">
                <Archive size={14} strokeWidth={1.75} /> Archive
              </button>
            )}
            {canDelete && (
              <>
                <div className="mp-dd-divider" />
                <button
                  className="mp-dd-item danger"
                  onClick={() => { setOpenMenu(null); setDeleteTarget(target) }}
                  role="menuitem"
                >
                  <Trash2 size={14} strokeWidth={1.75} /> Delete
                </button>
              </>
            )}
          </div>,
          document.body
        )
      })()}

      {/* Regenerate macros modal */}
      {showRegenModal && (
        <div className="mp-overlay" onClick={e => { if (e.target === e.currentTarget && !regenerating) setShowRegenModal(false) }}>
          <div className="mp-modal">
            <div className="mp-modal-hd">
              <div className="mp-modal-title">Regenerate macros?</div>
              <button
                onClick={() => { if (!regenerating) setShowRegenModal(false) }}
                style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9B91A8' }}
                disabled={regenerating}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="mp-modal-body">
              {regenError ? (
                <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 12, alignItems: 'flex-start' }}>
                  <AlertCircle size={16} strokeWidth={1.75} style={{ color: '#DC2626', marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#B91C1C' }}>{regenError}</span>
                </div>
              ) : null}
              {regenerating ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', color: '#6B5E7B', fontSize: 14 }}>
                  <Loader2 size={16} strokeWidth={1.75} className="spin" />
                  AI is crafting new macros — about 30–60 seconds…
                </div>
              ) : (
                <p style={{ margin: 0 }}>
                  This will generate ~50 new macros based on your saved store details.
                  Your existing macros are not deleted — the new ones will be added to the list.
                </p>
              )}
            </div>
            <div className="mp-modal-ft">
              <button
                className="btn-secondary"
                onClick={() => setShowRegenModal(false)}
                disabled={regenerating}
              >
                Cancel
              </button>
              <button
                className="btn-secondary"
                onClick={() => router.push('/settings/workspace/macros/generate')}
                disabled={regenerating}
              >
                Edit details
              </button>
              <button
                className="btn-primary"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating
                  ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Generating…</>
                  : <><Sparkles size={14} strokeWidth={1.75} /> Generate now</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="mp-overlay" onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null) }}>
          <div className="mp-modal">
            <div className="mp-modal-hd">
              <div className="mp-modal-title">Delete &ldquo;{deleteTarget.name}&rdquo;?</div>
              <button
                onClick={() => { if (!deleting) setDeleteTarget(null) }}
                style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9B91A8' }}
                disabled={deleting}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="mp-modal-body">
              This permanently removes the macro from your workspace. This cannot be undone.
              If you might want it back later, archive it instead.
            </div>
            <div className="mp-modal-ft">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting
                  ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Deleting…</>
                  : 'Delete macro'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`mp-toast mp-toast-${toast.type}`} role="status" aria-live="polite">
          <span className="mp-toast-icon">
            {toast.type === 'err'
              ? <AlertCircle size={16} strokeWidth={1.75} />
              : <Check size={16} strokeWidth={2} />
            }
          </span>
          <span className="mp-toast-msg">{toast.msg}</span>
          <button type="button" className="mp-toast-close" onClick={dismissToast} aria-label="Dismiss">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
