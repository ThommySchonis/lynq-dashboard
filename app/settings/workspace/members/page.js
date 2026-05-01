'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  UserPlus, Search, MoreHorizontal, Mail, Shield,
  ChevronDown, X, Check, AlertCircle, Loader2,
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

const CSS = `
  .members-page { font-family: 'Rethink Sans', sans-serif; color: #1C0F36; }
  .members-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .members-title { font-size: 22px; font-weight: 600; color: #1C0F36; }
  .members-subtitle { font-size: 14px; color: #6B5E7B; margin-top: 2px; }

  .toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .search-wrap { position: relative; flex: 1; max-width: 320px; }
  .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9B91A8; pointer-events: none; }
  .search-input {
    width: 100%; padding: 8px 12px 8px 34px; border: 1px solid #E5E0EB;
    border-radius: 8px; font-size: 14px; font-family: inherit; color: #1C0F36;
    background: #fff; outline: none; transition: border-color 0.15s;
  }
  .search-input:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }

  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: #A175FC; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s; white-space: nowrap;
  }
  .btn-primary:hover { background: #8B5CF6; }
  .btn-primary:focus { outline: none; box-shadow: 0 0 0 3px rgba(161,117,252,0.25); }

  .seats-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .seats-text { font-size: 13px; color: #6B5E7B; }
  .seats-track { flex: 1; max-width: 160px; height: 4px; background: #F1EEF5; border-radius: 4px; overflow: hidden; }
  .seats-fill { height: 100%; background: #A175FC; border-radius: 4px; transition: width 0.3s; }

  .table-wrap { border: 1px solid #E5E0EB; border-radius: 12px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th {
    padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; color: #9B91A8;
    background: #F8F7FA; border-bottom: 1px solid #E5E0EB;
  }
  td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #F0EDF4; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #FAFAFB; }

  .member-cell { display: flex; align-items: center; gap: 10px; }
  .avatar {
    width: 32px; height: 32px; border-radius: 50%; background: #EDE5FE;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 600; color: #A175FC; flex-shrink: 0;
    overflow: hidden;
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .member-name { font-weight: 500; color: #1C0F36; font-size: 14px; }
  .member-you { font-size: 11px; color: #9B91A8; font-weight: 400; margin-left: 4px; }
  .member-email { font-size: 13px; color: #6B5E7B; }

  .role-badge {
    display: inline-flex; align-items: center; padding: 2px 9px;
    border-radius: 20px; font-size: 12px; font-weight: 500; gap: 4px;
  }
  .role-owner    { background: #EDE5FE; color: #7C3AED; }
  .role-admin    { background: #F1EEF5; color: #4B3B6B; }
  .role-agent    { background: #F1EEF5; color: #4B3B6B; }
  .role-observer { background: #F1EEF5; color: #4B3B6B; }

  .invite-row td { background: #FDFCFF; }
  .invite-row:hover td { background: #F9F7FF; }
  .invite-badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
    background: #F1EEF5; color: #9B91A8; border-radius: 20px; font-size: 11px;
    font-weight: 500; border: 1px dashed #E5E0EB;
  }

  .tfa-yes { color: #22C55E; font-size: 13px; }
  .tfa-no  { color: #E5E0EB; font-size: 13px; }

  .actions-cell { text-align: right; position: relative; }
  .dot-btn {
    width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    color: #9B91A8; transition: background 0.15s, color 0.15s;
  }
  .dot-btn:hover { background: #F1EEF5; color: #1C0F36; }
  .dot-btn:focus { outline: none; box-shadow: 0 0 0 3px rgba(161,117,252,0.25); }

  .dropdown {
    position: absolute; right: 0; top: calc(100% + 4px); z-index: 50;
    background: #fff; border: 1px solid #E5E0EB; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(28,15,54,0.12); min-width: 180px; overflow: hidden;
  }
  .dropdown-section { padding: 4px 0; }
  .dropdown-label {
    padding: 4px 12px; font-size: 11px; font-weight: 600; color: #9B91A8;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .dropdown-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    font-size: 13px; color: #1C0F36; cursor: pointer; background: none; border: none;
    width: 100%; text-align: left; font-family: inherit; transition: background 0.1s;
  }
  .dropdown-item:hover { background: #F8F7FA; }
  .dropdown-item.active { color: #A175FC; font-weight: 500; }
  .dropdown-item.danger { color: #EF4444; }
  .dropdown-item.danger:hover { background: #FEF2F2; }
  .dropdown-divider { height: 1px; background: #F0EDF4; margin: 2px 0; }

  .empty-state { text-align: center; padding: 48px 24px; color: #9B91A8; font-size: 14px; }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(28,15,54,0.4);
    display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px;
  }
  .modal {
    background: #fff; border-radius: 16px; width: 100%; max-width: 440px;
    box-shadow: 0 24px 48px rgba(28,15,54,0.16); overflow: hidden;
  }
  .modal-header {
    padding: 20px 24px 0; display: flex; align-items: flex-start; justify-content: space-between;
  }
  .modal-title { font-size: 18px; font-weight: 600; color: #1C0F36; }
  .modal-sub { font-size: 13px; color: #6B5E7B; margin-top: 2px; }
  .modal-close {
    width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent;
    cursor: pointer; display: flex; align-items: center; justify-content: center; color: #9B91A8;
    flex-shrink: 0; margin-top: -2px;
  }
  .modal-close:hover { background: #F1EEF5; color: #1C0F36; }
  .modal-body { padding: 20px 24px; }
  .modal-footer { padding: 0 24px 20px; display: flex; gap: 8px; justify-content: flex-end; }

  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 13px; font-weight: 500; color: #1C0F36; margin-bottom: 6px; }
  .field input {
    width: 100%; padding: 9px 12px; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-family: inherit; color: #1C0F36; outline: none; box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .field input:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15); }

  .role-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .role-card {
    border: 2px solid #E5E0EB; border-radius: 10px; padding: 10px 12px; cursor: pointer;
    transition: border-color 0.15s, background 0.15s; background: #fff;
  }
  .role-card:hover { border-color: #C4A8FD; background: #F7F3FF; }
  .role-card.selected { border-color: #A175FC; background: #F7F3FF; }
  .role-card-name { font-size: 13px; font-weight: 600; color: #1C0F36; margin-bottom: 2px; }
  .role-card-desc { font-size: 11px; color: #9B91A8; line-height: 1.4; }

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
  .btn-danger:hover { background: #DC2626; }

  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 300;
    display: flex; align-items: center; gap: 10px; padding: 12px 16px;
    border-radius: 10px; font-size: 14px; font-family: inherit; font-weight: 500;
    box-shadow: 0 8px 24px rgba(28,15,54,0.16); animation: slideUp 0.2s ease;
    max-width: 360px;
  }
  .toast-success { background: #fff; color: #1C0F36; border: 1px solid #E5E0EB; }
  .toast-error   { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
  @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

const ROLE_DESCS = {
  admin:    'Manage workspace & members',
  agent:    'Handle tickets & Shopify',
  observer: 'View-only access',
}

function initials(name, email) {
  const src = name || email || '?'
  return src.slice(0, 2).toUpperCase()
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function MembersPage() {
  const [members, setMembers]       = useState([])
  const [invites, setInvites]       = useState([])
  const [seatsUsed, setSeatsUsed]   = useState(0)
  const [loading, setLoading]       = useState(true)
  const [myId, setMyId]             = useState(null)
  const [myRole, setMyRole]         = useState(null)

  const [search, setSearch]         = useState('')
  const debouncedSearch             = useDebounce(search, 250)

  const [openMenu, setOpenMenu]     = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('agent')
  const [inviting, setInviting]       = useState(false)
  const [removing, setRemoving]       = useState(false)

  const [toast, setToast] = useState(null)
  const menuRef = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const fetchMembers = useCallback(async (q = '') => {
    const token = await getToken()
    if (!token) return
    const url = q
      ? `/api/workspaces/current/members?q=${encodeURIComponent(q)}`
      : '/api/workspaces/current/members'
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    setMembers(data.members || [])
    setInvites(data.invites || [])
    setSeatsUsed(data.seatsUsed || 0)
  }, [getToken])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      setMyId(session.user.id)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchMembers(debouncedSearch).finally(() => setLoading(false))
  }, [debouncedSearch, fetchMembers])

  useEffect(() => {
    if (!myId || !members.length) return
    const me = members.find(m => m.user_id === myId)
    if (me) setMyRole(me.role)
  }, [myId, members])

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const canManage = ['owner', 'admin'].includes(myRole)

  async function handleChangeRole(memberId, newRole) {
    setOpenMenu(null)
    const token = await getToken()
    const res = await fetch(`/api/workspaces/current/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: newRole }),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error || 'Failed to update role', 'error'); return }
    showToast('Role updated')
    fetchMembers(debouncedSearch)
  }

  async function handleRevokeInvite(inviteId) {
    setOpenMenu(null)
    const token = await getToken()
    const res = await fetch(`/api/workspaces/current/members/${inviteId}?type=invite`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { showToast('Failed to revoke invite', 'error'); return }
    showToast('Invite revoked')
    fetchMembers(debouncedSearch)
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
    if (!res.ok) { showToast(data.error || 'Failed to remove member', 'error'); return }
    showToast('Member removed')
    fetchMembers(debouncedSearch)
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
    if (!res.ok) { showToast(data.error || 'Failed to send invite', 'error'); return }
    if (data.emailError) {
      showToast(`Invite created but email failed: ${data.emailError}`, 'error')
    } else {
      showToast(`Invite sent to ${inviteEmail.trim()}`)
    }
    setInviteEmail('')
    setInviteRole('agent')
    setShowInvite(false)
    fetchMembers(debouncedSearch)
  }

  const rows = [
    ...members.map(m => ({ ...m, _type: 'member' })),
    ...invites.map(i => ({ ...i, _type: 'invite' })),
  ]

  return (
    <div className="members-page">
      <style>{CSS}</style>

      <div className="members-header">
        <div>
          <div className="members-title">Team members</div>
          <div className="members-subtitle">Manage who has access to your workspace</div>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowInvite(true)}
          disabled={!canManage}
          style={!canManage ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          <UserPlus size={16} strokeWidth={1.75} />
          Invite member
        </button>
      </div>

      <div className="toolbar">
        <div className="search-wrap">
          <Search size={14} strokeWidth={1.75} className="search-icon" />
          <input
            className="search-input"
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="seats-bar">
        <span className="seats-text">{seatsUsed} {seatsUsed === 1 ? 'member' : 'members'}</span>
        <div className="seats-track">
          <div className="seats-fill" style={{ width: '100%' }} />
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">
            <Loader2 size={20} strokeWidth={1.75} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
            Loading members…
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            {search ? 'No members match your search.' : 'No members yet.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>2FA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                if (row._type === 'invite') {
                  return (
                    <tr key={`invite-${row.id}`} className="invite-row">
                      <td>
                        <div className="member-cell">
                          <div className="avatar" style={{ background: '#F1EEF5', color: '#9B91A8' }}>
                            <Mail size={14} strokeWidth={1.75} />
                          </div>
                          <div>
                            <div className="member-name" style={{ color: '#9B91A8' }}>Pending invite</div>
                            <span className="invite-badge">
                              <Mail size={10} strokeWidth={1.75} />
                              Awaiting acceptance
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="member-email">{row.email}</td>
                      <td>
                        <span className={`role-badge role-${row.role}`}>
                          {ROLE_LABELS[row.role]}
                        </span>
                      </td>
                      <td className="tfa-no">—</td>
                      <td className="actions-cell" ref={openMenu === row.id ? menuRef : null}>
                        {canManage && (
                          <>
                            <button
                              className="dot-btn"
                              onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)}
                            >
                              <MoreHorizontal size={16} strokeWidth={1.75} />
                            </button>
                            {openMenu === row.id && (
                              <div className="dropdown">
                                <div className="dropdown-section">
                                  <button
                                    className="dropdown-item danger"
                                    onClick={() => handleRevokeInvite(row.id)}
                                  >
                                    <X size={14} strokeWidth={1.75} />
                                    Revoke invite
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )
                }

                const isMe = row.user_id === myId
                const isOwner = row.role === 'owner'
                const canEdit = canManage && !isMe && !isOwner

                return (
                  <tr key={row.id}>
                    <td>
                      <div className="member-cell">
                        <div className="avatar">
                          {row.avatar_url
                            ? <img src={row.avatar_url} alt="" />
                            : initials(row.display_name, row.email)
                          }
                        </div>
                        <div>
                          <div className="member-name">
                            {row.display_name || row.email?.split('@')[0] || '—'}
                            {isMe && <span className="member-you">(you)</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="member-email">{row.email || '—'}</td>
                    <td>
                      <span className={`role-badge role-${row.role}`}>
                        {ROLE_LABELS[row.role] || row.role}
                      </span>
                    </td>
                    <td>
                      {row.two_factor_enabled
                        ? <span className="tfa-yes" title="2FA enabled"><Check size={14} strokeWidth={2} /></span>
                        : <span className="tfa-no" title="2FA disabled">—</span>
                      }
                    </td>
                    <td className="actions-cell" ref={openMenu === row.id ? menuRef : null}>
                      {canEdit && (
                        <>
                          <button
                            className="dot-btn"
                            onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)}
                          >
                            <MoreHorizontal size={16} strokeWidth={1.75} />
                          </button>
                          {openMenu === row.id && (
                            <div className="dropdown">
                              <div className="dropdown-section">
                                <div className="dropdown-label">Change role</div>
                                {ROLES.map(r => (
                                  <button
                                    key={r}
                                    className={`dropdown-item${row.role === r ? ' active' : ''}`}
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
                              <div className="dropdown-divider" />
                              <div className="dropdown-section">
                                <button
                                  className="dropdown-item danger"
                                  onClick={() => { setOpenMenu(null); setRemoveTarget(row) }}
                                >
                                  <X size={14} strokeWidth={1.75} />
                                  Remove member
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

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Invite member</div>
                <div className="modal-sub">They'll receive an email with a link to join.</div>
              </div>
              <button className="modal-close" onClick={() => setShowInvite(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="modal-body">
                <div className="field">
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
                <div className="field">
                  <label>Role</label>
                  <div className="role-cards">
                    {ROLES.map(r => (
                      <div
                        key={r}
                        className={`role-card${inviteRole === r ? ' selected' : ''}`}
                        onClick={() => setInviteRole(r)}
                      >
                        <div className="role-card-name">{ROLE_LABELS[r]}</div>
                        <div className="role-card-desc">{ROLE_DESCS[r]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowInvite(false)}>
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
          </div>
        </div>
      )}

      {/* Remove Confirm Modal */}
      {removeTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRemoveTarget(null)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Remove member</div>
                <div className="modal-sub">This action cannot be undone.</div>
              </div>
              <button className="modal-close" onClick={() => setRemoveTarget(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#FEF2F2', borderRadius: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={16} strokeWidth={1.75} style={{ color: '#EF4444', marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#1C0F36' }}>
                  <strong>{removeTarget.display_name || removeTarget.email}</strong> will lose access to this workspace immediately.
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setRemoveTarget(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleRemove} disabled={removing}>
                {removing
                  ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Removing…</>
                  : 'Remove member'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'error'
            ? <AlertCircle size={16} strokeWidth={1.75} />
            : <Check size={16} strokeWidth={2} />
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}
