'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

const CSS = `
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{from{background-position:-400% 0}to{background-position:400% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glowPulse{0%,100%{opacity:.5}50%{opacity:1}}
  @keyframes tickPulse{0%,100%{opacity:1}50%{opacity:.7}}

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  }

  .tt-root *{box-sizing:border-box;margin:0;padding:0}
  .tt-root{font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased}
  .tt-scroll::-webkit-scrollbar{width:3px}
  .tt-scroll::-webkit-scrollbar-track{background:transparent}
  .tt-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}

  .kpi-card{
    background:rgba(255,255,255,0.052);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:12px;padding:20px 22px;
    position:relative;overflow:hidden;
    transition:border-color .2s ease, background .2s ease;
    cursor:default;
    box-shadow:0 4px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .kpi-card:hover{border-color:rgba(255,255,255,0.18);background:rgba(255,255,255,0.07)}
  .kpi-card .top-bar{position:absolute;top:0;left:0;right:0;height:2px;opacity:0;transition:opacity .25s ease}
  .kpi-card:hover .top-bar{opacity:1}

  .panel{
    background:rgba(255,255,255,0.042);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:12px;padding:24px;
    transition:border-color .2s ease;
    box-shadow:0 4px 24px rgba(0,0,0,0.22);
  }
  .panel:hover{border-color:rgba(255,255,255,0.16)}

  .status-card{
    background:rgba(255,255,255,0.052);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:14px;padding:32px 36px;
    position:relative;overflow:hidden;
    box-shadow:0 4px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .status-card.active{border-color:rgba(74,222,128,0.25);background:rgba(74,222,128,0.04)}

  .clock-btn{
    display:inline-flex;align-items:center;gap:10px;
    padding:13px 32px;border-radius:10px;border:none;
    font-size:14px;font-weight:700;cursor:pointer;
    font-family:inherit;letter-spacing:.02em;
    transition:all .2s ease;
  }
  .clock-btn-in{background:#A175FC;color:#fff;box-shadow:0 4px 20px rgba(161,117,252,0.35)}
  .clock-btn-in:hover:not(:disabled){background:#b88fff;box-shadow:0 6px 28px rgba(161,117,252,0.5);transform:translateY(-1px)}
  .clock-btn-out{background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.25)}
  .clock-btn-out:hover:not(:disabled){background:rgba(248,113,113,0.22);border-color:rgba(248,113,113,0.4);transform:translateY(-1px)}
  .clock-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}

  .range-pill{padding:5px 14px;border-radius:100px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s ease}

  .sk{background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px}

  .log-row{display:grid;grid-template-columns:110px 80px 80px 90px 1fr;gap:12px;align-items:start;padding:14px 16px;border-radius:8px;transition:background .15s;cursor:default}
  .log-row:hover{background:rgba(255,255,255,0.04)}
  .log-header{display:grid;grid-template-columns:110px 80px 80px 90px 1fr;gap:12px;padding:0 16px 10px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:4px}

  .report-text{font-size:12.5px;color:rgba(255,255,255,0.55);line-height:1.45;max-width:100%;word-break:break-word}
  .report-expand{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .log-row:hover .report-expand{-webkit-line-clamp:unset}

  .modal-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);padding:24px}
  .modal-box{background:#1e0f40;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:32px;width:100%;max-width:520px;box-shadow:0 24px 80px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.08)}
  .modal-textarea{width:100%;min-height:130px;resize:vertical;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#F8FAFC;font-size:13.5px;font-family:inherit;padding:14px 16px;outline:none;transition:border-color .15s;line-height:1.55}
  .modal-textarea:focus{border-color:rgba(161,117,252,0.5)}
  .modal-textarea::placeholder{color:rgba(255,255,255,0.28)}
`

