'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@supabase/supabase-js'
import {
  Plus, Search, MoreHorizontal, Tag as TagIcon, AlertCircle, Loader2,
  Check, X, Edit2, Trash2, GitMerge,
} from 'lucide-react'
import { TAG_COLORS, TAG_PALETTE } from '../../../../lib/tags'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const CSS = `
  .tp-root { font-family: 'Rethink Sans', sans-serif; color: #1C0F36; }
  .tp-wrap { max-width: 1100px; margin: 0 auto; padding: 48px 40px; }

  .tp-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; }
  .tp-title { font-size: 22px; font-weight: 600; color: #1C0F36; margin: 0 0 4px; }
  .tp-subtitle { font-size: 14px; color: #6B5E7B; margin: 0; }

  .tp-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .tp-search-wrap { position: relative; flex: 1; max-width: 320px; }
  .tp-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9B91A8; pointer-events: none; }
  .tp-search {
    width: 100%; padding: 8px 12px 8px 34px; border: 1px solid #E5E0EB;
    border-radius: 8px; font-size: 14px; font-family: inherit; color: #1C0F36;
    background: #fff; outline: none; transition: border-color 0.15s; box-sizing: border-box;
  }
  .tp-search:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }

  .tp-bulkbar {
    display: flex; align-items: center; gap: 12px; padding: 9px 14px;
    background: #F7F3FF; border: 1px solid #DDD0FA; border-radius: 8px;
    margin-bottom: 12px; font-size: 13px; color: #4B3B6B;
  }
  .tp-bulkbar-actions { display: flex; gap: 8px; margin-left: auto; }

  .tp-table-wrap { border: 1px solid #E5E0EB; border-radius: 12px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th {
    padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; color: #9B91A8;
    background: #F8F7FA; border-bottom: 1px solid #E5E0EB;
  }
  td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #F0EDF4; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr.tp-row:hover td { background: #FAFAFB; }
  tr.tp-row.selected td { background: #F7F3FF; }

  .tp-checkbox {
    width: 16px; height: 16px; border: 1.5px solid #C8C0D4; border-radius: 4px;
    background: #fff; cursor: pointer; display: inline-flex;
    align-items: center; justify-content: center; transition: all 0.15s;
    appearance: none; -webkit-appearance: none; flex-shrink: 0;
  }
  .tp-checkbox:checked { background: #A175FC; border-color: #A175FC; }
  .tp-checkbox:checked::after { content: '✓'; color: #fff; font-size: 12px; line-height: 1; }

  .tp-tag-cell { display: flex; align-items: center; gap: 10px; }
  .tp-tag-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .tp-tag-name { font-weight: 500; color: #1C0F36; font-size: 14px; }

  .tp-desc { font-size: 13px; color: #6B5E7B; max-width: 380px; }
  .tp-desc-empty { color: #9B91A8; }
  .tp-relative-time { font-size: 13px; color: #6B5E7B; }
  .tp-count-pill {
    display: inline-flex; align-items: center; padding: 2px 9px;
    background: #F1F5F9; color: #475569; border-radius: 20px; font-size: 12px; font-weight: 500;
  }
  .tp-count-zero { color: #9B91A8; font-size: 12px; }

  .tp-actions { text-align: right; position: relative; }
  .tp-dot-btn {
    width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    color: #9B91A8; transition: background 0.15s, color 0.15s;
  }
  .tp-dot-btn:hover { background: #F1EEF5; color: #1C0F36; }

  .tp-dropdown {
    position: fixed; z-index: 9999;
    background: #fff; border: 1px solid #E5E0EB; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(28,15,54,0.12); min-width: 160px; overflow: hidden;
    padding: 4px 0;
  }
  .tp-dd-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    font-size: 13px; color: #1C0F36; cursor: pointer; background: none; border: none;
    width: 100%; text-align: left; font-family: inherit; transition: background 0.1s;
  }
  .tp-dd-item:hover { background: #F8F7FA; }
  .tp-dd-item.danger { color: #EF4444; }
  .tp-dd-item.danger:hover { background: #FEF2F2; }
  .tp-dd-divider { height: 1px; background: #F0EDF4; margin: 2px 0; }

  .tp-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 64px 24px; text-align: center; gap: 12px;
  }
  .tp-empty-icon {
    width: 56px; height: 56px; border-radius: 14px; background: #F1F5F9;
    display: flex; align-items: center; justify-content: center; color: #94A3B8;
  }
  .tp-empty-title { font-size: 17px; font-weight: 600; color: #1C0F36; margin: 0; }
  .tp-empty-desc { font-size: 14px; color: #9B91A8; margin: 0; max-width: 320px; }

  .tp-error-bar {
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px;
    background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;
    margin-bottom: 16px; font-size: 13px; color: #DC2626;
  }

  /* Skeletons */
  .tp-skel {
    background: linear-gradient(90deg, #F1EEF5 0%, #E5E0EB 50%, #F1EEF5 100%);
    background-size: 200% 100%; animation: tp-shimmer 1.6s linear infinite;
    border-radius: 4px; display: inline-block;
  }
  .tp-skel-line { height: 12px; }
  .tp-skel-dot  { width: 10px; height: 10px; border-radius: 50%; }
  @keyframes tp-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Buttons */
  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: #A175FC; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s; white-space: nowrap;
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
  .btn-danger {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px;
    background: #EF4444; color: #fff; border: none; border-radius: 8px;
    font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer;
  }
  .btn-danger:hover:not(:disabled) { background: #DC2626; }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Modal */
  .tp-overlay {
    position: fixed; inset: 0; background: rgba(28,15,54,0.4); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .tp-modal {
    background: #fff; border-radius: 16px; width: 100%; max-width: 480px;
    box-shadow: 0 24px 48px rgba(28,15,54,0.16); overflow: hidden;
  }
  .tp-modal-hd {
    padding: 20px 24px 0; display: flex; align-items: flex-start; justify-content: space-between;
  }
  .tp-modal-title { font-size: 18px; font-weight: 600; color: #1C0F36; }
  .tp-modal-body { padding: 16px 24px; }
  .tp-modal-ft { padding: 12px 24px 20px; display: flex; gap: 8px; justify-content: flex-end; }
  .tp-modal-close {
    width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent;
    cursor: pointer; display: flex; align-items: center; justify-content: center; color: #9B91A8;
  }

  /* Form */
  .tp-field { margin-bottom: 16px; }
  .tp-label { display: block; font-size: 13px; font-weight: 500; color: #1C0F36; margin-bottom: 6px; }
  .tp-input, .tp-textarea, .tp-select {
    width: 100%; padding: 9px 12px; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-family: inherit; color: #1C0F36; outline: none; box-sizing: border-box;
    background: #fff; transition: border-color 0.15s;
  }
  .tp-input:focus, .tp-textarea:focus, .tp-select:focus {
    border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15);
  }
  .tp-input.error { border-color: #FCA5A5; box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
  .tp-textarea { resize: vertical; min-height: 70px; line-height: 1.5; font-family: inherit; }
  .tp-fielderr { margin: 5px 0 0; font-size: 12px; color: #DC2626; }
  .tp-hint { margin: 5px 0 0; font-size: 11px; color: #9B91A8; }

  /* Color picker */
  .tp-colors { display: grid; grid-template-columns: repeat(9, 1fr); gap: 6px; }
  .tp-color-swatch {
    width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
    border: 2px solid transparent; transition: border-color 0.15s, transform 0.1s;
    display: flex; align-items: center; justify-content: center;
  }
  .tp-color-swatch:hover { transform: scale(1.06); }
  .tp-color-swatch.selected { border-color: #1C0F36; }

  /* Toast */
  .tp-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    display: flex; align-items: center; gap: 10px; padding: 11px 12px 11px 14px;
    border-radius: 10px; font-size: 14px; font-family: inherit; font-weight: 500;
    box-shadow: 0 8px 24px rgba(28,15,54,0.16); animation: tp-slide 0.2s ease; max-width: 420px;
  }
  .tp-toast-ok  { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
  .tp-toast-ok  .tp-toast-icon { color: #10B981; }
  .tp-toast-err { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
  .tp-toast-err .tp-toast-icon { color: #DC2626; }
  .tp-toast-msg { flex: 1; min-width: 0; }
  .tp-toast-close {
    border: none; background: transparent; cursor: pointer; color: inherit;
    padding: 4px; border-radius: 6px; flex-shrink: 0; opacity: 0.6;
    display: flex; align-items: center; justify-content: center;
  }
  .tp-toast-close:hover { opacity: 1; background: rgba(0,0,0,0.04); }
  @keyframes tp-slide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

function relativeTime(date) {
  if (!date) return null
  const ms = Date.now() - new Date(date).getTime()
  if (ms < 60_000) return 'just now'
  const min  = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr   = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export default function TagsPage() {
  const [tags,    setTags]    = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [myRole,  setMyRole]  = useState(null)

  const [search,  setSearch]  = useState('')
  const [selected, setSelected] = useState(new Set())  // tag ids

  const [openMenu,      setOpenMenu]      = useState(null)
  const [dotMenuCoords, setDotMenuCoords] = useState(null)
  const dotMenuRef = useRef(null)

  // Modal states
  const [editTarget,   setEditTarget]   = useState(null)   // null | tag | 'new'
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showMerge,    setShowMerge]    = useState(false)

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

  const fetchTags = useCallback(async () => {
    const token = await getToken()
    if (!token) { setApiError('Not authenticated.'); setLoading(false); return }
    const res  = await fetch('/api/tags', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setApiError(body.error || `Request failed (${res.status})`)
      setLoading(false)
      return
    }
    const data = await res.json()
    setApiError(null)
    setTags(data.tags || [])
    setMyRole(data.currentUserRole || null)
    setLoading(false)
  }, [getToken])

  useEffect(() => {
    setLoading(true)
    fetchTags()
  }, [fetchTags])

  // Outside click + Escape for 3-dot menu
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

  const filtered = tags.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  )

  function toggleSelected(id) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(t => t.id)))
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const token = await getToken()
    const res = await fetch(`/api/tags/${deleteTarget.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { showToast('Failed to delete tag', 'err'); return }
    showToast(`Tag "${deleteTarget.name}" deleted`)
    setDeleteTarget(null)
    setTags(prev => prev.filter(t => t.id !== deleteTarget.id))
    setSelected(prev => { const n = new Set(prev); n.delete(deleteTarget.id); return n })
  }

  return (
    <div className="tp-root">
      <style>{CSS}</style>
      <div className="tp-wrap">

        <div className="tp-header">
          <div>
            <h1 className="tp-title">Manage tags</h1>
            <p className="tp-subtitle">Tags help organize macros, tickets, and conversations.</p>
          </div>
          {canManage && (
            <button className="btn-primary" onClick={() => setEditTarget('new')}>
              <Plus size={16} strokeWidth={1.75} />
              Create tag
            </button>
          )}
        </div>

        {apiError && (
          <div className="tp-error-bar">
            <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{apiError}</span>
          </div>
        )}

        <div className="tp-toolbar">
          <div className="tp-search-wrap">
            <Search size={14} strokeWidth={1.75} className="tp-search-icon" />
            <input
              className="tp-search"
              type="text"
              placeholder="Search tags by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="tp-bulkbar">
            <span><strong>{selected.size}</strong> selected</span>
            <div className="tp-bulkbar-actions">
              {selected.size >= 2 && canDelete && (
                <button className="btn-secondary" onClick={() => setShowMerge(true)}>
                  <GitMerge size={14} strokeWidth={1.75} /> Merge
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="tp-table-wrap">
          {loading ? (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Tag</th><th>Description</th><th>Macros</th><th>Created</th><th></th>
                </tr>
              </thead>
              <tbody>
                {[0,1,2].map(i => (
                  <tr key={`skel-${i}`}>
                    <td><div className="tp-skel" style={{ width: 16, height: 16, borderRadius: 4 }} /></td>
                    <td>
                      <div className="tp-tag-cell">
                        <div className="tp-skel tp-skel-dot" />
                        <div className="tp-skel tp-skel-line" style={{ width: 100 }} />
                      </div>
                    </td>
                    <td><div className="tp-skel tp-skel-line" style={{ width: 200 }} /></td>
                    <td><div className="tp-skel tp-skel-line" style={{ width: 30 }} /></td>
                    <td><div className="tp-skel tp-skel-line" style={{ width: 60 }} /></td>
                    <td><div className="tp-skel tp-skel-line" style={{ width: 24 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : filtered.length === 0 ? (
            <div className="tp-empty">
              <div className="tp-empty-icon"><TagIcon size={28} strokeWidth={1.5} /></div>
              <h3 className="tp-empty-title">{search ? 'No tags match your search' : 'No tags yet'}</h3>
              <p className="tp-empty-desc">
                {search
                  ? 'Try a different search term.'
                  : 'Create your first tag to organize your content.'}
              </p>
              {!search && canManage && (
                <button className="btn-primary" onClick={() => setEditTarget('new')}>
                  <Plus size={16} strokeWidth={1.75} /> Create tag
                </button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      className="tp-checkbox"
                      checked={selected.size > 0 && selected.size === filtered.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th>Tag</th>
                  <th>Description</th>
                  <th>Macros</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const palette = TAG_PALETTE[t.color] || TAG_PALETTE.slate
                  const isSel = selected.has(t.id)
                  return (
                    <tr key={t.id} className={`tp-row${isSel ? ' selected' : ''}`}>
                      <td>
                        <input
                          type="checkbox"
                          className="tp-checkbox"
                          checked={isSel}
                          onChange={() => toggleSelected(t.id)}
                          aria-label={`Select ${t.name}`}
                        />
                      </td>
                      <td>
                        <div className="tp-tag-cell">
                          <span className="tp-tag-dot" style={{ background: palette.dot }} />
                          <span className="tp-tag-name">{t.name}</span>
                        </div>
                      </td>
                      <td>
                        {t.description
                          ? <span className="tp-desc">{t.description}</span>
                          : <span className="tp-desc tp-desc-empty">—</span>
                        }
                      </td>
                      <td>
                        {t.macro_count > 0
                          ? <span className="tp-count-pill">{t.macro_count}</span>
                          : <span className="tp-count-zero">0</span>
                        }
                      </td>
                      <td><span className="tp-relative-time">{relativeTime(t.created_at)}</span></td>
                      <td className="tp-actions">
                        {canManage && (
                          <button
                            type="button"
                            data-dot-trigger={t.id}
                            className="tp-dot-btn"
                            aria-label="Tag actions"
                            onClick={(e) => {
                              if (openMenu === t.id) { setOpenMenu(null); return }
                              const rect = e.currentTarget.getBoundingClientRect()
                              setDotMenuCoords({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
                              setOpenMenu(t.id)
                            }}
                          >
                            <MoreHorizontal size={16} strokeWidth={1.75} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* 3-dot menu — portaled */}
      {openMenu && dotMenuCoords && typeof document !== 'undefined' && (() => {
        const target = tags.find(t => t.id === openMenu)
        if (!target) return null
        return createPortal(
          <div
            ref={dotMenuRef}
            className="tp-dropdown"
            role="menu"
            style={{ top: dotMenuCoords.top, right: dotMenuCoords.right }}
          >
            <button className="tp-dd-item" onClick={() => { setOpenMenu(null); setEditTarget(target) }}>
              <Edit2 size={14} strokeWidth={1.75} /> Edit
            </button>
            {canDelete && (
              <>
                <div className="tp-dd-divider" />
                <button className="tp-dd-item danger" onClick={() => { setOpenMenu(null); setDeleteTarget(target) }}>
                  <Trash2 size={14} strokeWidth={1.75} /> Delete
                </button>
              </>
            )}
          </div>,
          document.body
        )
      })()}

      {/* Create / Edit modal */}
      {editTarget && (
        <TagEditModal
          tag={editTarget === 'new' ? null : editTarget}
          existingNames={tags.map(t => t.name.toLowerCase())}
          onClose={() => setEditTarget(null)}
          onSaved={(saved) => {
            setEditTarget(null)
            if (editTarget === 'new') {
              setTags(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
              showToast(`Tag "${saved.name}" created`)
            } else {
              setTags(prev => prev.map(t => t.id === saved.id ? { ...t, ...saved } : t))
              showToast(`Tag "${saved.name}" updated`)
            }
          }}
          onError={(msg) => showToast(msg, 'err')}
          getToken={getToken}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="tp-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="tp-modal">
            <div className="tp-modal-hd">
              <div className="tp-modal-title">Delete tag &ldquo;{deleteTarget.name}&rdquo;?</div>
              <button className="tp-modal-close" onClick={() => setDeleteTarget(null)}><X size={16} strokeWidth={1.75} /></button>
            </div>
            <div className="tp-modal-body">
              This will remove &ldquo;{deleteTarget.name}&rdquo; from <strong>{deleteTarget.macro_count ?? 0}</strong> macro{deleteTarget.macro_count === 1 ? '' : 's'}.
              The macros themselves are not deleted. This cannot be undone.
            </div>
            <div className="tp-modal-ft">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Delete tag</button>
            </div>
          </div>
        </div>
      )}

      {/* Merge modal */}
      {showMerge && (
        <MergeModal
          tags={tags.filter(t => selected.has(t.id))}
          onClose={() => setShowMerge(false)}
          onMerged={(winner, mergedCount) => {
            setShowMerge(false)
            setSelected(new Set())
            showToast(`Merged ${mergedCount} tags into "${winner}"`)
            fetchTags()
          }}
          onError={(msg) => showToast(msg, 'err')}
          getToken={getToken}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`tp-toast tp-toast-${toast.type}`} role="status" aria-live="polite">
          <span className="tp-toast-icon">
            {toast.type === 'err'
              ? <AlertCircle size={16} strokeWidth={1.75} />
              : <Check size={16} strokeWidth={2} />
            }
          </span>
          <span className="tp-toast-msg">{toast.msg}</span>
          <button type="button" className="tp-toast-close" onClick={dismissToast} aria-label="Dismiss">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tag create/edit modal ──────────────────────────────────────────
function TagEditModal({ tag, existingNames, onClose, onSaved, onError, getToken }) {
  const isNew = !tag
  const [name,  setName]  = useState(tag?.name  ?? '')
  const [color, setColor] = useState(tag?.color ?? 'slate')
  const [description, setDescription] = useState(tag?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState(null)

  async function handleSave() {
    setNameError(null)
    const trimmed = name.trim()
    if (!trimmed) { setNameError('Name is required'); return }
    if (trimmed.length > 40) { setNameError('Max 40 characters'); return }

    const lc = trimmed.toLowerCase()
    const myLc = tag?.name?.toLowerCase()
    if (existingNames.includes(lc) && lc !== myLc) {
      setNameError(`A tag named "${trimmed}" already exists`)
      return
    }

    setSaving(true)
    const token = await getToken()
    const url    = isNew ? '/api/tags' : `/api/tags/${tag.id}`
    const method = isNew ? 'POST'      : 'PATCH'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: trimmed, color, description: description.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      if (data.code === 'duplicate') setNameError(data.error)
      else onError(data.error || 'Failed to save tag')
      return
    }
    onSaved(data.tag)
  }

  return (
    <div className="tp-overlay" onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="tp-modal">
        <div className="tp-modal-hd">
          <div className="tp-modal-title">{isNew ? 'Create tag' : 'Edit tag'}</div>
          <button className="tp-modal-close" onClick={onClose} disabled={saving}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="tp-modal-body">
          <div className="tp-field">
            <label className="tp-label" htmlFor="tag-name">Name</label>
            <input
              id="tag-name"
              className={`tp-input${nameError ? ' error' : ''}`}
              type="text"
              placeholder="e.g. urgent"
              value={name}
              onChange={e => { setName(e.target.value); if (nameError) setNameError(null) }}
              maxLength={40}
              autoFocus
            />
            {nameError && <p className="tp-fielderr">{nameError}</p>}
          </div>

          <div className="tp-field">
            <label className="tp-label">Color</label>
            <div className="tp-colors">
              {TAG_COLORS.map(c => {
                const p = TAG_PALETTE[c]
                return (
                  <button
                    key={c}
                    type="button"
                    className={`tp-color-swatch${color === c ? ' selected' : ''}`}
                    onClick={() => setColor(c)}
                    style={{ background: p.dot }}
                    aria-label={c}
                  >
                    {color === c && <Check size={14} strokeWidth={2.5} color="#fff" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="tp-field">
            <label className="tp-label" htmlFor="tag-desc">Description (optional)</label>
            <textarea
              id="tag-desc"
              className="tp-textarea"
              placeholder="What's this tag used for?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
            />
            <p className="tp-hint">{description.length}/200</p>
          </div>
        </div>
        <div className="tp-modal-ft">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Saving…</>
              : (isNew ? 'Create tag' : 'Save changes')
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Merge modal ──────────────────────────────────────────────────
function MergeModal({ tags, onClose, onMerged, onError, getToken }) {
  const [winnerId, setWinnerId] = useState(tags[0]?.id ?? null)
  const [merging,  setMerging]  = useState(false)

  async function handleMerge() {
    if (!winnerId) return
    const losers = tags.filter(t => t.id !== winnerId).map(t => t.id)
    setMerging(true)
    const token = await getToken()
    const res = await fetch('/api/tags/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ winner_id: winnerId, loser_ids: losers }),
    })
    const data = await res.json().catch(() => ({}))
    setMerging(false)
    if (!res.ok) { onError(data.error || 'Merge failed'); return }
    const winnerName = tags.find(t => t.id === winnerId)?.name ?? ''
    onMerged(winnerName, losers.length)
  }

  return (
    <div className="tp-overlay" onClick={e => { if (e.target === e.currentTarget && !merging) onClose() }}>
      <div className="tp-modal">
        <div className="tp-modal-hd">
          <div className="tp-modal-title">Merge {tags.length} tags</div>
          <button className="tp-modal-close" onClick={onClose} disabled={merging}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="tp-modal-body">
          <div className="tp-field">
            <label className="tp-label" htmlFor="merge-winner">Keep this tag (winner)</label>
            <select
              id="merge-winner"
              className="tp-select"
              value={winnerId ?? ''}
              onChange={e => setWinnerId(e.target.value)}
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239B91A8\' stroke-width=\'1.75\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
              }}
            >
              {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#1C0F36', lineHeight: 1.55 }}>
            All macros tagged with the others will receive <strong>&ldquo;{tags.find(t => t.id === winnerId)?.name ?? ''}&rdquo;</strong> instead.
            The other {tags.length - 1} tag{tags.length === 2 ? '' : 's'} will be deleted.
          </p>
        </div>
        <div className="tp-modal-ft">
          <button className="btn-secondary" onClick={onClose} disabled={merging}>Cancel</button>
          <button className="btn-primary" onClick={handleMerge} disabled={merging}>
            {merging
              ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Merging…</>
              : <><GitMerge size={14} strokeWidth={1.75} /> Merge tags</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
