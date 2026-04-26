'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

/* ─────────────────────────────────────────
   HARDCODED DATA
───────────────────────────────────────── */
const AGENTS = [
  { name: 'Sarah K.',  tickets: 47, avgResponse: '1.2h', resolution: 96, csat: 4.9 },
  { name: 'Mike R.',   tickets: 38, avgResponse: '2.1h', resolution: 91, csat: 4.7 },
  { name: 'Emma L.',   tickets: 52, avgResponse: '0.9h', resolution: 98, csat: 5.0 },
  { name: 'James W.',  tickets: 29, avgResponse: '3.4h', resolution: 87, csat: 4.5 },
  { name: 'Aria M.',   tickets: 41, avgResponse: '1.8h', resolution: 93, csat: 4.8 },
]

const CHART_DATA = [
  { day: 'Mon', count: 23 },
  { day: 'Tue', count: 31 },
  { day: 'Wed', count: 28 },
  { day: 'Thu', count: 38 },
  { day: 'Fri', count: 27 },
  { day: 'Sat', count: 12 },
  { day: 'Sun', count:  8 },
]

const CHART_MAX = 38

const FEED = [
  { icon: 'check',   text: 'Ticket #4521 resolved by Sarah K.',         time: '2 min ago',  color: '#A175FC' },
  { icon: 'alert',   text: 'New urgent ticket: Wrong item received',     time: '15 min ago', color: '#FF6B35' },
  { icon: 'money',   text: 'Refund approved for order #1089',            time: '1h ago',     color: '#4ade80' },
  { icon: 'star',    text: 'Emma L. achieved 5.0 CSAT rating',           time: '3h ago',     color: '#FFD700' },
  { icon: 'spike',   text: 'Ticket volume spike detected (+40%)',         time: '5h ago',     color: '#FF6B35' },
  { icon: 'report',  text: 'Weekly performance report generated',         time: '1d ago',     color: '#A175FC' },
]

/* ─────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────── */
const CSS = `
  @keyframes aurora1 {
    0%,100% { transform:translate(0,0) scale(1);      opacity:.45; }
    33%      { transform:translate(60px,-80px) scale(1.15); opacity:.65; }
    66%      { transform:translate(-40px,40px) scale(.9);  opacity:.35; }
  }
  @keyframes aurora2 {
    0%,100% { transform:translate(0,0) scale(1);      opacity:.3; }
    40%      { transform:translate(-80px,60px) scale(1.2);  opacity:.5; }
    70%      { transform:translate(50px,-30px) scale(.85); opacity:.25; }
  }
  @keyframes aurora3 {
    0%,100% { transform:translate(0,0) scale(1);      opacity:.2; }
    50%      { transform:translate(40px,80px) scale(1.1);  opacity:.4; }
  }
  @keyframes revealUp {
    from { opacity:0; transform:translateY(22px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes barGrow {
    from { width:0; }
    to   { width:var(--bar-w); }
  }
  @keyframes ringFill {
    from { background: conic-gradient(#1C0F36 0deg, #1C0F36 360deg); }
    to   { background: var(--ring-final); }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes sparkleIn {
    from { opacity:0; transform:scaleY(0); }
    to   { opacity:1; transform:scaleY(1); }
  }

  .perf-root * { box-sizing:border-box; margin:0; padding:0; }
  .perf-root {
    font-family:var(--font-rethink), -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing:antialiased;
  }

  /* hero kpi cards */
  .hero-card {
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:14px;
    padding:28px 24px 24px;
    display:flex;
    flex-direction:column;
    align-items:center;
    transition:all 0.25s ease;
    cursor:default;
    position:relative;
    overflow:hidden;
  }
  .hero-card::before {
    content:'';
    position:absolute;
    inset:0;
    background:linear-gradient(135deg,rgba(161,117,252,0.07),transparent 60%);
    opacity:0;
    transition:opacity 0.3s ease;
    pointer-events:none;
  }
  .hero-card:hover::before { opacity:1; }
  .hero-card:hover {
    border-color:rgba(161,117,252,0.28);
    transform:translateY(-3px);
    box-shadow:0 12px 40px rgba(161,117,252,0.1);
  }

  /* table row hover */
  .agent-row {
    transition:background 0.18s ease;
    border-bottom:1px solid rgba(255,255,255,0.05);
  }
  .agent-row:last-child { border-bottom:none; }
  .agent-row:hover { background:rgba(161,117,252,0.06); }

  /* chart bar hover */
  .chart-bar-wrap:hover .chart-bar-inner {
    filter:brightness(1.2);
  }
  .chart-bar-wrap:hover .bar-count-tooltip {
    opacity:1;
  }

  /* feed items */
  .feed-item {
    display:flex;
    gap:14px;
    align-items:flex-start;
    padding:14px 0;
    border-bottom:1px solid rgba(255,255,255,0.04);
    transition:background 0.15s ease;
    cursor:default;
  }
  .feed-item:last-child { border-bottom:none; }
  .feed-item:hover { background:rgba(255,255,255,0.02); border-radius:10px; padding-left:8px; padding-right:8px; }

  /* scrollbar */
  .perf-scroll::-webkit-scrollbar { width:3px; }
  .perf-scroll::-webkit-scrollbar-track { background:transparent; }
  .perf-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
`

