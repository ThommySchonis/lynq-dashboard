'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Design tokens ────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This week' },
  { id: 'month', label: 'This month' },
]

const CSS = `
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pauseBlink{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4)}70%{box-shadow:0 0 0 6px rgba(16,185,129,0)}}

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  }

  .tt-root *{box-sizing:border-box;margin:0;padding:0}
  .tt-root{font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased}
  .tt-scroll::-webkit-scrollbar{width:3px}
  .tt-scroll::-webkit-scrollbar-track{background:transparent}
  .tt-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:2px}

  .card{background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:10px;overflow:hidden}
  .card-hdr{padding:14px 18px;border-bottom:1px solid rgba(0,0,0,0.06)}

  .clock-card{
    background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:12px;
    padding:24px 28px;position:relative;overflow:hidden;
    display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;
  }
  .clock-card::before{
    content:'';position:absolute;top:0;left:0;right:0;height:2px;
    background:var(--clock-grad,linear-gradient(90deg,#8B5CF6,#6366F1));
  }

  .kpi-card{
    background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:10px;
    padding:18px 20px;position:relative;overflow:hidden;cursor:default;
    transition:border-color .2s ease;
  }
  .kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--kpi-grad)}
  .kpi-card:hover{border-color:rgba(0,0,0,0.12)}

  .btn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 20px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s ease;flex-shrink:0}
  .btn:disabled{opacity:.45;cursor:not-allowed}
  .btn-in{background:#0F0F10;color:#fff}
  .btn-in:hover:not(:disabled){background:#1a1a1a}
  .btn-out{background:#EF4444;color:#fff}
  .btn-out:hover:not(:disabled){background:#DC2626}
  .btn-pause{background:#F5F5F5;color:#374151;border:1px solid rgba(0,0,0,0.08)!important}
  .btn-pause:hover:not(:disabled){background:#EBEBEB}
  .btn-resume{background:#F5F5F5;color:#374151;border:1px solid rgba(0,0,0,0.08)!important}
  .btn-resume:hover:not(:disabled){background:#EBEBEB}

  .filter-tabs{display:inline-flex;gap:2px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:3px}
  .filter-tab{padding:5px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:none;transition:all .15s ease;color:#6B7280;background:transparent}
  .filter-tab.active{background:#0F0F10;color:#FFFFFF}
  .filter-tab:not(.active):hover{color:#0F0F10;background:rgba(0,0,0,0.04)}

  .member-row{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(0,0,0,0.05);transition:background .15s;cursor:default}
  .member-row:last-child{border-bottom:none}
  .member-row:hover{background:#F9F9FB}

  .session-row{display:grid;grid-template-columns:130px 110px 60px 60px 70px 1fr;gap:12px;align-items:start;padding:11px 18px;border-bottom:1px solid rgba(0,0,0,0.05);transition:background .15s;cursor:default}
  .session-row:last-child{border-bottom:none}
  .session-row:hover{background:#F9F9FB}

  .emp-row{display:grid;grid-template-columns:130px 140px 70px 1fr;gap:12px;align-items:start;padding:11px 18px;border-bottom:1px solid rgba(0,0,0,0.05);transition:background .15s;cursor:default}
  .emp-row:last-child{border-bottom:none}
  .emp-row:hover{background:#F9F9FB}

  .modal-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);padding:24px}
  .modal-box{background:#FFFFFF;border:1px solid rgba(0,0,0,0.09);border-radius:12px;padding:28px;width:100%;max-width:500px}
  .modal-ta{width:100%;min-height:120px;resize:vertical;background:#F5F5F5;border:1px solid rgba(0,0,0,0.08);border-radius:8px;color:#0F0F10;font-size:13px;font-family:inherit;padding:12px 14px;outline:none;transition:border-color .15s;line-height:1.55}
  .modal-ta:focus{border-color:rgba(0,0,0,0.2)}
  .modal-ta::placeholder{color:#9CA3AF}

  .err-toast{display:flex;align-items:center;gap:10px;background:#FEF2F2;border:1px solid rgba(220,38,38,0.15);border-radius:8px;padding:10px 14px;color:#DC2626;font-size:13px;font-weight:500;animation:fadeIn .25s ease both}
  .green-dot{width:8px;height:8px;border-radius:50%;background:#10B981;animation:pulse 2s ease-in-out infinite;flex-shrink:0}
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function fmtDur(sec) {
  if (!sec || sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function durSec(s) {
  if (s.clocked_out_at) return Math.round((new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000)
  return (s.active_seconds || 0) + (s.idle_seconds || 0)
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function Spinner({ size = 18 }) {
  return (
    <div style={{ width: size, height: size, border: '2px solid rgba(0,0,0,0.08)', borderTop: '2px solid #0F0F10', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
  )
}

function FilterTabs({ filter, onChange }) {
  return (
    <div className="filter-tabs">
      {FILTERS.map(f => (
        <button key={f.id} className={`filter-tab${filter === f.id ? ' active' : ''}`} onClick={() => onChange(f.id)}>
          {f.label}
        </button>
      ))}
    </div>
  )
}

// ─── Clock-out Modal ──────────────────────────────────────────────────────────

function ClockOutModal({ session, elapsedSec, pausedSeconds, onConfirm, onCancel, submitting }) {
  const [report, setReport] = useState('')
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F0F10', marginBottom: 4 }}>End of Day Report</h2>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 18 }}>
          Clock-in: {fmtTime(session.clocked_in_at)} · Active: {fmtDur(elapsedSec)}
          {pausedSeconds > 0 && <> · Paused: {fmtDur(pausedSeconds)}</>}
        </div>
        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 16 }} />
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
          What did you work on today? <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <textarea
          className="modal-ta"
          value={report}
          onChange={e => setReport(e.target.value)}
          placeholder="Describe your tasks, client work, what you completed or progressed on…"
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={submitting}
            style={{ padding: '0 18px', height: 36, borderRadius: 7, border: '1px solid rgba(0,0,0,0.09)', background: '#F5F5F5', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(report)} disabled={submitting || !report.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', height: 36, borderRadius: 7, border: 'none', background: report.trim() ? '#0F0F10' : 'rgba(0,0,0,0.12)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: report.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all .15s' }}>
            {submitting ? <><Spinner size={13} />Clocking out…</> : 'Clock Out →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Team view components (admin / client admin) ──────────────────────────────

function MemberRow({ member: m }) {
  const active  = m.is_active && !m.is_paused
  const paused  = m.is_paused
  const dotColor    = paused ? '#F59E0B' : active ? '#10B981' : '#D1D5DB'
  const badgeBg     = paused ? 'rgba(245,158,11,0.08)'  : active ? 'rgba(16,185,129,0.08)' : '#F5F5F5'
  const badgeBorder = paused ? 'rgba(245,158,11,0.2)'   : active ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.08)'
  const badgeColor  = paused ? '#D97706' : active ? '#059669' : '#9CA3AF'
  const badgeLabel  = paused ? 'Paused'  : active ? 'Online'  : 'Offline'

  return (
    <div className="member-row">
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0F0F0', border: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#555', flexShrink: 0 }}>
        {m.name?.charAt(0).toUpperCase() || '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#0F0F10' }}>{m.name}</div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>{m.role}</div>
      </div>
      <div style={{ textAlign: 'right', marginRight: 16, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F0F10', fontVariantNumeric: 'tabular-nums' }}>{fmtDur(m.worked_seconds)}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{m.sessions_count} session{m.sessions_count !== 1 ? 's' : ''}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: badgeBg, border: `1px solid ${badgeBorder}`, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: badgeColor }}>{badgeLabel}</span>
      </div>
    </div>
  )
}

function AdminLogRow({ session: s }) {
  return (
    <div className="session-row">
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F0F10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.member_name}</div>
      <div style={{ fontSize: 12.5, color: '#6B7280' }}>{fmtDate(s.clocked_in_at)}</div>
      <div style={{ fontSize: 12.5, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.clocked_in_at)}</div>
      <div style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: s.clocked_out_at ? '#6B7280' : '#059669' }}>{s.clocked_out_at ? fmtTime(s.clocked_out_at) : 'Active'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F0F10', fontVariantNumeric: 'tabular-nums' }}>{fmtDur(durSec(s))}</div>
      <div style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {s.eod_report || <span style={{ color: '#D1D5DB', fontStyle: 'italic' }}>No report</span>}
      </div>
    </div>
  )
}

const TEAM_KPI = [
  { key: 'active', label: 'ACTIVE NOW',  grad: 'linear-gradient(90deg,#10B981,#34D399)', iconBg: 'rgba(16,185,129,0.08)',  iconColor: '#10B981' },
  { key: 'break',  label: 'ON BREAK',    grad: 'linear-gradient(90deg,#F59E0B,#FBBF24)', iconBg: 'rgba(245,158,11,0.08)',  iconColor: '#F59E0B' },
  { key: 'total',  label: 'TOTAL HOURS', grad: 'linear-gradient(90deg,#8B5CF6,#A78BFA)', iconBg: 'rgba(139,92,246,0.08)',  iconColor: '#8B5CF6' },
  { key: 'team',   label: 'TEAM SIZE',   grad: 'linear-gradient(90deg,#3B82F6,#60A5FA)', iconBg: 'rgba(59,130,246,0.08)',  iconColor: '#3B82F6' },
]

function KpiIcon({ id, color }) {
  const s = { fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (id === 'active' || id === 'total') return <svg width="14" height="14" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  if (id === 'break')  return <svg width="14" height="14" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="14" y1="9" x2="14" y2="15"/></svg>
  if (id === 'week')   return <svg width="14" height="14" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  if (id === 'today')  return <svg width="14" height="14" viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  if (id === 'avg')    return <svg width="14" height="14" viewBox="0 0 24 24" {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  return <svg width="14" height="14" viewBox="0 0 24 24" {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}

function EmptyState({ icon = 'clock', title, sub }) {
  return (
    <div style={{ padding: '48px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <KpiIcon id={icon} color="#D1D5DB" />
      <div style={{ fontSize: 14, fontWeight: 500, color: '#0F0F10' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#6B7280' }}>{sub}</div>
    </div>
  )
}

function TeamView({ data, filter, onFilterChange }) {
  const { members = [], sessions = [], active_count = 0, paused_count = 0, client } = data
  const totalSec = members.reduce((sum, m) => sum + (m.worked_seconds || 0), 0)

  const kpiValues = {
    active: String(active_count),
    break:  String(paused_count),
    total:  fmtDur(totalSec),
    team:   String(members.length),
  }
  const kpiSubs = {
    active: 'clocked in',
    break:  'paused',
    total:  `${sessions.length} sessions`,
    team:   'members',
  }

  return (
    <div className="tt-root" style={{ display: 'flex', minHeight: '100vh', background: '#F9F9FB' }}>
      <style>{CSS}</style>
      <Sidebar />
      <main className="tt-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          <div style={{ animation: 'fadeIn .4s ease both', marginBottom: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', marginBottom: 4 }}>
              Team Time Tracking
            </h1>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              {client ? client.company_name : 'All clients'} · {active_count + paused_count} active now
            </div>
            <FilterTabs filter={filter} onChange={onFilterChange} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16, animation: 'fadeIn .4s ease .05s both' }}>
            {TEAM_KPI.map(({ key, label, grad, iconBg, iconColor }) => (
              <div key={key} className="kpi-card" style={{ '--kpi-grad': grad }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <KpiIcon id={key} color={iconColor} />
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {kpiValues[key] || '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{kpiSubs[key]}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 14, animation: 'fadeIn .4s ease .1s both' }}>
            <div className="card-hdr">
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F0F10' }}>Team Members</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Status and hours per member this period</div>
            </div>
            {members.length === 0
              ? <EmptyState title="No team members" sub="Add team members via the admin panel" />
              : members.map(m => <MemberRow key={m.id} member={m} />)
            }
          </div>

          <div className="card" style={{ animation: 'fadeIn .4s ease .15s both' }}>
            <div className="card-hdr">
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F0F10' }}>Sessions</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>All sessions with end-of-day reports</div>
            </div>
            {sessions.length === 0
              ? <EmptyState title="No sessions yet" sub="Data will appear once team members clock in" />
              : <>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 110px 60px 60px 70px 1fr', gap: 12, padding: '9px 18px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    {['Member','Date','In','Out','Hours','Report'].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                    ))}
                  </div>
                  {sessions.map(s => <AdminLogRow key={s.id} session={s} />)}
                </>
            }
          </div>

        </div>
      </main>
    </div>
  )
}

// ─── Employee metric card config ──────────────────────────────────────────────

const EMP_KPI = [
  { id: 'week',  label: null,         grad: 'linear-gradient(90deg,#8B5CF6,#A78BFA)', iconBg: 'rgba(139,92,246,0.08)', iconColor: '#8B5CF6' },
  { id: 'today', label: 'TODAY',      grad: 'linear-gradient(90deg,#3B82F6,#60A5FA)', iconBg: 'rgba(59,130,246,0.08)', iconColor: '#3B82F6' },
  { id: 'avg',   label: 'AVG PER DAY',grad: 'linear-gradient(90deg,#10B981,#34D399)', iconBg: 'rgba(16,185,129,0.08)', iconColor: '#10B981' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimeTrackingPage() {
  const [loading, setLoading]             = useState(true)
  const [isAdmin, setIsAdmin]             = useState(false)
  const [isClientAdmin, setIsClientAdmin] = useState(false)
  const [teamData, setTeamData]           = useState(null)
  const [adminData, setAdminData]         = useState(null)
  const [accessError, setAccessError]     = useState(false)
  const [member, setMember]               = useState(null)
  const [sessions, setSessions]           = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [elapsed, setElapsed]             = useState(0)
  const [isPaused, setIsPaused]           = useState(false)
  const [todaySeconds, setTodaySeconds]   = useState(0)
  const [filter, setFilter]               = useState('week')
  const [showModal, setShowModal]         = useState(false)
  const [clockingIn, setClockingIn]       = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState('')

  const timerRef      = useRef(null)
  const heartbeatRef  = useRef(null)
  const breakTimerRef = useRef(null)
  const sessionRef    = useRef(null)

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  function restoreElapsed(s) {
    if (!s) return 0
    const total  = Math.round((Date.now() - new Date(s.clocked_in_at)) / 1000)
    const paused = s.paused_seconds || 0
    if (s.status === 'paused' && s.paused_at) {
      const atPause = Math.round((new Date(s.paused_at) - new Date(s.clocked_in_at)) / 1000)
      return Math.max(0, atPause - paused)
    }
    return Math.max(0, total - paused)
  }

  const fetchData = useCallback(async (f) => {
    const token = await getToken()
    if (!token) { window.location.href = '/login'; return }
    const res = await fetch(`/api/time?filter=${f}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 403) { setAccessError(true); setLoading(false); return }
    if (!res.ok) { setLoading(false); return }
    const d = await res.json()
    if (d.is_admin)        { setIsAdmin(true);       setTeamData(d); setAdminData(d); setLoading(false); return }
    if (d.is_client_admin) { setIsClientAdmin(true); setTeamData(d); setLoading(false); return }
    setMember(d.member)
    setSessions(d.sessions || [])
    setTodaySeconds(d.today_seconds || 0)
    if (!sessionRef.current) {
      const active = d.active_session || null
      setActiveSession(active)
      sessionRef.current = active
      if (active) {
        setIsPaused(active.status === 'paused')
        setElapsed(restoreElapsed(active))
      }
    } else {
      setSessions(d.sessions || [])
      setTodaySeconds(d.today_seconds || 0)
    }
    setLoading(false)
  }, [getToken])

  useEffect(() => { fetchData(filter) }, [filter])

  useEffect(() => {
    const handler = (e) => { if (!sessionRef.current) return; e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (activeSession && !isPaused) timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [activeSession?.id, isPaused])

  const [, setBreakTick] = useState(0)
  useEffect(() => {
    clearInterval(breakTimerRef.current)
    if (activeSession && isPaused) breakTimerRef.current = setInterval(() => setBreakTick(t => t + 1), 1000)
    return () => clearInterval(breakTimerRef.current)
  }, [activeSession?.id, isPaused])

  useEffect(() => {
    clearInterval(heartbeatRef.current)
    if (!activeSession || isPaused) return
    heartbeatRef.current = setInterval(async () => {
      const token = await getToken()
      if (!token || !sessionRef.current) return
      await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'heartbeat', session_id: sessionRef.current.id }),
      })
    }, 30000)
    return () => clearInterval(heartbeatRef.current)
  }, [activeSession?.id, isPaused, getToken])

  async function handleClockIn() {
    setClockingIn(true); setError('')
    const token = await getToken()
    const res = await fetch('/api/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'clock-in' }),
    })
    const d = await res.json()
    if (!res.ok || !d.session) {
      setError(d.error === 'Not a team member account'
        ? 'Your account is not set up for time tracking. Ask your admin to add you as a team member.'
        : d.error || 'Could not clock in. Please try again.')
      setClockingIn(false); return
    }
    setActiveSession(d.session); sessionRef.current = d.session
    setElapsed(0); setIsPaused(false); setClockingIn(false)
  }

  async function handlePause() {
    if (!activeSession) return
    const token = await getToken()
    await fetch('/api/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'pause', session_id: activeSession.id }),
    })
    clearInterval(timerRef.current); clearInterval(heartbeatRef.current)
    setIsPaused(true)
    const updated = { ...activeSession, status: 'paused', paused_at: new Date().toISOString() }
    setActiveSession(updated); sessionRef.current = updated
  }

  async function handleResume() {
    if (!activeSession) return
    const token = await getToken()
    const res = await fetch('/api/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'resume', session_id: activeSession.id }),
    })
    const d = await res.json()
    const updated = { ...activeSession, status: 'active', paused_at: null, paused_seconds: d.paused_seconds ?? activeSession.paused_seconds }
    setActiveSession(updated); sessionRef.current = updated; setIsPaused(false)
  }

  async function handleClockOut(report) {
    setSubmitting(true)
    const token = await getToken()
    await fetch('/api/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'clock-out', session_id: activeSession.id, eod_report: report }),
    })
    setActiveSession(null); sessionRef.current = null
    setElapsed(0); setIsPaused(false); setShowModal(false); setSubmitting(false)
    await fetchData('today')
    setTimeout(() => { fetchData(filter) }, 200)
  }

  const pausedSec = (() => {
    if (!activeSession) return 0
    const base = activeSession.paused_seconds || 0
    if (isPaused && activeSession.paused_at) return base + Math.round((Date.now() - new Date(activeSession.paused_at)) / 1000)
    return base
  })()

  const totalPeriodSec = sessions.reduce((sum, s) => {
    if (!s.clocked_out_at) return sum
    const total = Math.round((new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000)
    return sum + Math.max(0, total - (s.paused_seconds || 0))
  }, 0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F9F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{CSS}</style>
      <Spinner size={28} />
    </div>
  )

  if (accessError) return (
    <div className="tt-root" style={{ display: 'flex', minHeight: '100vh', background: '#F9F9FB' }}>
      <style>{CSS}</style>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
          Your account is not set up for time tracking. Ask your admin to add you as a team member.
        </div>
      </main>
    </div>
  )

  if ((isAdmin || isClientAdmin) && teamData) {
    return <TeamView data={teamData} filter={filter} onFilterChange={setFilter} />
  }

  const isActive     = !!activeSession
  const filterLabel  = FILTERS.find(f => f.id === filter)?.label || 'This week'
  const clockGrad    = isPaused
    ? 'linear-gradient(90deg,#F59E0B,#FBBF24)'
    : isActive
      ? 'linear-gradient(90deg,#10B981,#34D399)'
      : 'linear-gradient(90deg,#8B5CF6,#6366F1)'

  const empKpiCards = [
    { ...EMP_KPI[0], label: filterLabel.toUpperCase(), value: fmtDur(totalPeriodSec), sub: `${sessions.length} session${sessions.length !== 1 ? 's' : ''}` },
    { ...EMP_KPI[1], value: fmtDur(todaySeconds + (isActive ? elapsed : 0)), sub: 'Hours clocked today' },
    { ...EMP_KPI[2], value: (() => {
        if (sessions.length === 0) return '—'
        const days = filter === 'today' ? 1 : filter === 'week' ? 7 : new Date().getDate()
        return fmtDur(totalPeriodSec / Math.max(1, days))
      })(), sub: 'Daily average' },
  ]

  return (
    <div className="tt-root" style={{ display: 'flex', minHeight: '100vh', background: '#F9F9FB' }}>
      <style>{CSS}</style>
      <Sidebar />

      <main className="tt-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ animation: 'fadeIn .4s ease both', marginBottom: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', marginBottom: 4 }}>
              Time Tracking
            </h1>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Track your daily work hours
            </div>
            <FilterTabs filter={filter} onChange={setFilter} />
          </div>

          {/* Admin preview banner */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'linear-gradient(135deg,#F3EEFF,#EFF6FF)', border: '1px solid rgba(139,92,246,0.15)', borderLeft: '3px solid #8B5CF6', borderRadius: 8, padding: '10px 16px', marginBottom: 16, animation: 'fadeIn .4s ease both' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <div style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: '#7C3AED' }}>Admin preview</span>
                <span style={{ color: '#6B7280', marginLeft: 6 }}>This is exactly what team members see when they log in. View all hours in the</span>
                <a href="/admin" style={{ color: '#8B5CF6', marginLeft: 4, textDecoration: 'underline', cursor: 'pointer' }}>Admin Panel → Time Tracking</a>
              </div>
            </div>
          )}

          {/* Error toast */}
          {error && (
            <div className="err-toast" style={{ marginBottom: 16 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
              <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Clock In card */}
          <div className="clock-card" style={{ '--clock-grad': clockGrad, marginBottom: 14, animation: 'fadeIn .4s ease .05s both' }}>
            <div>
              {isActive ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, color: isPaused ? '#F59E0B' : '#9CA3AF' }}>
                    {isPaused ? 'Paused' : 'Working'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, animation: isPaused ? 'pauseBlink 2s ease-in-out infinite' : 'none' }}>
                    {!isPaused && <div className="green-dot" />}
                    {isPaused && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />}
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                      {isPaused ? 'Paused' : 'Clocked in'} · {fmtElapsed(elapsed)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', gap: 12 }}>
                    <span>Started {fmtTime(activeSession.clocked_in_at)}</span>
                    {pausedSec > 0 && <span style={{ color: '#D97706' }}>Break {fmtDur(pausedSec)}</span>}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, color: '#9CA3AF' }}>
                    Not clocked in
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', marginBottom: 8 }}>
                    Ready to start
                  </div>
                  {sessions.length > 0 && sessions[0]?.clocked_out_at && (
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      Last session: {fmtDate(sessions[0].clocked_in_at)} · {fmtDur(durSec(sessions[0]))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!isActive && (
                <button className="btn btn-in" onClick={handleClockIn} disabled={clockingIn || isAdmin} title={isAdmin ? 'Admin accounts cannot clock in' : undefined}>
                  {clockingIn ? <Spinner size={14} /> : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                  {clockingIn ? 'Starting…' : 'Clock In'}
                </button>
              )}
              {isActive && !isPaused && (
                <>
                  <button className="btn btn-pause" onClick={handlePause}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    Pause
                  </button>
                  <button className="btn btn-out" onClick={() => setShowModal(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                    Clock Out
                  </button>
                </>
              )}
              {isActive && isPaused && (
                <>
                  <button className="btn btn-resume" onClick={handleResume}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Resume
                  </button>
                  <button className="btn btn-out" onClick={() => setShowModal(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                    Clock Out
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14, animation: 'fadeIn .4s ease .1s both' }}>
            {empKpiCards.map(({ id, label, grad, iconBg, iconColor, value, sub }) => (
              <div key={id} className="kpi-card" style={{ '--kpi-grad': grad }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <KpiIcon id={id} color={iconColor} />
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Work Log */}
          <div className="card" style={{ animation: 'fadeIn .4s ease .15s both' }}>
            <div className="card-hdr">
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F0F10' }}>Work Log</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Your sessions with end-of-day reports</div>
            </div>

            {sessions.length === 0 ? (
              <div style={{ padding: '48px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0F0F10' }}>No sessions yet</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>Clock in to start tracking your time</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 140px 70px 1fr', gap: 12, padding: '9px 18px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {['Date','Time','Hours','Report'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                  ))}
                </div>
                {sessions.map(s => (
                  <div key={s.id} className="emp-row">
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#0F0F10' }}>{fmtDate(s.clocked_in_at)}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTime(s.clocked_in_at)} – {s.clocked_out_at ? fmtTime(s.clocked_out_at) : <span style={{ color: '#059669' }}>Active</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F0F10', fontVariantNumeric: 'tabular-nums' }}>{fmtDur(durSec(s))}</div>
                    <div style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {s.eod_report || <span style={{ color: '#D1D5DB', fontStyle: 'italic' }}>No report</span>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

        </div>
      </main>

      {showModal && activeSession && (
        <ClockOutModal
          session={activeSession}
          elapsedSec={elapsed}
          pausedSeconds={pausedSec}
          onConfirm={handleClockOut}
          onCancel={() => setShowModal(false)}
          submitting={submitting}
        />
      )}
    </div>
  )
}
