'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { UserPlus, X, Copy, Check, ChevronDown, Users, Clock } from 'lucide-react'

// ─── helpers ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#A175FC','#6366F1','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#EF4444']

function avatarColor(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name, email) {
  if (name) return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return ((email || '?')[0]).toUpperCase()
}

function roleBadge(role) {
  if (role === 'owner')    return { bg: '#EDE5FE', color: '#7C3AED', label: 'Owner'    }
  if (role === 'admin')    return { bg: '#EBEBEB', color: '#374151', label: 'Admin'    }
  if (role === 'agent')    return { bg: '#F0EDF4', color: '#6B5E7B', label: 'Agent'    }
  /* observer */           return { bg: '#F5F5F5', color: '#9B91A8', label: 'Observer' }
}

function daysUntil(iso) {
  return Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000))
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── sub-components ─────────────────────────────────────────────────────────

function Avatar({ name, email, size = 36 }) {
  const bg = avatarColor(email || name || '')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.36, fontWeight: 600, flexShrink: 0,
      letterSpacing: '0.02em',
    }}>
      {initials(name, email)}
    </div>
  )
}

function RoleBadge({ role }) {
  const { bg, color, label } = roleBadge(role)
  return (
    <span style={{
      background: bg, color, fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function CopyButton({ text, small }) {
  const [done, setDone] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }
  return (
    <button onClick={copy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '4px 8px' : '6px 12px',
      fontSize: 12, fontWeight: 500, cursor: 'pointer',
      background: done ? 'rgba(16,185,129,0.08)' : '#F8F7FA',
      color: done ? '#10B981' : '#6B5E7B',
      border: `1px solid ${done ? 'rgba(16,185,129,0.25)' : '#E5E0EB'}`,
      borderRadius: 6, transition: 'all 0.15s',
      fontFamily: "'Switzer', -apple-system, sans-serif",
    }}>
      {done ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.75} />}
      {done ? 'Copied' : 'Copy link'}
    </button>
  )
}

// ─── role dropdown ───────────────────────────────────────────────────────────

function RoleDropdown({ currentRole, memberId, onSelect, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { label } = roleBadge(currentRole)

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', fontSize: 12, fontWeight: 500,
          background: 'transparent', border: '1px solid #E5E0EB',
          borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
          color: '#6B5E7B', opacity: disabled ? 0.4 : 1,
          fontFamily: "'Switzer', -apple-system, sans-serif",
        }}
      >
        {label} <ChevronDown size={11} strokeWidth={1.75} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: '#fff', border: '1px solid #E5E0EB', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 50,
          minWidth: 130, overflow: 'hidden',
        }}>
          {['admin', 'agent', 'observer'].map(r => {
            const { label: lbl } = roleBadge(r)
            return (
              <button
                key={r}
                onMouseDown={() => { onSelect(memberId, r); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: 13,
                  background: r === currentRole ? '#F8F7FA' : 'transparent',
                  color: r === currentRole ? '#A175FC' : '#1C0F36',
                  fontWeight: r === currentRole ? 500 : 400,
                  border: 'none', cursor: 'pointer',
                  fontFamily: "'Switzer', -apple-system, sans-serif",
                }}
              >
                {lbl}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── invite modal ────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited, sessionToken }) {
  const [email, setEmail]       = useState('')
  const [role, setRole]         = useState('agent')
  const [busy, setBusy]         = useState(false)
  const [result, setResult]     = useState(null)  // { link } | { error }
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setResult(null)
    const res = await fetch('/api/workspaces/current/members', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })
    const data = await res.json()
    if (res.ok) {
      setResult({ link: data.inviteLink })
      onInvited(data.invite)
    } else {
      setResult({ error: data.error })
    }
    setBusy(false)
  }

  function another() {
    setEmail('')
    setRole('agent')
    setResult(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(28,15,54,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 24,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460,
        boxShadow: '0 16px 48px rgba(28,15,54,0.18)',
        fontFamily: "'Switzer', -apple-system, sans-serif",
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1C0F36' }}>
            Invite team member
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: '#9B91A8', borderRadius: 4, display: 'flex',
          }}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {!result?.link ? (
            <form onSubmit={submit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B5E7B', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  ref={inputRef}
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '9px 12px', fontSize: 14, borderRadius: 8,
                    border: '1px solid #E5E0EB', color: '#1C0F36',
                    outline: 'none', background: '#fff',
                    fontFamily: "'Switzer', -apple-system, sans-serif",
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B5E7B', marginBottom: 8 }}>
                  Role
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { value: 'observer', label: 'Observer', desc: 'View tickets and customers, but can\'t reply or make changes.' },
                    { value: 'agent',    label: 'Agent',    desc: 'Reply to tickets, manage customers, and use integrations like Shopify.' },
                    { value: 'admin',    label: 'Admin',    desc: 'Full access to workspace settings, members, and integrations. Can\'t manage billing.' },
                  ].map(opt => {
                    const selected = role === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          border: selected ? '1.5px solid #A175FC' : '1px solid #E5E0EB',
                          background: selected ? 'rgba(161,117,252,0.04)' : '#fff',
                          fontFamily: "'Switzer', -apple-system, sans-serif",
                          transition: 'border-color 0.12s, background 0.12s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                            border: selected ? '4px solid #A175FC' : '1.5px solid #D1C4E9',
                            boxSizing: 'border-box', background: selected ? '#A175FC' : '#fff',
                            transition: 'all 0.12s',
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: selected ? '#A175FC' : '#1C0F36' }}>
                            {opt.label}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0 22px', fontSize: 12, color: '#9B91A8', lineHeight: 1.5 }}>
                          {opt.desc}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {result?.error && (
                <p style={{ fontSize: 13, color: '#EF4444', margin: '0 0 14px', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 6 }}>
                  {result.error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !email.trim()}
                style={{
                  width: '100%', height: 40, borderRadius: 8, border: 'none',
                  background: busy || !email.trim() ? '#D4C5F9' : '#A175FC',
                  color: '#fff', fontSize: 14, fontWeight: 500, cursor: busy || !email.trim() ? 'default' : 'pointer',
                  fontFamily: "'Switzer', -apple-system, sans-serif",
                  transition: 'background 0.15s',
                }}
              >
                {busy ? 'Sending…' : 'Send invite'}
              </button>
            </form>
          ) : (
            <div>
              <div style={{
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 8, padding: '12px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Check size={15} strokeWidth={2} color="#10B981" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#065F46', fontWeight: 500 }}>
                  Invite sent to {email}
                </span>
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B5E7B', marginBottom: 6 }}>
                Or share this link directly
              </label>
              <div style={{
                display: 'flex', gap: 8, padding: '8px 10px',
                background: '#F8F7FA', border: '1px solid #E5E0EB', borderRadius: 8,
                marginBottom: 16,
              }}>
                <span style={{
                  flex: 1, fontSize: 12, color: '#6B5E7B', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', alignSelf: 'center',
                }}>
                  {result.link}
                </span>
                <CopyButton text={result.link} small />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={another} style={{
                  flex: 1, height: 36, borderRadius: 8, border: '1px solid #E5E0EB',
                  background: '#fff', fontSize: 13, fontWeight: 500, color: '#1C0F36',
                  cursor: 'pointer', fontFamily: "'Switzer', -apple-system, sans-serif",
                }}>
                  Invite another
                </button>
                <button onClick={onClose} style={{
                  flex: 1, height: 36, borderRadius: 8, border: 'none',
                  background: '#A175FC', fontSize: 13, fontWeight: 500, color: '#fff',
                  cursor: 'pointer', fontFamily: "'Switzer', -apple-system, sans-serif",
                }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── remove confirm dialog ───────────────────────────────────────────────────

function RemoveConfirm({ member, onConfirm, onCancel, busy }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(28,15,54,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 24,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 380,
        padding: '28px 28px 24px',
        boxShadow: '0 16px 48px rgba(28,15,54,0.18)',
        fontFamily: "'Switzer', -apple-system, sans-serif",
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#1C0F36' }}>
          Remove member?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6B5E7B', lineHeight: 1.5 }}>
          <strong style={{ color: '#1C0F36' }}>{member.name || member.email}</strong> will lose access to this workspace immediately.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 38, borderRadius: 8, border: '1px solid #E5E0EB',
            background: '#fff', fontSize: 13, fontWeight: 500, color: '#1C0F36',
            cursor: 'pointer', fontFamily: "'Switzer', -apple-system, sans-serif",
          }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(member.id)} disabled={busy} style={{
            flex: 1, height: 38, borderRadius: 8, border: 'none',
            background: busy ? '#FCA5A5' : '#EF4444', fontSize: 13, fontWeight: 500,
            color: '#fff', cursor: busy ? 'default' : 'pointer',
            fontFamily: "'Switzer', -apple-system, sans-serif",
          }}>
            {busy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function MembersPage() {
  const [loading,       setLoading]       = useState(true)
  const [session,       setSession]       = useState(null)
  const [workspace,     setWorkspace]     = useState(null)
  const [members,       setMembers]       = useState([])
  const [invites,       setInvites]       = useState([])
  const [myRole,        setMyRole]        = useState('member')
  const [showModal,     setShowModal]     = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [removing,      setRemoving]      = useState(false)

  const loadData = useCallback(async (sess) => {
    const token = sess?.access_token
    if (!token) { setLoading(false); return }

    const [wsRes, membersRes] = await Promise.all([
      fetch('/api/workspaces/current',         { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/workspaces/current/members', { headers: { Authorization: `Bearer ${token}` } }),
    ])

    if (wsRes.ok) {
      const d = await wsRes.json()
      setWorkspace(d.workspace)
    }
    if (membersRes.ok) {
      const d = await membersRes.json()
      setMembers(d.members || [])
      setInvites(d.invites || [])
      const me = d.members?.find(m => m.user_id === sess.user.id)
      if (me) setMyRole(me.role)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadData(data.session)
    })
  }, [loadData])

  async function handleRoleChange(memberId, newRole) {
    const token = session?.access_token
    const res = await fetch(`/api/workspaces/current/members/${memberId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  async function handleRemove(memberId) {
    setRemoving(true)
    const token = session?.access_token
    await fetch(`/api/workspaces/current/members/${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setConfirmRemove(null)
    setRemoving(false)
  }

  async function handleRevoke(inviteId) {
    const token = session?.access_token
    await fetch(`/api/workspaces/current/members/${inviteId}?type=invite`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setInvites(prev => prev.filter(i => i.id !== inviteId))
  }

  const canManage = ['owner', 'admin'].includes(myRole)
  const canChangeRoles = ['owner', 'admin'].includes(myRole)

  // ── skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '40px', fontFamily: "'Switzer', -apple-system, sans-serif", background: '#F8F7FA', minHeight: '100vh' }}>
        <div style={{ maxWidth: 800 }}>
          <div style={{ height: 28, width: 120, background: '#E5E0EB', borderRadius: 6, marginBottom: 32 }} />
          <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, overflow: 'hidden' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '16px 20px', borderBottom: i < 3 ? '1px solid #F0EDF4' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E5E0EB' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: 140, background: '#E5E0EB', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ height: 11, width: 200, background: '#F0EDF4', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── main render ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '40px', fontFamily: "'Switzer', -apple-system, sans-serif", background: '#F8F7FA', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, fontSize: 12, color: '#9B91A8' }}>
          <span>Settings</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          <span>Workspace</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          <span style={{ color: '#6B5E7B' }}>Members</span>
        </div>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#1C0F36', lineHeight: 1.2 }}>
              Members
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9B91A8' }}>
              {members.length} {members.length === 1 ? 'person' : 'people'} in {workspace?.name || 'your workspace'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 16px', height: 36, borderRadius: 8, border: 'none',
                background: '#A175FC', color: '#fff',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: "'Switzer', -apple-system, sans-serif",
              }}
            >
              <UserPlus size={14} strokeWidth={1.75} />
              Invite member
            </button>
          )}
        </div>

        {/* Members card */}
        <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF4', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={14} strokeWidth={1.75} color="#9B91A8" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9B91A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Active members
            </span>
          </div>

          {members.map((member, idx) => {
            const isMe = member.user_id === session?.user?.id
            const isOwnerRow = member.role === 'owner'
            const showActions = canManage && !isMe && !isOwnerRow

            return (
              <div key={member.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                borderBottom: idx < members.length - 1 ? '1px solid #F0EDF4' : 'none',
              }}>
                <Avatar name={member.name} email={member.email} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#1C0F36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.name || member.email}
                    </span>
                    {isMe && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#9B91A8', background: '#F0EDF4', padding: '1px 6px', borderRadius: 3, letterSpacing: '0.04em' }}>
                        YOU
                      </span>
                    )}
                  </div>
                  {member.name && (
                    <span style={{ fontSize: 12, color: '#9B91A8' }}>{member.email}</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: '#9B91A8', whiteSpace: 'nowrap' }}>
                    {fmtDate(member.joined_at)}
                  </span>

                  {canChangeRoles && !isOwnerRow && !isMe ? (
                    <RoleDropdown
                      currentRole={member.role}
                      memberId={member.id}
                      onSelect={handleRoleChange}
                    />
                  ) : (
                    <RoleBadge role={member.role} />
                  )}

                  {showActions ? (
                    <button
                      onClick={() => setConfirmRemove(member)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: 'none',
                        background: 'transparent', cursor: 'pointer', color: '#9B91A8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.1s, color 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#EF4444' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9B91A8' }}
                      title="Remove member"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  ) : (
                    <div style={{ width: 28 }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pending invites card */}
        {invites.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF4', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} strokeWidth={1.75} color="#9B91A8" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#9B91A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pending invites
              </span>
              <span style={{
                marginLeft: 2, fontSize: 10, fontWeight: 600, padding: '1px 6px',
                borderRadius: 10, background: '#F0EDF4', color: '#9B91A8',
              }}>
                {invites.length}
              </span>
            </div>

            {invites.map((invite, idx) => (
              <div key={invite.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                borderBottom: idx < invites.length - 1 ? '1px solid #F0EDF4' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#F0EDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9B91A8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#1C0F36', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>
                    {invite.email}
                  </span>
                  <span style={{ fontSize: 12, color: '#9B91A8' }}>
                    Expires in {daysUntil(invite.expires_at)}d
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <RoleBadge role={invite.role} />
                  <CopyButton text={`${typeof window !== 'undefined' ? window.location.origin : ''}/invites/${invite.token}`} small />
                  {canManage && (
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: 'none',
                        background: 'transparent', cursor: 'pointer', color: '#9B91A8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.1s, color 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#EF4444' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9B91A8' }}
                      title="Revoke invite"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Modals */}
      {showModal && (
        <InviteModal
          onClose={() => setShowModal(false)}
          onInvited={invite => setInvites(prev => [invite, ...prev])}
          sessionToken={session?.access_token}
        />
      )}
      {confirmRemove && (
        <RemoveConfirm
          member={confirmRemove}
          onConfirm={handleRemove}
          onCancel={() => setConfirmRemove(null)}
          busy={removing}
        />
      )}
    </div>
  )
}
