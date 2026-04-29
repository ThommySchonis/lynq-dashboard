'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

const CSS = `
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{from{background-position:-400% 0}to{background-position:400% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glowPulse{0%,100%{opacity:.55}50%{opacity:1}}
  @keyframes tickPulse{0%,100%{opacity:1}40%{opacity:.65}}
  @keyframes pauseBlink{0%,100%{opacity:1}50%{opacity:.4}}

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  }

  .tt-root *{box-sizing:border-box;margin:0;padding:0}
  .tt-root{font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased}
  .tt-scroll::-webkit-scrollbar{width:3px}
  .tt-scroll::-webkit-scrollbar-track{background:transparent}
  .tt-scroll::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:2px}

  .kpi-card{
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:12px;padding:20px 22px;
    position:relative;overflow:hidden;
    transition:border-color .2s ease, background .2s ease, box-shadow .2s ease;
    cursor:default;
    box-shadow:var(--shadow-card);
  }
  .kpi-card:hover{border-color:var(--border-hover);background:var(--bg-surface-2);box-shadow:var(--shadow-card-hover)}
  .kpi-card .top-bar{position:absolute;top:0;left:0;right:0;height:2px;opacity:0;transition:opacity .25s ease}
  .kpi-card:hover .top-bar{opacity:1}

  .panel{
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:12px;padding:24px;
    box-shadow:var(--shadow-card);
    transition:border-color .2s ease, box-shadow .2s ease;
  }

  .status-card{
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:14px;padding:28px 32px;
    position:relative;overflow:hidden;
    box-shadow:var(--shadow-card);
    transition:border-color .3s ease, background .3s ease, box-shadow .3s ease;
  }
  .status-card.active{
    border-color:rgba(74,222,128,0.25);
    background:linear-gradient(135deg, rgba(74,222,128,0.04) 0%, var(--bg-surface) 60%);
  }
  .status-card.paused{
    border-color:rgba(251,191,36,0.3);
    background:linear-gradient(135deg, rgba(251,191,36,0.05) 0%, var(--bg-surface) 60%);
  }

  .clock-btn{
    display:inline-flex;align-items:center;gap:9px;
    padding:12px 28px;border-radius:10px;border:none;
    font-size:13.5px;font-weight:700;cursor:pointer;
    font-family:inherit;letter-spacing:.02em;
    transition:all .2s ease;flex-shrink:0;
  }
  .clock-btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important}
  .btn-in{background:#A175FC;color:#fff;box-shadow:0 4px 20px rgba(161,117,252,0.4)}
  .btn-in:hover:not(:disabled){background:#b88fff;box-shadow:0 6px 28px rgba(161,117,252,0.55);transform:translateY(-1px)}
  .btn-out{background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.25)!important}
  .btn-out:hover:not(:disabled){background:rgba(248,113,113,0.2);border-color:rgba(248,113,113,0.4)!important;transform:translateY(-1px)}
  .btn-pause{background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.2)!important}
  .btn-pause:hover:not(:disabled){background:rgba(251,191,36,0.18);border-color:rgba(251,191,36,0.35)!important;transform:translateY(-1px)}
  .btn-resume{background:rgba(161,117,252,0.12);color:#A175FC;border:1px solid rgba(161,117,252,0.25)!important}
  .btn-resume:hover:not(:disabled){background:rgba(161,117,252,0.2);border-color:var(--accent-border)!important;transform:translateY(-1px)}

  .range-pill{padding:5px 14px;border-radius:100px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s ease}

  .sk{background:linear-gradient(90deg,var(--skeleton-from) 25%,var(--skeleton-to) 50%,var(--skeleton-from) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px}

  .log-row{display:grid;grid-template-columns:120px 72px 72px 82px 1fr;gap:12px;align-items:start;padding:13px 14px;border-radius:8px;transition:background .15s;cursor:default}
  .log-row:hover{background:var(--bg-input)}
  .log-header{display:grid;grid-template-columns:120px 72px 72px 82px 1fr;gap:12px;padding:0 14px 10px;border-bottom:1px solid var(--border);margin-bottom:2px}
  .report-cell{font-size:12.5px;color:var(--text-2);line-height:1.45;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .log-row:hover .report-cell{-webkit-line-clamp:unset}

  .modal-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.72);backdrop-filter:blur(10px);padding:24px}
  .modal-box{background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:32px;width:100%;max-width:500px;box-shadow:var(--shadow-card)}
  .modal-ta{width:100%;min-height:120px;resize:vertical;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;color:var(--text-1);font-size:13.5px;font-family:inherit;padding:14px 16px;outline:none;transition:border-color .15s;line-height:1.55}
  .modal-ta:focus{border-color:var(--accent-border)}
  .modal-ta::placeholder{color:var(--text-3)}

  .err-toast{display:flex;align-items:center;gap:10px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);border-radius:10px;padding:12px 16px;color:#f87171;font-size:13px;font-weight:500;animation:fadeIn .25s ease both}
`

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  return <div style={{ width: size, height: size, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #A175FC', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
}

function PageBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '60%', height: '70%', background: 'radial-gradient(ellipse, rgba(161,117,252,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: 0, right: '-10%', width: '50%', height: '60%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 60%)', filter: 'blur(60px)' }} />
    </div>
  )
}

