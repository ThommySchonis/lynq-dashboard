'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bug, Lightbulb, MessageSquare, Inbox, Search, X, Send, ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'

const TYPE_META = {
  bug:      { label: 'Bug',      Icon: Bug,           bg: '#FEE2E2', fg: '#EF4444' },
  feedback: { label: 'Feedback', Icon: Lightbulb,     bg: '#EDE5FE', fg: '#A175FC' },
  other:    { label: 'Other',    Icon: MessageSquare, bg: '#F1EEF5', fg: '#6B5E7B' },
}

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - then)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  const y = Math.floor(mo / 12)
  return `${y}y ago`
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

function initialsFor(user) {
  if (!user) return '?'
  const src = user.name || user.email || '?'
  return src.split(/[ @._]/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
}

export default function LynqAdminFeedbackPage() {
  const router = useRouter()
  const addToast = (message, type = 'success') => toast[type === 'error' ? 'error' : 'success'](message)
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState([])
  const [filter, setFilter] = useState('all') // 'all' | 'bug' | 'feedback' | 'other'
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      const res = await fetch('/api/lynq-admin/feedback', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      if (cancelled) return
      if (res.status === 403 || res.status === 401) {
        addToast('Access denied', 'error')
        setTimeout(() => router.replace('/inbox'), 400)
        return
      }
      if (!res.ok) {
        addToast('Could not load feedback', 'error')
        setLoading(false)
        return
      }
      const data = await res.json()
      if (!cancelled) {
        setSubmissions(data.submissions || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [router, addToast])

  const counts = useMemo(() => {
    const c = { all: submissions.length, bug: 0, feedback: 0, other: 0 }
    for (const s of submissions) c[s.type] = (c[s.type] || 0) + 1
    return c
  }, [submissions])

  const visible = useMemo(() => {
    let list = submissions
    if (filter !== 'all') list = list.filter(s => s.type === filter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(s =>
      (s.message || '').toLowerCase().includes(q)
      || (s.user?.email || '').toLowerCase().includes(q)
      || (s.workspace?.name || '').toLowerCase().includes(q)
    )
    return list
  }, [submissions, filter, search])

  return (
    <div style={{
      flex: 1, minHeight: '100vh', overflow: 'auto',
      background: '#F8F7FA',
      color: '#1C0F36',
    }}>
      <div style={{ minHeight: '100vh' }}>
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid #F0EDF4', paddingBottom: 20, marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>Feedback</h1>
            <p style={{ fontSize: 14, color: '#6B5E7B', margin: '6px 0 0 0' }}>
              Bug reports and suggestions from customers.
            </p>
          </div>

          {/* Filter bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 16, marginBottom: 20, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'bug', label: 'Bug' },
                { key: 'feedback', label: 'Feedback' },
                { key: 'other', label: 'Other' },
              ].map(({ key, label }) => {
                const active = filter === key
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    style={{
                      height: 36, padding: '0 12px',
                      borderRadius: 8,
                      background: active ? '#EDE5FE' : '#F8F7FA',
                      border: `1px solid ${active ? '#A175FC' : '#E5E0EB'}`,
                      color: active ? '#A175FC' : '#6B5E7B',
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {label}
                    <span style={{
                      fontSize: 12,
                      color: active ? '#A175FC' : '#9B91A8',
                      fontWeight: 400,
                    }}>
                      ({counts[key] || 0})
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{ position: 'relative', width: 260 }}>
              <Search
                size={14}
                strokeWidth={1.75}
                color="#9B91A8"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search messages..."
                style={{
                  width: '100%', height: 36,
                  padding: '0 12px 0 34px',
                  borderRadius: 8,
                  border: '1px solid #E5E0EB',
                  background: '#F8F7FA',
                  fontSize: 13, fontFamily: 'inherit',
                  color: '#1C0F36',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{
            background: '#FFFFFF', borderRadius: 12,
            border: '1px solid #E5E0EB',
            overflow: 'hidden',
          }}>
            {loading ? (
              <div style={{ padding: 80, textAlign: 'center', color: '#9B91A8', fontSize: 13 }}>
                Loading…
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                hasFilter={filter !== 'all' || search.trim().length > 0}
                onClear={() => { setFilter('all'); setSearch('') }}
              />
            ) : (
              <>
                {/* Header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 200px 160px 200px 110px',
                  gap: 12,
                  padding: '10px 16px',
                  background: '#F8F7FA',
                  borderBottom: '1px solid #F0EDF4',
                  fontSize: 11, fontWeight: 600, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: '#9B91A8',
                }}>
                  <div>Type</div>
                  <div>Message</div>
                  <div>User</div>
                  <div>Workspace</div>
                  <div>Page</div>
                  <div>Submitted</div>
                </div>
                {visible.map(row => (
                  <Row key={row.id} row={row} onClick={() => setSelected(row)} />
                ))}
              </>
            )}
          </div>
        </main>
      </div>

      {selected && (
        <DetailPanel row={selected} onClose={() => setSelected(null)} />
      )}

    </div>
  )
}

function Row({ row, onClick }) {
  const meta = TYPE_META[row.type] || TYPE_META.other
  const Icon = meta.Icon
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 200px 160px 200px 110px',
        gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid #F0EDF4',
        cursor: 'pointer',
        transition: 'background .12s',
        alignItems: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#F8F7FA' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}
    >
      <div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px',
          borderRadius: 6,
          background: meta.bg,
          color: meta.fg,
          fontSize: 12, fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '.04em',
        }}>
          <Icon size={12} strokeWidth={1.75} />
          {meta.label}
        </span>
      </div>
      <div style={{ fontSize: 14, color: '#1C0F36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {truncate(row.message, 80)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: '#EDE5FE', color: '#A175FC',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600, flexShrink: 0,
        }}>
          {initialsFor(row.user)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1C0F36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.user?.name || row.user?.email?.split('@')[0] || 'Unknown'}
          </div>
          <div style={{ fontSize: 12, color: '#9B91A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.user?.email || '—'}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#6B5E7B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.workspace?.name || '—'}
      </div>
      <div style={{
        fontSize: 12, color: '#9B91A8',
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {row.page_url || '—'}
      </div>
      <div style={{ fontSize: 13, color: '#6B5E7B' }}>
        {timeAgo(row.created_at)}
      </div>
    </div>
  )
}

function EmptyState({ hasFilter, onClear }) {
  return (
    <div style={{ padding: 80, textAlign: 'center' }}>
      <Inbox size={48} strokeWidth={1.5} color="#9B91A8" style={{ marginBottom: 16 }} />
      {hasFilter ? (
        <>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#6B5E7B' }}>
            No feedback matches your filters
          </div>
          <button
            onClick={onClear}
            style={{
              marginTop: 12,
              background: 'none', border: 'none',
              color: '#A175FC', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Clear filters
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#6B5E7B' }}>No feedback yet</div>
          <div style={{ fontSize: 13, color: '#9B91A8', marginTop: 4 }}>
            When customers send feedback, it&apos;ll show up here.
          </div>
        </>
      )}
    </div>
  )
}

function DetailPanel({ row, onClose }) {
  const meta = TYPE_META[row.type] || TYPE_META.other
  const Icon = meta.Icon
  const replyHref = row.user?.email
    ? `mailto:${row.user.email}?subject=${encodeURIComponent('Re: Your Lynq & Flow feedback')}`
    : null

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(28,15,54,0.25)', zIndex: 60,
        }}
      />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 480, maxWidth: '100%', zIndex: 61,
        background: '#FFFFFF',
        boxShadow: '-8px 0 24px rgba(28,15,54,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'fbPanel .2s cubic-bezier(.16,1,.3,1)',
      }}>
        <style>{`@keyframes fbPanel { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #F0EDF4',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              background: meta.bg, color: meta.fg,
              fontSize: 12, fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
              <Icon size={12} strokeWidth={1.75} />
              {meta.label}
            </span>
            <span style={{ fontSize: 13, color: '#9B91A8' }}>
              {new Date(row.created_at).toLocaleString()}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: '#9B91A8', display: 'flex',
            }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          <Section title="Message">
            <div style={{
              background: '#F8F7FA',
              borderRadius: 8,
              padding: 12,
              fontSize: 14, color: '#1C0F36', lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {row.message}
            </div>
          </Section>

          <Section title="From">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#EDE5FE', color: '#A175FC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}>
                {initialsFor(row.user)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1C0F36' }}>
                  {row.user?.name || row.user?.email?.split('@')[0] || 'Unknown user'}
                </div>
                <div style={{ fontSize: 13, color: '#6B5E7B' }}>{row.user?.email || '—'}</div>
                <div style={{ fontSize: 12, color: '#9B91A8', marginTop: 2 }}>
                  Workspace: {row.workspace?.name || '—'}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Context">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B91A8', marginBottom: 4 }}>
                  Page
                </div>
                {row.page_url ? (
                  <a
                    href={row.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 13, color: '#A175FC',
                      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      wordBreak: 'break-all',
                    }}
                  >
                    {row.page_url}
                    <ExternalLink size={12} strokeWidth={1.75} />
                  </a>
                ) : (
                  <span style={{ fontSize: 13, color: '#9B91A8' }}>—</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B91A8', marginBottom: 4 }}>
                  User agent
                </div>
                <div style={{
                  fontSize: 12, color: '#9B91A8',
                  fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
                  wordBreak: 'break-all',
                }}>
                  {row.user_agent || '—'}
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #F0EDF4',
        }}>
          <a
            href={replyHref || '#'}
            onClick={e => { if (!replyHref) e.preventDefault() }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 36, padding: '0 14px',
              background: '#FFFFFF',
              border: '1px solid #1C0F36',
              color: '#1C0F36',
              borderRadius: 8,
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              opacity: replyHref ? 1 : 0.5,
              cursor: replyHref ? 'pointer' : 'not-allowed',
            }}
          >
            <Send size={14} strokeWidth={1.75} />
            Reply via email
          </a>
        </div>
      </aside>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid #F0EDF4' }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '.08em',
        textTransform: 'uppercase', color: '#9B91A8',
        marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}