function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function fmtDuration(sec) {
  if (!sec || sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtDurationFromIso(inIso, outIso) {
  if (!inIso || !outIso) return '—'
  return fmtDuration(Math.round((new Date(outIso) - new Date(inIso)) / 1000))
}

function sessionSeconds(s) {
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
  return <div style={{ width: size, height: size, border: `2px solid rgba(255,255,255,0.1)`, borderTop: `2px solid #A175FC`, borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
}

function PageBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '60%', height: '70%', background: 'radial-gradient(ellipse, rgba(161,117,252,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: '0', right: '-10%', width: '50%', height: '60%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 60%)', filter: 'blur(60px)' }} />
    </div>
  )
}

function ClockOutModal({ session, onConfirm, onCancel, submitting }) {
  const [report, setReport] = useState('')
  const nowSec = Math.round((Date.now() - new Date(session.clocked_in_at)) / 1000)
  const dur = fmtDuration(nowSec)

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.03em', marginBottom: 4 }}>End of Day Report</h2>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.38)' }}>
            Clocked in at {fmtTime(session.clocked_in_at)} · {dur} worked
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '18px 0' }} />

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          What did you work on today? <span style={{ color: '#f87171' }}>*</span>
        </label>
        <textarea
          className="modal-textarea"
          value={report}
          onChange={e => setReport(e.target.value)}
          placeholder="Describe what you worked on, tasks completed, client work, etc."
          autoFocus
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(report)}
            disabled={submitting || !report.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8, border: 'none', background: report.trim() ? '#A175FC' : 'rgba(161,117,252,0.3)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: report.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all .15s', boxShadow: report.trim() ? '0 4px 16px rgba(161,117,252,0.3)' : 'none' }}
          >
            {submitting ? <><Spinner size={14} /> Clocking out…</> : 'Clock Out →'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This week' },
  { id: 'month', label: 'This month' },
]