// ─── Clock-out Modal ─────────────────────────────────────────────────────────

function ClockOutModal({ session, elapsedSec, pausedSeconds, onConfirm, onCancel, submitting }) {
  const [report, setReport] = useState('')
  const activeSec = elapsedSec

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', marginBottom: 4 }}>End of Day Report</h2>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 20 }}>
          Clock-in: {fmtTime(session.clocked_in_at)} · Active: {fmtDur(activeSec)}
          {pausedSeconds > 0 && <> · Paused: {fmtDur(pausedSeconds)}</>}
        </div>
        <div style={{ height: 1, background: 'var(--bg-surface-2)', marginBottom: 18 }} />
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
          What did you work on today? <span style={{ color: '#f87171' }}>*</span>
        </label>
        <textarea
          className="modal-ta"
          value={report}
          onChange={e => setReport(e.target.value)}
          placeholder="Describe your tasks, client work, what you completed or progressed on…"
          autoFocus
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={submitting}
            style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(report)} disabled={submitting || !report.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8, border: 'none', background: report.trim() ? '#A175FC' : 'rgba(161,117,252,0.25)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: report.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: report.trim() ? '0 4px 16px rgba(161,117,252,0.35)' : 'none', transition: 'all .15s' }}>
            {submitting ? <><Spinner size={14} />Clocking out…</> : 'Clock Out →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This week' },
  { id: 'month', label: 'This month' },
]

