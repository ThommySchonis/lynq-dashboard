'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  UserPlus, Search, MoreHorizontal, Mail,
  X, Check, AlertCircle, Loader2, Users, Copy, RefreshCw, Trash2,
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ROLES = ['admin', 'agent', 'observer']

const ROLE_LABELS = {
  owner:    'Owner',
  admin:    'Admin',
  agent:    'Agent',
  observer: 'Observer',
}

const ROLE_DESCS = {
  admin:    'Manage workspace & users',
  agent:    'Handle tickets & Shopify',
  observer: 'View-only access',
}

const CSS = `
  .up-root { font-family: 'Rethink Sans', sans-serif; color: #1C0F36; }
  .up-wrap { max-width: 768px; margin: 0 auto; padding: 48px 40px; }

  .up-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; }
  .up-title { font-size: 22px; font-weight: 600; color: #1C0F36; margin: 0 0 4px; }
  .up-subtitle { font-size: 14px; color: #6B5E7B; margin: 0; }

  .up-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .up-search-wrap { position: relative; flex: 1; max-width: 300px; }
  .up-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9B91A8; pointer-events: none; }
  .up-search {
    width: 100%; padding: 8px 12px 8px 34px; border: 1px solid #E5E0EB;
    border-radius: 8px; font-size: 14px; font-family: inherit; color: #1C0F36;
    background: #fff; outline: none; transition: border-color 0.15s; box-sizing: border-box;
  }
  .up-search:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }

  .up-seats { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .up-seats-text { font-size: 13px; color: #6B5E7B; }
  .up-seats-track { width: 120px; height: 4px; background: #F1EEF5; border-radius: 4px; overflow: hidden; }
  .up-seats-fill { height: 100%; background: #A175FC; border-radius: 4px; }

  .up-table-wrap { border: 1px solid #E5E0EB; border-radius: 12px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th {
    padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; color: #9B91A8;
    background: #F8F7FA; border-bottom: 1px solid #E5E0EB;
  }
  td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #F0EDF4; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #FAFAFB; }

  .up-user-cell { display: flex; align-items: center; gap: 10px; }
  .up-avatar {
    width: 32px; height: 32px; border-radius: 50%; background: #EDE5FE;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600; color: #A175FC; flex-shrink: 0; overflow: hidden;
  }
  .up-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .up-name { font-weight: 500; color: #1C0F36; font-size: 14px; }
  .up-you { font-size: 11px; color: #9B91A8; font-weight: 400; margin-left: 4px; }
  .up-email { font-size: 13px; color: #6B5E7B; }

  .up-badge {
    display: inline-flex; align-items: center; padding: 2px 9px;
    border-radius: 20px; font-size: 12px; font-weight: 500;
  }
  .up-badge-owner    { background: #EDE5FE; color: #7C3AED; }
  .up-badge-admin    { background: #F1EEF5; color: #4B3B6B; }
  .up-badge-agent    { background: #F1EEF5; color: #4B3B6B; }
  .up-badge-observer { background: #F1EEF5; color: #4B3B6B; }

  .up-invite-row td { background: #FFFCF7; }
  .up-invite-row:hover td { background: #FFF8EB; }
  .up-pending-badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
    background: #FEF3C7; color: #92400E; border-radius: 20px; font-size: 11px;
    font-weight: 500;
  }
  .up-invite-meta { font-size: 12px; color: #9B91A8; margin-top: 2px; line-height: 1.4; }
  .up-invite-meta .expired { color: #DC2626; font-weight: 500; }
  .up-invite-meta .today   { color: #B45309; font-weight: 500; }

  .up-row-actions { display: inline-flex; gap: 6px; align-items: center; }
  .up-icon-btn {
    height: 30px; padding: 0 10px; border-radius: 6px; border: 1px solid #E5E0EB;
    background: #fff; color: #6B5E7B; font-size: 12px; font-weight: 500;
    font-family: inherit; cursor: pointer; display: inline-flex; align-items: center;
    gap: 5px; transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .up-icon-btn:hover:not(:disabled) { background: #F8F7FA; color: #1C0F36; border-color: #C8C0D4; }
  .up-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .up-icon-btn.danger { color: #B91C1C; border-color: #FECACA; }
  .up-icon-btn.danger:hover:not(:disabled) { background: #FEF2F2; border-color: #F87171; }

  .up-tfa-yes { color: #22C55E; }
  .up-tfa-no  { color: #D1C9DB; }

  .up-actions { text-align: right; position: relative; }
  .up-dot-btn {
    width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    color: #9B91A8; transition: background 0.15s, color 0.15s;
  }
  .up-dot-btn:hover { background: #F1EEF5; color: #1C0F36; }
  .up-dot-btn:focus { outline: none; box-shadow: 0 0 0 3px rgba(161,117,252,0.25); }

  .up-dropdown {
    position: absolute; right: 0; top: calc(100% + 4px); z-index: 50;
    background: #fff; border: 1px solid #E5E0EB; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(28,15,54,0.12); min-width: 180px; overflow: hidden;
  }
  .up-dd-section { padding: 4px 0; }
  .up-dd-label {
    padding: 4px 12px; font-size: 11px; font-weight: 600; color: #9B91A8;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .up-dd-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    font-size: 13px; color: #1C0F36; cursor: pointer; background: none; border: none;
    width: 100%; text-align: left; font-family: inherit; transition: background 0.1s;
  }
  .up-dd-item:hover { background: #F8F7FA; }
  .up-dd-item.active { color: #A175FC; font-weight: 500; }
  .up-dd-item.danger { color: #EF4444; }
  .up-dd-item.danger:hover { background: #FEF2F2; }
  .up-dd-divider { height: 1px; background: #F0EDF4; margin: 2px 0; }

  .up-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 56px 24px; text-align: center; gap: 12px;
  }
  .up-empty-icon {
    width: 48px; height: 48px; border-radius: 12px; background: #F1EEF5;
    display: flex; align-items: center; justify-content: center; color: #C4A8FD;
  }
  .up-empty-title { font-size: 16px; font-weight: 600; color: #1C0F36; margin: 0; }
  .up-empty-desc { font-size: 14px; color: #9B91A8; margin: 0; max-width: 280px; }

  .up-error-bar {
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px;
    background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;
    margin-bottom: 16px; font-size: 13px; color: #DC2626;
  }

  .up-loading { display: flex; align-items: center; justify-content: center; padding: 56px 24px; gap: 10px; font-size: 14px; color: #9B91A8; }

  /* Buttons */
  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: #A175FC; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s; white-space: nowrap; flex-shrink: 0;
  }
  .btn-primary:hover:not(:disabled) { background: #8B5CF6; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-primary:focus { outline: none; box-shadow: 0 0 0 3px rgba(161,117,252,0.25); }
  .btn-secondary {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: #fff; color: #1C0F36; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; transition: background 0.15s;
  }
  .btn-secondary:hover { background: #F8F7FA; }
  .btn-danger {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: #EF4444; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; transition: background 0.15s;
  }
  .btn-danger:hover:not(:disabled) { background: #DC2626; }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Modal */
  .up-overlay {
    position: fixed; inset: 0; background: rgba(28,15,54,0.4); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .up-modal {
    background: #fff; border-radius: 16px; width: 100%; max-width: 440px;
    box-shadow: 0 24px 48px rgba(28,15,54,0.16); overflow: hidden;
  }
  .up-modal-hd {
    padding: 20px 24px 0; display: flex; align-items: flex-start; justify-content: space-between;
  }
  .up-modal-title { font-size: 18px; font-weight: 600; color: #1C0F36; }
  .up-modal-sub { font-size: 13px; color: #6B5E7B; margin-top: 2px; }
  .up-modal-close {
    width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    color: #9B91A8; flex-shrink: 0; margin-top: -2px;
  }
  .up-modal-close:hover { background: #F1EEF5; color: #1C0F36; }
  .up-modal-body { padding: 20px 24px; }
  .up-modal-ft { padding: 0 24px 20px; display: flex; gap: 8px; justify-content: flex-end; }

  .up-field { margin-bottom: 16px; }
  .up-field label { display: block; font-size: 13px; font-weight: 500; color: #1C0F36; margin-bottom: 6px; }
  .up-field input {
    width: 100%; padding: 9px 12px; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-family: inherit; color: #1C0F36; outline: none; box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .up-field input:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }

  .up-role-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .up-role-card {
    border: 2px solid #E5E0EB; border-radius: 10px; padding: 10px 12px;
    cursor: pointer; transition: border-color 0.15s, background 0.15s; background: #fff;
  }
  .up-role-card:hover { border-color: #C4A8FD; background: #F7F3FF; }
  .up-role-card.selected { border-color: #A175FC; background: #F7F3FF; }
  .up-role-card-name { font-size: 13px; font-weight: 600; color: #1C0F36; margin-bottom: 2px; }
  .up-role-card-desc { font-size: 11px; color: #9B91A8; line-height: 1.4; }

  /* Toast */
  .up-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 300;
    display: flex; align-items: center; gap: 10px; padding: 12px 16px;
    border-radius: 10px; font-size: 14px; font-family: inherit; font-weight: 500;
    box-shadow: 0 8px 24px rgba(28,15,54,0.16); animation: upSlide 0.2s ease; max-width: 360px;
  }
  .up-toast-ok  { background: #fff; color: #1C0F36; border: 1px solid #E5E0EB; }
  .up-toast-err { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
  @keyframes upSlide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

function initials(name, email) {
  const src = name || email || '?'
  return src.slice(0, 2).toUpperCase()
}

function expiryLabel(expiresAt) {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return { text: 'Expired', tone: 'expired' }
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  if (days === 0) return { text: 'Expires today', tone: 'today' }
  if (days === 1) return { text: 'Expires tomorrow', tone: 'normal' }
  return { text: `Expires in ${days} days`, tone: 'normal' }
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function UsersPage() {
  const [users, setUsers]           = useState([])
  const [invites, setInvites]       = useState([])
  const [seatsUsed, setSeatsUsed]   = useState(0)
  const [loading, setLoading]       = useState(true)
  const [apiError, setApiError]     = useState(null)
  const [repairing, setRepairing]   = useState(false)
  const [repairedOnce, setRepairedOnce] = useState(false)
  const [myId, setMyId]             = useState(null)
  const [myRole, setMyRole]         = useState(null)
  const [isOwner, setIsOwner]       = useState(false)

  const [search, setSearch]         = useState('')
  const debouncedSearch             = useDebounce(search, 250)

  const [openMenu, setOpenMenu]     = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [revokeTarget, setRevokeTarget] = useState(null)   // { id, email }
  const [pendingAction, setPendingAction] = useState({})   // { [inviteId]: 'resend' | 'revoke' }

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('agent')
  const [inviting, setInviting]       = useState(false)
  const [inviteResult, setInviteResult] = useState(null)  // { invite, inviteLink, emailStatus, emailError }
  const [removing, setRemoving]       = useState(false)
  const [linkCopied, setLinkCopied]   = useState(false)

  const [toast, setToast] = useState(null)
  const menuRef = useRef(null)

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const fetchUsers = useCallback(async (q = '') => {
    const token = await getToken()
    if (!token) { setApiError('Not authenticated — please refresh the page.'); return }

    const url = q
      ? `/api/workspaces/current/members?q=${encodeURIComponent(q)}`
      : '/api/workspaces/current/members'

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setApiError(body.error || `Request failed (${res.status})`)
      return
    }

    const data = await res.json()
    setApiError(null)
    setUsers(data.members || [])
    setInvites(data.invites || [])
    setSeatsUsed(data.seatsUsed || 0)
    setMyRole(data.currentUserRole || null)
    setIsOwner(data.isOwner === true)
    console.log('[users page] role from server:', data.currentUserRole, '| isOwner:', data.isOwner)
  }, [getToken])

  const runRepair = useCallback(async () => {
    if (repairedOnce) return
    setRepairedOnce(true)
    setRepairing(true)
    const token = await getToken()
    if (!token) { setRepairing(false); return }

    const res = await fetch('/api/workspaces/repair-membership', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    setRepairing(false)

    if (res.ok) {
      const data = await res.json()
      console.log('[users page] repair result:', data.status)
      await fetchUsers(debouncedSearch)
    } else {
      const body = await res.json().catch(() => ({}))
      setApiError(body.error || 'Auto-repair failed — contact support.')
    }
  }, [repairedOnce, getToken, fetchUsers, debouncedSearch])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setMyId(session.user.id)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchUsers(debouncedSearch).finally(() => setLoading(false))
  }, [debouncedSearch, fetchUsers])

  // Auto-repair when the list comes back empty (no search active, no prior error)
  useEffect(() => {
    if (!loading && users.length === 0 && !apiError && !repairedOnce && !debouncedSearch) {
      runRepair()
    }
  }, [loading, users.length, apiError, repairedOnce, debouncedSearch, runRepair])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Server-sourced role is primary; isOwner is a safety net so the actual
  // workspace owner can never be locked out, even if the role lookup fails.
  const canManage = ['owner', 'admin'].includes(myRole) || isOwner

  async function handleChangeRole(memberId, newRole) {
    setOpenMenu(null)
    const token = await getToken()
    const res = await fetch(`/api/workspaces/current/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: newRole }),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error || 'Failed to update role', 'err'); return }
    showToast('Role updated')
    fetchUsers(debouncedSearch)
  }

  async function handleResendInvite(invite) {
    setPendingAction(prev => ({ ...prev, [invite.id]: 'resend' }))
    const token = await getToken()
    const res = await fetch(`/api/workspaces/current/invites/${invite.id}/resend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    setPendingAction(prev => { const n = { ...prev }; delete n[invite.id]; return n })

    if (!res.ok) {
      showToast(data.error || 'Failed to resend invite', 'err')
      return
    }
    if (data.emailStatus === 'sent') {
      showToast(`Invite resent to ${invite.email}`)
    } else if (data.emailStatus === 'not_configured') {
      showToast('Invite refreshed — email service not configured', 'err')
    } else if (data.emailStatus === 'failed') {
      showToast(`Invite refreshed but email failed: ${data.emailError}`, 'err')
    } else {
      showToast('Invite refreshed')
    }
    fetchUsers(debouncedSearch)
  }

  async function confirmRevokeInvite() {
    if (!revokeTarget) return
    const target = revokeTarget
    setPendingAction(prev => ({ ...prev, [target.id]: 'revoke' }))

    const token = await getToken()
    const res = await fetch(`/api/workspaces/current/invites/${target.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))

    setPendingAction(prev => { const n = { ...prev }; delete n[target.id]; return n })
    setRevokeTarget(null)

    if (!res.ok) {
      showToast(data.error || 'Failed to revoke invite', 'err')
      return
    }
    showToast(`Invite to ${target.email} revoked`)
    fetchUsers(debouncedSearch)
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    const token = await getToken()
    const res = await fetch(`/api/workspaces/current/members/${removeTarget.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setRemoving(false)
    setRemoveTarget(null)
    if (!res.ok) { showToast(data.error || 'Failed to remove user', 'err'); return }
    showToast('User removed')
    fetchUsers(debouncedSearch)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    const token = await getToken()
    const res = await fetch('/api/workspaces/current/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    const data = await res.json()
    setInviting(false)
    if (!res.ok) { showToast(data.error || 'Failed to send invite', 'err'); return }
    setInviteResult(data)
    fetchUsers(debouncedSearch)
  }

  function closeInviteModal() {
    setShowInvite(false)
    setInviteEmail('')
    setInviteRole('agent')
    setInviteResult(null)
    setLinkCopied(false)
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (_) {
      showToast('Failed to copy — please copy manually', 'err')
    }
  }

  async function copyInviteLink(link) {
    try {
      await navigator.clipboard.writeText(link)
      showToast('Invite link copied')
    } catch (_) {
      showToast('Failed to copy', 'err')
    }
    setOpenMenu(null)
  }

  const rows = [
    ...users.map(m => ({ ...m, _type: 'user' })),
    ...invites.map(i => ({ ...i, _type: 'invite' })),
  ]

  const isLoadingOrRepairing = loading || repairing

  return (
    <div className="up-root">
      <style>{CSS}</style>
      <div className="up-wrap">

        <div className="up-header">
          <div>
            <h1 className="up-title">Users</h1>
            <p className="up-subtitle">Manage who has access to this workspace and their roles</p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowInvite(true)}
            disabled={!canManage}
          >
            <UserPlus size={16} strokeWidth={1.75} />
            Invite user
          </button>
        </div>

        {apiError && (
          <div className="up-error-bar">
            <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{apiError}</span>
          </div>
        )}

        <div className="up-toolbar">
          <div className="up-search-wrap">
            <Search size={14} strokeWidth={1.75} className="up-search-icon" />
            <input
              className="up-search"
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="up-seats">
          <span className="up-seats-text">
            {seatsUsed} {seatsUsed === 1 ? 'user' : 'users'}
          </span>
          <div className="up-seats-track">
            <div className="up-seats-fill" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="up-table-wrap">
          {isLoadingOrRepairing ? (
            <div className="up-loading">
              <Loader2 size={18} strokeWidth={1.75} className="spin" />
              {repairing ? 'Setting up your workspace…' : 'Loading users…'}
            </div>
          ) : rows.length === 0 ? (
            <div className="up-empty">
              <div className="up-empty-icon">
                <Users size={24} strokeWidth={1.75} />
              </div>
              <p className="up-empty-title">
                {search ? 'No users match your search' : 'No users yet'}
              </p>
              <p className="up-empty-desc">
                {search
                  ? 'Try a different name or email address.'
                  : 'Invite your first teammate to get started.'
                }
              </p>
              {!search && canManage && (
                <button className="btn-primary" onClick={() => setShowInvite(true)}>
                  <UserPlus size={16} strokeWidth={1.75} />
                  Invite user
                </button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>2FA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  if (row._type === 'invite') {
                    const exp        = expiryLabel(row.expires_at)
                    const inviter    = row.inviter_name || row.inviter_email
                    const action     = pendingAction[row.id]
                    const isResending = action === 'resend'
                    const isRevoking  = action === 'revoke'
                    const busy        = !!action
                    return (
                      <tr key={`invite-${row.id}`} className="up-invite-row">
                        <td>
                          <div className="up-user-cell">
                            <div className="up-avatar" style={{ background: '#FEF3C7', color: '#92400E' }}>
                              <Mail size={14} strokeWidth={1.75} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="up-name" style={{ color: '#1C0F36' }}>{row.email}</span>
                                <span className="up-pending-badge">Pending</span>
                              </div>
                              <div className="up-invite-meta">
                                {inviter ? <>Invited by {inviter}</> : null}
                                {inviter && exp ? ' · ' : null}
                                {exp ? <span className={exp.tone === 'expired' ? 'expired' : exp.tone === 'today' ? 'today' : ''}>{exp.text}</span> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="up-email">{row.email}</td>
                        <td>
                          <span className={`up-badge up-badge-${row.role}`}>{ROLE_LABELS[row.role]}</span>
                        </td>
                        <td className="up-tfa-no">—</td>
                        <td className="up-actions">
                          {canManage && (
                            <div className="up-row-actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                className="up-icon-btn"
                                onClick={() => handleResendInvite(row)}
                                disabled={busy}
                                title="Resend invite email"
                              >
                                {isResending
                                  ? <Loader2 size={12} strokeWidth={1.75} className="spin" />
                                  : <RefreshCw size={12} strokeWidth={1.75} />
                                }
                                {isResending ? 'Sending…' : 'Resend'}
                              </button>
                              <button
                                className="up-icon-btn danger"
                                onClick={() => setRevokeTarget({ id: row.id, email: row.email })}
                                disabled={busy}
                                title="Revoke this invite"
                              >
                                {isRevoking
                                  ? <Loader2 size={12} strokeWidth={1.75} className="spin" />
                                  : <Trash2 size={12} strokeWidth={1.75} />
                                }
                                Revoke
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  }

                  const isMe    = row.user_id === myId
                  const isOwner = row.role === 'owner'
                  const canEdit = canManage && !isMe && !isOwner

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="up-user-cell">
                          <div className="up-avatar">
                            {row.avatar_url
                              ? <img src={row.avatar_url} alt="" />
                              : initials(row.display_name, row.email)
                            }
                          </div>
                          <div>
                            <div className="up-name">
                              {row.display_name || row.email?.split('@')[0] || '—'}
                              {isMe && <span className="up-you">(you)</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="up-email">{row.email || '—'}</td>
                      <td>
                        <span className={`up-badge up-badge-${row.role}`}>
                          {ROLE_LABELS[row.role] || row.role}
                        </span>
                      </td>
                      <td>
                        {row.two_factor_enabled
                          ? <span className="up-tfa-yes" title="2FA enabled"><Check size={14} strokeWidth={2} /></span>
                          : <span className="up-tfa-no" title="2FA not enabled">—</span>
                        }
                      </td>
                      <td className="up-actions" ref={openMenu === row.id ? menuRef : null}>
                        {canEdit && (
                          <>
                            <button
                              className="up-dot-btn"
                              onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)}
                            >
                              <MoreHorizontal size={16} strokeWidth={1.75} />
                            </button>
                            {openMenu === row.id && (
                              <div className="up-dropdown">
                                <div className="up-dd-section">
                                  <div className="up-dd-label">Change role</div>
                                  {ROLES.map(r => (
                                    <button
                                      key={r}
                                      className={`up-dd-item${row.role === r ? ' active' : ''}`}
                                      onClick={() => handleChangeRole(row.id, r)}
                                    >
                                      {row.role === r
                                        ? <Check size={13} strokeWidth={2} />
                                        : <span style={{ display: 'inline-block', width: 13 }} />
                                      }
                                      {ROLE_LABELS[r]}
                                    </button>
                                  ))}
                                </div>
                                <div className="up-dd-divider" />
                                <div className="up-dd-section">
                                  <button
                                    className="up-dd-item danger"
                                    onClick={() => { setOpenMenu(null); setRemoveTarget(row) }}
                                  >
                                    <X size={14} strokeWidth={1.75} /> Remove user
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
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

      {/* Invite Modal */}
      {showInvite && (
        <div className="up-overlay" onClick={e => e.target === e.currentTarget && closeInviteModal()}>
          <div className="up-modal">
            {!inviteResult ? (
              <>
                <div className="up-modal-hd">
                  <div>
                    <div className="up-modal-title">Invite a new user</div>
                    <div className="up-modal-sub">They'll receive an email with a link to join.</div>
                  </div>
                  <button className="up-modal-close" onClick={closeInviteModal}>
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </div>
                <form onSubmit={handleInvite}>
                  <div className="up-modal-body">
                    <div className="up-field">
                      <label htmlFor="invite-email">Email address</label>
                      <input
                        id="invite-email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="up-field">
                      <label>Role</label>
                      <div className="up-role-cards">
                        {ROLES.map(r => (
                          <div
                            key={r}
                            className={`up-role-card${inviteRole === r ? ' selected' : ''}`}
                            onClick={() => setInviteRole(r)}
                          >
                            <div className="up-role-card-name">{ROLE_LABELS[r]}</div>
                            <div className="up-role-card-desc">{ROLE_DESCS[r]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="up-modal-ft">
                    <button type="button" className="btn-secondary" onClick={closeInviteModal}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={inviting}>
                      {inviting
                        ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Sending…</>
                        : <><Mail size={14} strokeWidth={1.75} /> Send invite</>
                      }
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="up-modal-hd">
                  <div>
                    <div className="up-modal-title">Invite created</div>
                    <div className="up-modal-sub">
                      {inviteResult.emailStatus === 'sent'
                        ? `Email sent to ${inviteResult.invite?.email}.`
                        : inviteResult.emailStatus === 'not_configured'
                          ? 'Email service not configured — copy the link below to share manually.'
                          : inviteResult.emailStatus === 'failed'
                            ? `Email failed: ${inviteResult.emailError}. Use the link below instead.`
                            : 'Share the link below with the user.'}
                    </div>
                  </div>
                  <button className="up-modal-close" onClick={closeInviteModal}>
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </div>
                <div className="up-modal-body">
                  {inviteResult.inviteLink ? (
                    <>
                      <div className="up-field">
                        <label>Invite link</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={inviteResult.inviteLink}
                            readOnly
                            onFocus={e => e.target.select()}
                            style={{ flex: 1, fontSize: 12, fontFamily: 'ui-monospace, monospace' }}
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => copyToClipboard(inviteResult.inviteLink)}
                          >
                            {linkCopied
                              ? <><Check size={14} strokeWidth={2} /> Copied</>
                              : <><Copy size={14} strokeWidth={1.75} /> Copy</>
                            }
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: '#9B91A8', margin: '0 0 8px' }}>
                        Link expires in 7 days.
                      </p>
                    </>
                  ) : (
                    <div className="up-error-bar" style={{ marginBottom: 0 }}>
                      <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>
                        Could not generate an invite link — set <code>NEXT_PUBLIC_SITE_URL</code> in
                        Vercel environment variables.
                      </span>
                    </div>
                  )}
                </div>
                <div className="up-modal-ft">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setInviteResult(null); setInviteEmail(''); setInviteRole('agent'); setLinkCopied(false) }}
                  >
                    Invite another
                  </button>
                  <button type="button" className="btn-primary" onClick={closeInviteModal}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revoke Invite Confirm Modal */}
      {revokeTarget && (
        <div className="up-overlay" onClick={e => e.target === e.currentTarget && setRevokeTarget(null)}>
          <div className="up-modal">
            <div className="up-modal-hd">
              <div>
                <div className="up-modal-title">Revoke invite</div>
                <div className="up-modal-sub">The invite link will stop working.</div>
              </div>
              <button className="up-modal-close" onClick={() => setRevokeTarget(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="up-modal-body">
              <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#FFFCF7', border: '1px solid #FCD34D', borderRadius: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={16} strokeWidth={1.75} style={{ color: '#B45309', marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#1C0F36' }}>
                  Revoke invite for <strong>{revokeTarget.email}</strong>? They won't be able to use the link anymore.
                </span>
              </div>
            </div>
            <div className="up-modal-ft">
              <button className="btn-secondary" onClick={() => setRevokeTarget(null)}>Cancel</button>
              <button
                className="btn-danger"
                onClick={confirmRevokeInvite}
                disabled={pendingAction[revokeTarget.id] === 'revoke'}
              >
                {pendingAction[revokeTarget.id] === 'revoke'
                  ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Revoking…</>
                  : 'Revoke invite'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirm Modal */}
      {removeTarget && (
        <div className="up-overlay" onClick={e => e.target === e.currentTarget && setRemoveTarget(null)}>
          <div className="up-modal">
            <div className="up-modal-hd">
              <div>
                <div className="up-modal-title">Remove user</div>
                <div className="up-modal-sub">This action cannot be undone.</div>
              </div>
              <button className="up-modal-close" onClick={() => setRemoveTarget(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="up-modal-body">
              <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#FEF2F2', borderRadius: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={16} strokeWidth={1.75} style={{ color: '#EF4444', marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#1C0F36' }}>
                  <strong>{removeTarget.display_name || removeTarget.email}</strong> will lose access to this workspace immediately.
                </span>
              </div>
            </div>
            <div className="up-modal-ft">
              <button className="btn-secondary" onClick={() => setRemoveTarget(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleRemove} disabled={removing}>
                {removing
                  ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Removing…</>
                  : 'Remove user'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`up-toast up-toast-${toast.type}`}>
          {toast.type === 'err'
            ? <AlertCircle size={16} strokeWidth={1.75} />
            : <Check size={16} strokeWidth={2} />
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}