export default function TimeTrackingPage() {
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState(false)
  const [member, setMember] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [todaySeconds, setTodaySeconds] = useState(0)
  const [filter, setFilter] = useState('week')
  const [showModal, setShowModal] = useState(false)
  const [clockingIn, setClockingIn] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const timerRef = useRef(null)
  const heartbeatRef = useRef(null)
  const sessionRef = useRef(null)

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const fetchData = useCallback(async (f = filter) => {
    const token = await getToken()
    if (!token) { window.location.href = '/login'; return }
    const res = await fetch(`/api/time?filter=${f}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 403) { setAccessError(true); setLoading(false); return }
    if (!res.ok) { setLoading(false); return }
    const d = await res.json()
    setMember(d.member)
    setSessions(d.sessions || [])
    setActiveSession(d.active_session || null)
    setTodaySeconds(d.today_seconds || 0)
    sessionRef.current = d.active_session || null
    setLoading(false)
  }, [filter, getToken])

  // Periodic refetch to sync session state
  useEffect(() => {
    fetchData(filter)
  }, [filter])

  // Live elapsed timer
  useEffect(() => {
    clearInterval(timerRef.current)
    if (activeSession) {
      const base = Math.round((Date.now() - new Date(activeSession.clocked_in_at)) / 1000)
      setElapsed(base)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(timerRef.current)
  }, [activeSession?.id])

  // Heartbeat every 30s
  useEffect(() => {
    clearInterval(heartbeatRef.current)
    if (!activeSession) return
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
  }, [activeSession?.id, getToken])

  async function handleClockIn() {
    setClockingIn(true)
    const token = await getToken()
    const res = await fetch('/api/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'clock-in' }),
    })
    const d = await res.json()
    if (d.session) {
      setActiveSession(d.session)
      sessionRef.current = d.session
    }
    setClockingIn(false)
    fetchData(filter)
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
    setShowModal(false)
    setSubmitting(false)
    fetchData('today')
    setTimeout(() => fetchData(filter), 300)
  }

  // KPI calculations
  const totalSeconds = sessions.reduce((s, sess) => s + sessionSeconds(sess), 0)
  const sessionCount = sessions.length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1C0F36', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )

  if (accessError) return (
    <div style={{ minHeight: '100vh', background: '#1C0F36', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter Tight', sans-serif", fontSize: 14 }}>
      No access. Only team members can use Time Tracking.
    </div>
  )

  const isActive = !!activeSession

  return (
    <div className="tt-root" style={{ minHeight: '100vh', background: '#1C0F36', color: '#F8FAFC' }}>
      <style>{CSS}</style>
      <PageBackground />
      <Sidebar />

      <div className="tt-scroll" style={{ position: 'relative', zIndex: 1, marginLeft: 232, padding: '44px 48px 64px', maxWidth: 1100, minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ animation: 'fadeIn .4s ease both' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: 5, textShadow: 'none' }}>
            Time Tracking
          </h1>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>
            {member ? `Welcome back, ${member.name}` : 'Track your daily work hours'}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                className="range-pill"
                onClick={() => setFilter(f.id)}
                style={{
                  background: filter === f.id ? '#A175FC' : 'rgba(255,255,255,0.05)',
                  color: filter === f.id ? '#fff' : 'rgba(255,255,255,0.45)',
                  border: `1px solid ${filter === f.id ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: filter === f.id ? '0 2px 10px rgba(161,117,252,0.3)' : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 100, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#4ade80' : 'rgba(255,255,255,0.2)', boxShadow: isActive ? '0 0 8px rgba(74,222,128,0.7)' : 'none', animation: isActive ? 'glowPulse 2s ease-in-out infinite' : 'none' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: isActive ? '#4ade80' : 'rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}>
              {isActive ? 'Clocked In' : 'Not Clocked In'}
            </span>
          </div>
        </div>

        {/* Status card */}
        <div className={`status-card${isActive ? ' active' : ''}`} style={{ marginBottom: 24, animation: 'fadeIn .4s ease .05s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              {isActive ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Currently Working
                  </div>
                  <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.04em', color: '#F8FAFC', fontVariantNumeric: 'tabular-nums', animation: 'tickPulse 1s ease-in-out infinite', marginBottom: 6 }}>
                    {fmtElapsed(elapsed)}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>
                    Since {fmtTime(activeSession.clocked_in_at)} · {fmtDate(activeSession.clocked_in_at)}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Not Clocked In
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    Ready to start
                  </div>
                  {sessions.length > 0 && sessions[0].clocked_out_at && (
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                      Last session ended at {fmtTime(sessions[0].clocked_out_at)}
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              {isActive ? (
                <button
                  className="clock-btn clock-btn-out"
                  onClick={() => setShowModal(true)}
                  disabled={submitting}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                  </svg>
                  Clock Out
                </button>
              ) : (
                <button
                  className="clock-btn clock-btn-in"
                  onClick={handleClockIn}
                  disabled={clockingIn}
                >
                  {clockingIn ? <Spinner size={15} /> : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  )}
                  {clockingIn ? 'Starting…' : 'Clock In'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28, animation: 'fadeIn .4s ease .1s both' }}>
          {[
            {
              label: filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'This Month',
              value: fmtDuration(totalSeconds),
              sub: `${sessionCount} session${sessionCount !== 1 ? 's' : ''}`,
              accent: '#A175FC',
            },
            {
              label: 'Today',
              value: fmtDuration(todaySeconds + (isActive ? elapsed : 0)),
              sub: 'Hours worked today',
              accent: '#4ade80',
            },
            {
              label: 'Avg per Day',
              value: (() => {
                if (sessionCount === 0) return '—'
                const days = filter === 'today' ? 1 : filter === 'week' ? 7 : new Date().getDate()
                return fmtDuration(totalSeconds / Math.max(1, days))
              })(),
              sub: 'Average daily hours',
              accent: '#60a5fa',
            },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} className="kpi-card">
              <div className="top-bar" style={{ background: `linear-gradient(90deg, ${accent}60, ${accent}20)` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}1a`, border: `1px solid ${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, opacity: 0.7 }} />
                </div>
              </div>
              <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.04em', color: '#F8FAFC', lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Work Log */}
        <div className="panel" style={{ animation: 'fadeIn .4s ease .15s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC' }}>Work Log</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Your session history with daily reports</div>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              No sessions in this period yet.
            </div>
          ) : (
            <div>
              <div className="log-header">
                {['Date', 'In', 'Out', 'Duration', 'Report'].map(h => (
                  <div key={h} style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {sessions.map(s => (
                <div key={s.id} className="log-row">
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{fmtDate(s.clocked_in_at)}</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.clocked_in_at)}</div>
                  <div style={{ fontSize: 12.5, color: s.clocked_out_at ? 'rgba(255,255,255,0.65)' : '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                    {s.clocked_out_at ? fmtTime(s.clocked_out_at) : 'Active'}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F8FAFC' }}>
                    {fmtDurationFromIso(s.clocked_in_at, s.clocked_out_at)}
                  </div>
                  <div className="report-text report-expand">
                    {s.eod_report || <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No report</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && activeSession && (
        <ClockOutModal
          session={activeSession}
          onConfirm={handleClockOut}
          onCancel={() => setShowModal(false)}
          submitting={submitting}
        />
      )}
    </div>
  )
}