export default function TimeTrackingPage() {
  const [loading, setLoading]             = useState(true)
  const [isAdmin, setIsAdmin]             = useState(false)
  const [adminData, setAdminData]         = useState(null)
  const [accessError, setAccessError]     = useState(false)
  const [member, setMember]               = useState(null)
  const [sessions, setSessions]           = useState([])
  const [activeSession, setActiveSession] = useState(null)
  // elapsed = active-only seconds (stops while paused, restored on reload)
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

  // Restore correct elapsed from server session (handles page reload)
  function restoreElapsed(s) {
    if (!s) return 0
    const total = Math.round((Date.now() - new Date(s.clocked_in_at)) / 1000)
    const paused = s.paused_seconds || 0
    if (s.status === 'paused' && s.paused_at) {
      // freeze at the point pause started, minus prior paused time
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
    if (d.is_admin) { setIsAdmin(true); setAdminData(d); setLoading(false); return }
    setMember(d.member)
    setSessions(d.sessions || [])
    setTodaySeconds(d.today_seconds || 0)
    // Only overwrite local session state on first load (not during active tracking)
    if (!sessionRef.current) {
      const active = d.active_session || null
      setActiveSession(active)
      sessionRef.current = active
      if (active) {
        setIsPaused(active.status === 'paused')
        setElapsed(restoreElapsed(active))
      }
    } else {
      // Refresh session data (e.g. after clock-out) without clobbering timer
      setSessions(d.sessions || [])
      setTodaySeconds(d.today_seconds || 0)
    }
    setLoading(false)
  }, [getToken])

  useEffect(() => { fetchData(filter) }, [filter])

  // Warn before closing tab while clocked in
  useEffect(() => {
    const handler = (e) => {
      if (!sessionRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Timer — ticks only when not paused
  useEffect(() => {
    clearInterval(timerRef.current)
    if (activeSession && !isPaused) {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [activeSession?.id, isPaused])

  // Break timer — ticks only while paused, so break counter display stays live
  const [, setBreakTick] = useState(0)
  useEffect(() => {
    clearInterval(breakTimerRef.current)
    if (activeSession && isPaused) {
      breakTimerRef.current = setInterval(() => setBreakTick(t => t + 1), 1000)
    }
    return () => clearInterval(breakTimerRef.current)
  }, [activeSession?.id, isPaused])

  // Heartbeat every 30s — only when active
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
    setClockingIn(true)
    setError('')
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
      setClockingIn(false)
      return
    }
    setActiveSession(d.session)
    sessionRef.current = d.session
    setElapsed(0)
    setIsPaused(false)
    setClockingIn(false)
  }

  async function handlePause() {
    if (!activeSession) return
    const token = await getToken()
    await fetch('/api/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'pause', session_id: activeSession.id }),
    })
    clearInterval(timerRef.current)
    clearInterval(heartbeatRef.current)
    setIsPaused(true)
    // Update local session so paused_at is tracked
    const updated = { ...activeSession, status: 'paused', paused_at: new Date().toISOString() }
    setActiveSession(updated)
    sessionRef.current = updated
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
    const updated = {
      ...activeSession,
      status: 'active',
      paused_at: null,
      paused_seconds: d.paused_seconds ?? activeSession.paused_seconds,
    }
    setActiveSession(updated)
    sessionRef.current = updated
    setIsPaused(false)
  }

  async function handleClockOut(report) {
    setSubmitting(true)
    const token = await getToken()
    await fetch('/api/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'clock-out', session_id: activeSession.id, eod_report: report }),
    })
    setActiveSession(null)
    sessionRef.current = null
    setElapsed(0)
    setIsPaused(false)
    setShowModal(false)
    setSubmitting(false)
    await fetchData('today')
    setTimeout(() => { fetchData(filter) }, 200)
  }

  // Break time = server paused_seconds + any ongoing pause since paused_at
  const pausedSec = (() => {
    if (!activeSession) return 0
    const base = activeSession.paused_seconds || 0
    if (isPaused && activeSession.paused_at) {
      return base + Math.round((Date.now() - new Date(activeSession.paused_at)) / 1000)
    }
    return base
  })()

  const totalPeriodSec = sessions.reduce((sum, s) => {
    if (!s.clocked_out_at) return sum
    const total = Math.round((new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000)
    return sum + Math.max(0, total - (s.paused_seconds || 0))
  }, 0)

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )

  // admin falls through to employee UI below — isAdmin flag shows a preview banner

  // ─── Access error ────────────────────────────────────────────────────────────

  if (accessError) return (
    <div className="tt-root" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-1)' }}>
      <style>{CSS}</style>
      <Sidebar />
      <main style={{ flex: 1, padding: '36px 44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          Your account is not set up for time tracking. Ask your admin to add you as a team member.
        </div>
      </main>
    </div>
  )

  const isActive = !!activeSession
  const statusClass = isActive ? (isPaused ? 'paused' : 'active') : ''
  const filterLabel = FILTERS.find(f => f.id === filter)?.label || ''

  // ─── Main UI ─────────────────────────────────────────────────────────────────

  return (
    <div className="tt-root" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-1)' }}>
      <style>{CSS}</style>
      <PageBackground />
      <Sidebar />

      <main className="tt-scroll" style={{ flex: 1, overflowY: 'auto', padding: '36px 44px', position: 'relative' }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ animation: 'fadeIn .4s ease both', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: 5 }}>
                  Time Tracking
                </h1>
                <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>
                  {member ? `Hey ${member.name} — track your daily hours` : 'Track your daily work hours'}
                </div>
              </div>
              {/* Status pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 100, background: 'var(--bg-input)', border: '1px solid var(--border)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isPaused ? '#fbbf24' : isActive ? '#4ade80' : 'rgba(255,255,255,0.18)',
                  boxShadow: isPaused ? '0 0 8px rgba(251,191,36,0.7)' : isActive ? '0 0 8px rgba(74,222,128,0.7)' : 'none',
                  animation: (isPaused || isActive) ? 'glowPulse 2s ease-in-out infinite' : 'none',
                }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.02em', color: isPaused ? '#fbbf24' : isActive ? '#4ade80' : 'rgba(255,255,255,0.32)' }}>
                  {isPaused ? 'Paused' : isActive ? 'Clocked In' : 'Not Clocked In'}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--bg-surface-2)', margin: '20px 0 16px' }} />

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTERS.map(f => (
                <button key={f.id} className="range-pill" onClick={() => setFilter(f.id)} style={{
                  background: filter === f.id ? '#A175FC' : 'var(--bg-input)',
                  color: filter === f.id ? '#fff' : 'rgba(255,255,255,0.42)',
                  border: `1px solid ${filter === f.id ? 'transparent' : 'var(--bg-input)'}`,
                  boxShadow: filter === f.id ? '0 2px 10px rgba(161,117,252,0.3)' : 'none',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin preview banner */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(161,117,252,0.07)', border: '1px solid rgba(161,117,252,0.2)', borderRadius: 10, padding: '12px 18px', marginBottom: 20, animation: 'fadeIn .4s ease both' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A175FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginRight: 6 }}>Admin preview</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>This is exactly what team members see when they log in. View all hours in the</span>
                <a href="/admin" style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 4, textDecoration: 'underline', cursor: 'pointer' }}>Admin Panel → Time Tracking</a>
              </div>
            </div>
          )}

          {/* Error toast */}
          {error && (
            <div className="err-toast" style={{ marginBottom: 20 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
              <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* ── Status Card ──────────────────────────────────────────────────── */}
          <div className={`status-card ${statusClass}`} style={{ marginBottom: 20, animation: 'fadeIn .4s ease .05s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>

              {/* Left: status info */}
              <div>
                {isActive ? (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, color: isPaused ? '#fbbf24' : '#4ade80' }}>
                      {isPaused ? '⏸ Paused' : '● Working'}
                    </div>
                    <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8, animation: isPaused ? 'pauseBlink 2s ease-in-out infinite' : 'none' }}>
                      {fmtElapsed(elapsed)}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Started {fmtTime(activeSession.clocked_in_at)}</span>
                      {pausedSec > 0 && <span style={{ color: 'rgba(251,191,36,0.6)' }}>Break {fmtDur(pausedSec)}</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, color: 'var(--text-3)' }}>
                      Not clocked in
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-2)', marginBottom: 8 }}>
                      Ready to start
                    </div>
                    {sessions.length > 0 && sessions[0]?.clocked_out_at && (
                      <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                        Last session: {fmtDate(sessions[0].clocked_in_at)} · {fmtDur(durSec(sessions[0]))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right: action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!isActive && (
                  <button className="clock-btn btn-in" onClick={handleClockIn} disabled={clockingIn || isAdmin} title={isAdmin ? 'Admin accounts cannot clock in' : undefined}>
                    {clockingIn ? <Spinner size={15} /> : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                    {clockingIn ? 'Starting…' : 'Clock In'}
                  </button>
                )}
                {isActive && !isPaused && (
                  <>
                    <button className="clock-btn btn-pause" onClick={handlePause}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      Pause
                    </button>
                    <button className="clock-btn btn-out" onClick={() => setShowModal(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                      Clock Out
                    </button>
                  </>
                )}
                {isActive && isPaused && (
                  <>
                    <button className="clock-btn btn-resume" onClick={handleResume}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Resume
                    </button>
                    <button className="clock-btn btn-out" onClick={() => setShowModal(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                      Clock Out
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── KPI cards ────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20, animation: 'fadeIn .4s ease .1s both' }}>
            {[
              {
                label: filterLabel,
                value: fmtDur(totalPeriodSec),
                sub: `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`,
                accent: '#A175FC',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
              },
              {
                label: 'Today',
                value: fmtDur(todaySeconds + (isActive ? elapsed : 0)),
                sub: 'Hours clocked today',
                accent: '#4ade80',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
              },
              {
                label: 'Avg per Day',
                value: (() => {
                  if (sessions.length === 0) return '—'
                  const days = filter === 'today' ? 1 : filter === 'week' ? 7 : new Date().getDate()
                  return fmtDur(totalPeriodSec / Math.max(1, days))
                })(),
                sub: 'Daily average',
                accent: '#60a5fa',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
              },
            ].map(({ label, value, sub, accent, icon }) => (
              <div key={label} className="kpi-card">
                <div className="top-bar" style={{ background: `linear-gradient(90deg, ${accent}60, ${accent}20)` }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}1a`, border: `1px solid ${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
                    {icon}
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-1)', lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.32)', fontWeight: 500 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ── Work Log ─────────────────────────────────────────────────────── */}
          <div className="panel" style={{ animation: 'fadeIn .4s ease .15s both' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Work Log</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}>Your sessions with end-of-day reports</div>
            </div>

            {sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-3)', fontSize: 13 }}>
                No sessions in this period yet. Clock in to start tracking.
              </div>
            ) : (
              <>
                <div className="log-header">
                  {['Date', 'In', 'Out', 'Hours', 'Report'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                  ))}
                </div>
                {sessions.map(s => (
                  <div key={s.id} className="log-row">
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{fmtDate(s.clocked_in_at)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.clocked_in_at)}</div>
                    <div style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: s.clocked_out_at ? 'rgba(255,255,255,0.6)' : '#4ade80' }}>
                      {s.clocked_out_at ? fmtTime(s.clocked_out_at) : 'Active'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{fmtDur(durSec(s))}</div>
                    <div className="report-cell">
                      {s.eod_report || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No report</span>}
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