/* ─────────────────────────────────────────
   AURORA BACKGROUND
───────────────────────────────────────── */
function AuroraBackground() {
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      <div style={{
        position:'absolute', top:'-15%', left:'30%',
        width:'650px', height:'550px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(161,117,252,0.10) 0%,transparent 70%)',
        animation:'aurora1 20s ease-in-out infinite',
        filter:'blur(50px)',
      }}/>
      <div style={{
        position:'absolute', bottom:'5%', right:'8%',
        width:'480px', height:'480px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(255,107,53,0.07) 0%,transparent 70%)',
        animation:'aurora2 24s ease-in-out infinite',
        filter:'blur(50px)',
      }}/>
      <div style={{
        position:'absolute', top:'45%', left:'-8%',
        width:'380px', height:'380px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(251,113,133,0.06) 0%,transparent 70%)',
        animation:'aurora3 28s ease-in-out infinite',
        filter:'blur(50px)',
      }}/>
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)',
        backgroundSize:'64px 64px',
        maskImage:'radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)',
      }}/>
    </div>
  )
}

/* ─────────────────────────────────────────
   SVG ICONS
───────────────────────────────────────── */
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function IconAlert() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
function IconMoney() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
}
function IconStar({ filled = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}
function IconSpike() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  )
}
function IconReport() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

function feedIcon(key, color) {
  const s = { color }
  switch (key) {
    case 'check':  return <span style={s}><IconCheck/></span>
    case 'alert':  return <span style={s}><IconAlert/></span>
    case 'money':  return <span style={s}><IconMoney/></span>
    case 'star':   return <span style={s}><IconStar filled/></span>
    case 'spike':  return <span style={s}><IconSpike/></span>
    case 'report': return <span style={s}><IconReport/></span>
    default:       return null
  }
}

