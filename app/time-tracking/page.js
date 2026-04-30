'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

const CSS = `
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{from{background-position:-400% 0}to{background-position:400% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}
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
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:8px;
    padding:16px;
    position:relative;overflow:hidden;
    transition:border-color .2s ease;
    cursor:default;
  }
  .kpi-card:hover{border-color:rgba(0,0,0,0.12)}

  .panel{
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:10px;
    padding:20px;
  }

  .status-card{
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:10px;
    padding:20px 24px;
    transition:border-color .2s ease;
  }

  .clock-btn{
    display:inline-flex;align-items:center;gap:8px;
    height:38px;padding:0 20px;border-radius:8px;border:none;
    font-size:13px;font-weight:600;cursor:pointer;
    font-family:inherit;
    transition:all .15s ease;flex-shrink:0;
  }
  .clock-btn:disabled{opacity:.45;cursor:not-allowed}
  .btn-in{background:#111111;color:#fff}
  .btn-in:hover:not(:disabled){background:#333333}
  .btn-out{background:#FEF2F2;color:#DC2626;border:1px solid rgba(220,38,38,0.15)!important}
  .btn-out:hover:not(:disabled){background:#fee2e2}
  .btn-pause{background:#F5F5F5;color:#555555;border:1px solid rgba(0,0,0,0.08)!important}
  .btn-pause:hover:not(:disabled){background:#EBEBEB}
  .btn-resume{background:#F5F5F5;color:#555555;border:1px solid rgba(0,0,0,0.08)!important}
  .btn-resume:hover:not(:disabled){background:#EBEBEB}

  .range-pill{padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s ease}

  .sk{background:linear-gradient(90deg,var(--skeleton-from) 25%,var(--skeleton-to) 50%,var(--skeleton-from) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px}

  .log-row{display:grid;grid-template-columns:120px 72px 72px 82px 1fr;gap:12px;align-items:start;padding:10px 12px;border-radius:6px;transition:background .15s;cursor:default}
  .log-row:hover{background:#FAFAFA}
  .log-header{display:grid;grid-template-columns:120px 72px 72px 82px 1fr;gap:12px;padding:0 12px 10px;border-bottom:1px solid rgba(0,0,0,0.06);margin-bottom:2px}
  .report-cell{font-size:12.5px;color:#555555;line-height:1.45;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .log-row:hover .report-cell{-webkit-line-clamp:unset}

  .modal-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);padding:24px}
  .modal-box{background:#FFFFFF;border:1px solid rgba(0,0,0,0.09);border-radius:12px;padding:28px;width:100%;max-width:500px}
  .modal-ta{width:100%;min-height:120px;resize:vertical;background:#F5F5F5;border:1px solid rgba(0,0,0,0.08);border-radius:8px;color:#111111;font-size:13px;font-family:inherit;padding:12px 14px;outline:none;transition:border-color .15s;line-height:1.55}
  .modal-ta:focus{border-color:rgba(0,0,0,0.2)}
  .modal-ta::placeholder{color:#BDBDBD}

  .err-toast{display:flex;align-items:center;gap:10px;background:#FEF2F2;border:1px solid rgba(220,38,38,0.15);border-radius:8px;padding:10px 14px;color:#DC2626;font-size:13px;font-weight:500;animation:fadeIn .25s ease both}
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
  return <div style={{ width: size, height: size, border: '2px solid rgba(0,0,0,0.08)', borderTop: '2px solid #111111', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
}

// ─── Clock-out Modal ─────────────────────────────────────────────────────────

function ClockOutModal({ session, elapsedSec, pausedSeconds, onConfirm, onCancel, submitting }) {
  const [report, setReport] = useState('')
  const activeSec = elapsedSec

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111111', marginBottom: 4 }}>End of Day Report</h2>
        <div style={{ fontSize: 12, color: '#888888', marginBottom: 18 }}>
          Clock-in: {fmtTime(session.clocked_in_at)} · Active: {fmtDur(activeSec)}
          {pausedSeconds > 0 && <> · Paused: {fmtDur(pausedSeconds)}</>}
        </div>
        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 16 }} />
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#BDBDBD', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          What did you work on today? <span style={{ color: '#DC2626' }}>*</span>
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
            style={{ padding: '0 18px', height: 36, borderRadius: 7, border: '1px solid rgba(0,0,0,0.09)', background: '#F5F5F5', color: '#555555', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(report)} disabled={submitting || !report.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', height: 36, borderRadius: 7, border: 'none', background: report.trim() ? '#111111' : 'rgba(0,0,0,0.12)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: report.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all .15s' }}>
            {submitting ? <><Spinner size={13} />Clocking out…</> : 'Clock Out →'}
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
    const total = Math.round((Date.now() - new Date(s.clocked_in_at)) / 1000)
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
    if (d.is_admin) { setIsAdmin(true); setAdminData(d); setLoading(false); return }
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
    const handler = (e) => {
      if (!sessionRef.current) return
      e.preventDefault(); e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (activeSession && !isPaused) {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [activeSession?.id, isPaused])

  const [, setBreakTick] = useState(0)
  useEffect(() => {
    clearInterval(breakTimerRef.current)
    if (activeSession && isPaused) {
      breakTimerRef.current = setInterval(() => setBreakTick(t => t + 1), 1000)
    }
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )

  if (accessError) return (
    <div className="tt-root" style={{ display: 'flex', minHeight: '100vh', background: '#FAFAFA' }}>
      <style>{CSS}</style>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#888888', fontSize: 13 }}>
          Your account is not set up for time tracking. Ask your admin to add you as a team member.
        </div>
      </main>
    </div>
  )

  const isActive = !!activeSession
  const filterLabel = FILTERS.find(f => f.id === filter)?.label || ''

  return (
    <div className="tt-root" style={{ display: 'flex', minHeight: '100vh', background: '#FAFAFA' }}>
      <style>{CSS}</style>
      <Sidebar />

      <main className="tt-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative' }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ animation: 'fadeIn .4s ease both', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111111', lineHeight: 1.2, marginBottom: 4 }}>
                  Time Tracking
                </h1>
                <div style={{ fontSize: 13, color: '#888888' }}>
                  {member ? `Hey ${member.name} — track your daily hours` : 'Track your daily work hours'}
                </div>
              </div>
              {/* Status pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 7, background: isActive && !isPaused ? '#F0FDF4' : '#F5F5F5', border: isActive && !isPaused ? '1px solid rgba(22,163,74,0.15)' : '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: isPaused ? '#D97706' : isActive ? '#16A34A' : '#BDBDBD', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: isActive && !isPaused ? '#15803D' : '#555555' }}>
                  {isPaused ? 'Paused' : isActive ? 'Clocked In' : 'Not Clocked In'}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '16px 0 12px' }} />

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTERS.map(f => (
                <button key={f.id} className="range-pill" onClick={() => setFilter(f.id)} style={{
                  background: filter === f.id ? '#111111' : 'transparent',
                  color: filter === f.id ? '#ffffff' : '#888888',
                  border: filter === f.id ? 'none' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin preview banner */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 6, padding: '8px 14px', marginBottom: 16, animation: 'fadeIn .4s ease both' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <div style={{ flex: 1, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: '#555555', marginRight: 5 }}>Admin preview</span>
                <span style={{ color: '#888888' }}>This is exactly what team members see when they log in. View all hours in the</span>
                <a href="/admin" style={{ color: '#555555', marginLeft: 4, textDecoration: 'underline', cursor: 'pointer' }}>Admin Panel → Time Tracking</a>
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
          <div className="status-card" style={{ marginBottom: 16, animation: 'fadeIn .4s ease .05s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>

              {/* Left: status info */}
              <div>
                {isActive ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, color: isPaused ? '#D97706' : '#BDBDBD' }}>
                      {isPaused ? 'Paused' : 'Working'}
                    </div>
                    <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.04em', color: '#111111', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8, animation: isPaused ? 'pauseBlink 2s ease-in-out infinite' : 'none' }}>
                      {fmtElapsed(elapsed)}
                    </div>
                    <div style={{ fontSize: 12, color: '#888888', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Started {fmtTime(activeSession.clocked_in_at)}</span>
                      {pausedSec > 0 && <span style={{ color: '#D97706' }}>Break {fmtDur(pausedSec)}</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, color: '#BDBDBD' }}>
                      Not clocked in
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111111', marginBottom: 8 }}>
                      Ready to start
                    </div>
                    {sessions.length > 0 && sessions[0]?.clocked_out_at && (
                      <div style={{ fontSize: 12, color: '#888888' }}>
                        Last session: {fmtDate(sessions[0].clocked_in_at)} · {fmtDur(durSec(sessions[0]))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right: action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!isActive && (
                  <button className="clock-btn btn-in" onClick={handleClockIn} disabled={clockingIn || isAdmin} title={isAdmin ? 'Admin accounts cannot clock in' : undefined}>
                    {clockingIn ? <Spinner size={14} /> : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                    {clockingIn ? 'Starting…' : 'Clock In'}
                  </button>
                )}
                {isActive && !isPaused && (
                  <>
                    <button className="clock-btn btn-pause" onClick={handlePause}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      Pause
                    </button>
                    <button className="clock-btn btn-out" onClick={() => setShowModal(true)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                      Clock Out
                    </button>
                  </>
                )}
                {isActive && isPaused && (
                  <>
                    <button className="clock-btn btn-resume" onClick={handleResume}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Resume
                    </button>
                    <button className="clock-btn btn-out" onClick={() => setShowModal(true)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                      Clock Out
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16, animation: 'fadeIn .4s ease .1s both' }}>
            {[
              {
                label: filterLabel.toUpperCase(),
                value: fmtDur(totalPeriodSec),
                sub: `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`,
                icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
              },
              {
                label: 'TODAY',
                value: fmtDur(todaySeconds + (isActive ? elapsed : 0)),
                sub: 'Hours clocked today',
                icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
              },
              {
                label: 'AVG PER DAY',
                value: (() => {
                  if (sessions.length === 0) return '—'
                  const days = filter === 'today' ? 1 : filter === 'week' ? 7 : new Date().getDate()
                  return fmtDur(totalPeriodSec / Math.max(1, days))
                })(),
                sub: 'Daily average',
                icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
              },
            ].map(({ label, value, sub, icon }) => (
              <div key={label} className="kpi-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#BDBDBD', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {icon}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#111111', lineHeight: 1.1, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                <div style={{ fontSize: 12, color: '#888888' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Work Log */}
          <div className="panel" style={{ animation: 'fadeIn .4s ease .15s both' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111111' }}>Work Log</div>
              <div style={{ fontSize: 13, color: '#888888', marginTop: 3 }}>Your sessions with end-of-day reports</div>
            </div>

            {sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: '#888888', fontSize: 13 }}>
                No sessions in this period yet. Clock in to start tracking.
              </div>
            ) : (
              <>
                <div className="log-header">
                  {['Date', 'In', 'Out', 'Hours', 'Report'].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>
                {sessions.map(s => (
                  <div key={s.id} className="log-row">
                    <div style={{ fontSize: 12.5, color: '#555555', fontWeight: 500 }}>{fmtDate(s.clocked_in_at)}</div>
                    <div style={{ fontSize: 12.5, color: '#555555', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.clocked_in_at)}</div>
                    <div style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: s.clocked_out_at ? '#555555' : '#16A34A' }}>
                      {s.clocked_out_at ? fmtTime(s.clocked_out_at) : 'Active'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>{fmtDur(durSec(s))}</div>
                    <div className="report-cell">
                      {s.eod_report || <span style={{ color: '#BDBDBD', fontStyle: 'italic' }}>No report</span>}
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