/* ─────────────────────────────────────────
   PROGRESS RING  (conic-gradient)
───────────────────────────────────────── */
function ProgressRing({ pct }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t) }, [])
  const deg = animated ? Math.round(pct * 3.6) : 0

  return (
    <div style={{ position:'relative', width:120, height:120, margin:'0 auto 16px' }}>
      {/* outer glow ring */}
      <div style={{
        position:'absolute', inset:-4, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(161,117,252,0.12) 60%,transparent 80%)',
      }}/>
      {/* track */}
      <div style={{
        width:120, height:120, borderRadius:'50%',
        background:'rgba(255,255,255,0.06)',
        display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative',
      }}>
        {/* filled ring */}
        <div style={{
          position:'absolute', inset:0, borderRadius:'50%',
          background:`conic-gradient(#A175FC 0deg, #FF6B35 ${deg}deg, rgba(255,255,255,0.08) ${deg}deg 360deg)`,
          transition:'background 1.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}/>
        {/* inner circle */}
        <div style={{
          position:'absolute', inset:14, borderRadius:'50%',
          background:'#1C0F36',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:1,
        }}>
          <span style={{
            fontSize:'22px', fontWeight:800, color:'#F8FAFC',
            letterSpacing:'-0.03em',
          }}>
            {pct}%
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   SPARKLINE BARS (resolution time)
───────────────────────────────────────── */
const SPARKLINE = [2.1, 2.8, 1.9, 2.4, 3.1, 2.0, 2.4]
const SPARKLINE_MAX = 3.5

function SparklineBars() {
  const [animate, setAnimate] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 500); return () => clearTimeout(t) }, [])

  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:'5px', height:40, margin:'0 auto 16px', width:'fit-content' }}>
      {SPARKLINE.map((v, i) => {
        const h = animate ? Math.round((v / SPARKLINE_MAX) * 40) : 0
        return (
          <div key={i} style={{
            width:10,
            height: h,
            borderRadius:'3px 3px 0 0',
            background: i === 6
              ? 'linear-gradient(180deg,#A175FC,#FF6B35)'
              : 'rgba(161,117,252,0.35)',
            transition:`height 0.7s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms`,
            minHeight: animate ? 3 : 0,
          }}/>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────
   CSAT STARS
───────────────────────────────────────── */
function CsatStars({ score }) {
  const full    = Math.floor(score)
  const partial = score - full
  return (
    <div style={{ display:'flex', gap:'4px', alignItems:'center', margin:'0 auto 16px', width:'fit-content' }}>
      {[1,2,3,4,5].map(n => {
        const isFull    = n <= full
        const isPartial = n === full + 1 && partial > 0
        return (
          <div key={n} style={{ position:'relative', width:20, height:20, color:'rgba(255,255,255,0.15)' }}>
            <IconStar/>
            {(isFull || isPartial) && (
              <div style={{
                position:'absolute', inset:0,
                overflow:'hidden',
                width: isPartial ? `${Math.round(partial*100)}%` : '100%',
                color:'#FFD700',
              }}>
                <IconStar filled/>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────
   RESOLUTION BAR  (table cell)
───────────────────────────────────────── */
function ResolutionBar({ pct }) {
  const [animated, setAnimated] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setAnimated(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const color = pct >= 95 ? '#4ade80' : pct >= 90 ? '#A175FC' : '#FF6B35'

  return (
    <div ref={ref} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
      <div style={{
        flex:1, height:5, borderRadius:'3px',
        background:'rgba(255,255,255,0.07)', overflow:'hidden',
      }}>
        <div style={{
          height:'100%', borderRadius:'3px',
          background: color,
          width: animated ? `${pct}%` : '0%',
          transition:'width 0.9s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: `0 0 8px ${color}66`,
        }}/>
      </div>
      <span style={{ fontSize:'13px', fontWeight:600, color, minWidth:32, textAlign:'right' }}>
        {pct}%
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────
   CHART BAR ROW
───────────────────────────────────────── */
function ChartBarRow({ day, count, max, delay }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), delay); return () => clearTimeout(t) }, [delay])
  const pct = (count / max) * 100

  return (
    <div className="chart-bar-wrap" style={{
      display:'grid', gridTemplateColumns:'36px 1fr 28px',
      alignItems:'center', gap:'12px',
      position:'relative', cursor:'default',
    }}>
      <span style={{ fontSize:'12px', fontWeight:500, color:'rgba(248,250,252,0.4)', textAlign:'right' }}>
        {day}
      </span>
      <div style={{
        height:9, borderRadius:'5px',
        background:'rgba(255,255,255,0.06)', overflow:'hidden', position:'relative',
      }}>
        <div className="chart-bar-inner" style={{
          height:'100%', borderRadius:'5px',
          background:'linear-gradient(90deg,#A175FC,#FF6B35)',
          width: animated ? `${pct}%` : '0%',
          transition:`width 0.8s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
          boxShadow:'0 0 12px rgba(161,117,252,0.35)',
        }}/>
      </div>
      <span style={{ fontSize:'12px', fontWeight:600, color:'rgba(248,250,252,0.55)', textAlign:'left' }}>
        {count}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────
   SECTION CARD WRAPPER
───────────────────────────────────────── */
function SectionCard({ children, style = {} }) {
  return (
    <div style={{
      background:'rgba(255,255,255,0.04)',
      border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:14,
      padding:'24px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize:'13px', fontWeight:700,
      letterSpacing:'.08em', textTransform:'uppercase',
      color:'rgba(248,250,252,0.35)',
      marginBottom:'20px',
    }}>
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
export default function PerformancePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login' }
    })
  }, [])

  if (!mounted) return null

  return (
    <div className="perf-root" style={{ display:'flex', minHeight:'100vh', background:'#1C0F36' }}>
      <style>{CSS}</style>
      <Sidebar/>

      {/* MAIN */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        position:'relative', overflow:'hidden', minWidth:0,
      }}>
        <AuroraBackground/>

        <div
          className="perf-scroll"
          style={{
            flex:1, overflowY:'auto',
            padding:'40px 40px 60px',
            position:'relative', zIndex:1,
            maxWidth:1200, margin:'0 auto', width:'100%',
          }}
        >

          {/* ── PAGE HEADER ── */}
          <div style={{
            marginBottom:36,
            animation:'revealUp 0.5s ease-out both',
          }}>
            <h1 style={{
              fontSize:28, fontWeight:800,
              letterSpacing:'-0.03em', color:'#F8FAFC',
              marginBottom:6,
            }}>
              Performance
            </h1>
            <p style={{ fontSize:14, color:'rgba(248,250,252,0.4)', fontWeight:400 }}>
              Customer support metrics · This month
            </p>
          </div>

          {/* ── HERO KPI ROW ── */}
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(3,1fr)',
            gap:20, marginBottom:28,
            animation:'revealUp 0.5s ease-out 0.08s both',
          }}>

            {/* 1 · Response Rate */}
            <div className="hero-card">
              <ProgressRing pct={94}/>
              <div style={{ fontSize:'13px', fontWeight:600, color:'rgba(248,250,252,0.45)', letterSpacing:'.04em', textTransform:'uppercase' }}>
                First Response Rate
              </div>
            </div>

            {/* 2 · Avg Resolution Time */}
            <div className="hero-card">
              <div style={{
                fontSize:'42px', fontWeight:800,
                letterSpacing:'-0.04em', color:'#F8FAFC',
                marginBottom:4, lineHeight:1,
              }}>
                2.4h
              </div>
              <div style={{ fontSize:'11px', color:'rgba(248,250,252,0.3)', marginBottom:18 }}>
                avg this week
              </div>
              <SparklineBars/>
              <div style={{ fontSize:'13px', fontWeight:600, color:'rgba(248,250,252,0.45)', letterSpacing:'.04em', textTransform:'uppercase' }}>
                Average per Ticket
              </div>
            </div>

            {/* 3 · CSAT */}
            <div className="hero-card">
              <div style={{
                fontSize:'42px', fontWeight:800,
                letterSpacing:'-0.04em', color:'#F8FAFC',
                marginBottom:4, lineHeight:1,
              }}>
                4.8
                <span style={{ fontSize:'22px', color:'rgba(248,250,252,0.35)', fontWeight:600 }}> / 5</span>
              </div>
              <div style={{ fontSize:'11px', color:'rgba(248,250,252,0.3)', marginBottom:18 }}>
                this month
              </div>
              <CsatStars score={4.8}/>
              <div style={{ fontSize:'13px', fontWeight:600, color:'rgba(248,250,252,0.45)', letterSpacing:'.04em', textTransform:'uppercase' }}>
                Customer Satisfaction
              </div>
            </div>

          </div>

          {/* ── BOTTOM GRID: table + chart ── */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 340px',
            gap:20, marginBottom:28,
            animation:'revealUp 0.5s ease-out 0.16s both',
          }}>

            {/* AGENT PERFORMANCE TABLE */}
            <SectionCard>
              <SectionTitle>Agent Performance</SectionTitle>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Agent','Tickets','Avg Response','Resolution','CSAT'].map(h => (
                        <th key={h} style={{
                          textAlign: h === 'Agent' ? 'left' : 'right',
                          fontSize:'11px', fontWeight:600,
                          letterSpacing:'.07em', textTransform:'uppercase',
                          color:'rgba(248,250,252,0.25)',
                          paddingBottom:14,
                          paddingLeft: h === 'Agent' ? 0 : 12,
                          paddingRight: h === 'Agent' ? 12 : 0,
                          borderBottom:'1px solid rgba(255,255,255,0.06)',
                          whiteSpace:'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AGENTS.map((agent, i) => (
                      <tr
                        key={agent.name}
                        className="agent-row"
                        style={{ animation:`revealUp 0.4s ease-out ${0.18 + i * 0.07}s both` }}
                      >
                        {/* Name */}
                        <td style={{ padding:'14px 12px 14px 0' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{
                              width:30, height:30, borderRadius:'50%', flexShrink:0,
                              background:'linear-gradient(135deg,#A175FC,#7C3AED)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:'11px', fontWeight:700, color:'#fff',
                            }}>
                              {agent.name.split(' ').map(w => w[0]).join('')}
                            </div>
                            <span style={{ fontSize:'14px', fontWeight:600, color:'#F8FAFC' }}>
                              {agent.name}
                            </span>
                          </div>
                        </td>
                        {/* Tickets */}
                        <td style={{ textAlign:'right', padding:'14px 12px', fontSize:'14px', fontWeight:600, color:'rgba(248,250,252,0.8)' }}>
                          {agent.tickets}
                        </td>
                        {/* Avg Response */}
                        <td style={{ textAlign:'right', padding:'14px 12px', fontSize:'14px', color:'rgba(248,250,252,0.65)' }}>
                          {agent.avgResponse}
                        </td>
                        {/* Resolution — progress bar */}
                        <td style={{ padding:'14px 12px', minWidth:120 }}>
                          <ResolutionBar pct={agent.resolution}/>
                        </td>
                        {/* CSAT */}
                        <td style={{ textAlign:'right', padding:'14px 0 14px 12px' }}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:4,
                            fontSize:'13px', fontWeight:700,
                            color: agent.csat >= 4.9 ? '#4ade80' : agent.csat >= 4.7 ? '#A175FC' : 'rgba(248,250,252,0.65)',
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                            {agent.csat.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* TICKET VOLUME CHART */}
            <SectionCard>
              <SectionTitle>Ticket Volume</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {CHART_DATA.map((row, i) => (
                  <ChartBarRow
                    key={row.day}
                    day={row.day}
                    count={row.count}
                    max={CHART_MAX}
                    delay={200 + i * 80}
                  />
                ))}
              </div>
              {/* total badge */}
              <div style={{
                marginTop:20, paddingTop:16,
                borderTop:'1px solid rgba(255,255,255,0.06)',
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <span style={{ fontSize:'12px', color:'rgba(248,250,252,0.3)' }}>Total this week</span>
                <span style={{ fontSize:'18px', fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.02em' }}>
                  {CHART_DATA.reduce((a, b) => a + b.count, 0)}
                </span>
              </div>
            </SectionCard>

          </div>

          {/* ── ACTIVITY FEED ── */}
          <SectionCard style={{ animation:'revealUp 0.5s ease-out 0.28s both' }}>
            <SectionTitle>Activity Feed</SectionTitle>
            <div style={{ position:'relative' }}>
              {/* timeline spine */}
              <div style={{
                position:'absolute', left:18, top:8, bottom:8, width:2,
                background:'linear-gradient(180deg,#A175FC 0%,#FF6B35 100%)',
                borderRadius:2, opacity:0.35,
              }}/>

              <div style={{ paddingLeft:0 }}>
                {FEED.map((item, i) => (
                  <div
                    key={i}
                    className="feed-item"
                    style={{ animation:`revealUp 0.4s ease-out ${0.30 + i * 0.06}s both` }}
                  >
                    {/* icon bubble */}
                    <div style={{
                      width:36, height:36, borderRadius:'50%', flexShrink:0,
                      background:`${item.color}15`,
                      border:`1px solid ${item.color}30`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color: item.color, zIndex:1,
                      position:'relative',
                    }}>
                      {feedIcon(item.icon, item.color)}
                    </div>

                    {/* text */}
                    <div style={{ flex:1, paddingTop:2 }}>
                      <div style={{ fontSize:'14px', color:'rgba(248,250,252,0.88)', lineHeight:1.5, marginBottom:3 }}>
                        {item.text}
                      </div>
                      <div style={{ fontSize:'12px', color:'rgba(248,250,252,0.3)', fontWeight:500 }}>
                        {item.time}
                      </div>
                    </div>

                    {/* dot accent */}
                    <div style={{
                      width:7, height:7, borderRadius:'50%', flexShrink:0, marginTop:14,
                      background: item.color, opacity:0.5,
                      boxShadow:`0 0 6px ${item.color}`,
                    }}/>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  )
}
