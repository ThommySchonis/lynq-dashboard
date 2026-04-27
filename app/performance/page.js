'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_PERF = {
  workload: {
    created: 47, closed: 38, open: 12, messagesReceived: 186,
    weekly: [
      { label: 'Mar 2',  created: 14, closed: 12 },
      { label: 'Mar 9',  created:  9, closed:  7 },
      { label: 'Mar 16', created: 16, closed: 13 },
      { label: 'Mar 23', created: 12, closed: 10 },
      { label: 'Mar 30', created: 18, closed: 15 },
      { label: 'Apr 6',  created: 13, closed: 11 },
      { label: 'Apr 13', created:  7, closed:  5 },
    ],
  },
  productivity: {
    ticketsReplied: 42,
    messagesSent: 94,
    oneTouchCount: 16,
    oneTouchPct: '42.1',
    avgMessages: '3.9',
    channels: [
      { name: 'Email',        count: 29, pct: 62 },
      { name: 'Chat',         count: 12, pct: 26 },
      { name: 'Contact Form', count:  6, pct: 13 },
    ],
  },
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes fadeIn {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes skPulse {
    0%,100% { opacity:.45; }
    50%     { opacity:.9; }
  }
  @keyframes barRise {
    from { transform:scaleY(0); }
    to   { transform:scaleY(1); }
  }

  .perf-root * { box-sizing:border-box; margin:0; padding:0; }
  .perf-root {
    font-family:var(--font-rethink),'Rethink Sans',-apple-system,BlinkMacSystemFont,sans-serif;
    -webkit-font-smoothing:antialiased;
  }

  .kpi-card {
    background:rgba(255,255,255,0.035);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:12px;
    padding:20px 18px 18px;
    position:relative;
    overflow:hidden;
    transition:border-color .2s ease, background .2s ease;
    cursor:default;
  }
  .kpi-card:hover {
    border-color:rgba(255,255,255,0.14);
    background:rgba(255,255,255,0.055);
  }
  .kpi-card .top-bar {
    position:absolute; top:0; left:0; right:0; height:2px; border-radius:12px 12px 0 0;
  }
  .kpi-card .accent-glow {
    position:absolute; inset:0; pointer-events:none; border-radius:12px;
    opacity:.6; transition:opacity .2s;
  }
  .kpi-card:hover .accent-glow { opacity:1; }

  .panel {
    background:rgba(255,255,255,0.035);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:12px;
    padding:22px 24px;
    transition:border-color .2s ease;
  }
  .panel:hover { border-color:rgba(255,255,255,0.11); }

  .sk { background:rgba(255,255,255,0.07); border-radius:6px; animation:skPulse 1.4s ease-in-out infinite; }

  .range-pill {
    padding:5px 13px; border-radius:100px; border:none; font-size:12px; font-weight:600;
    cursor:pointer; transition:all .15s; font-family:inherit; white-space:nowrap;
  }
  .range-pill:hover { opacity:.85; }

  .ch-row { transition:background .15s; border-radius:8px; padding:8px 0; }
  .ch-row:hover { background:rgba(255,255,255,0.03); }

  .bar-col:hover .bar-tooltip { opacity:1; transform:translateY(0); }
  .bar-tooltip {
    opacity:0; transform:translateY(4px);
    transition:opacity .15s, transform .15s;
    pointer-events:none;
  }

  .perf-scroll::-webkit-scrollbar { width:3px; }
  .perf-scroll::-webkit-scrollbar-track { background:transparent; }
  .perf-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n) { return Math.round(n).toLocaleString('en-US') }

function useCountUp(target, active) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    const dur = 900, start = Date.now()
    const run = () => {
      const t = Math.min((Date.now() - start) / dur, 1)
      setVal(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) requestAnimationFrame(run)
      else setVal(target)
    }
    requestAnimationFrame(run)
  }, [target, active])
  return val
}

// ─── Date ranges ──────────────────────────────────────────────────────────────
const RANGES = [
  { id: '7d',     label: '7D' },
  { id: '30d',    label: '30D' },
  { id: 'month',  label: 'This month' },
  { id: '3month', label: '3 months' },
  { id: 'custom', label: 'Custom' },
]

function getDateRange(id) {
  const today = new Date()
  const pad = n => String(n).padStart(2, '0')
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const to = fmt(today)
  if (id === '7d')    { const f = new Date(today); f.setDate(f.getDate() - 6);   return { from: fmt(f), to } }
  if (id === '30d')   { const f = new Date(today); f.setDate(f.getDate() - 29);  return { from: fmt(f), to } }
  if (id === 'month') { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: fmt(f), to } }
  if (id === '3month'){ const f = new Date(today); f.setMonth(f.getMonth() - 3); return { from: fmt(f), to } }
  return { from: '', to: '' }
}

// ─── PageBackground ───────────────────────────────────────────────────────────
function PageBackground() {
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      <div style={{ position:'absolute', top:'-8%', right:'10%', width:700, height:500, borderRadius:'50%', background:'radial-gradient(ellipse,rgba(161,117,252,0.065) 0%,transparent 70%)', filter:'blur(70px)' }}/>
      <div style={{ position:'absolute', bottom:'15%', left:'0%', width:500, height:400, borderRadius:'50%', background:'radial-gradient(ellipse,rgba(74,222,128,0.035) 0%,transparent 70%)', filter:'blur(70px)' }}/>
    </div>
  )
}

// ─── Section divider ──────────────────────────────────────────────────────────
function SectionDivider({ title, marginTop = 8 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, marginTop, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ height:1, flex:1, background:'rgba(255,255,255,0.07)' }}/>
      <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.12em', color:'rgba(248,250,252,0.28)', textTransform:'uppercase', flexShrink:0 }}>{title}</span>
      <div style={{ height:1, flex:1, background:'rgba(255,255,255,0.07)' }}/>
    </div>
  )
}

// ─── Workload KPIs ────────────────────────────────────────────────────────────
function WorkloadKPIs({ data, loaded }) {
  const aCreated  = useCountUp(data.created         || 0, loaded)
  const aClosed   = useCountUp(data.closed          || 0, loaded)
  const aOpen     = useCountUp(data.open            || 0, loaded)
  const aMessages = useCountUp(data.messagesReceived|| 0, loaded)

  const closeRate = data.created > 0 ? ((data.closed / data.created) * 100).toFixed(0) : null

  const cards = [
    {
      label:'Created', value:fmtNum(aCreated), sub:'new tickets this period',
      accent:'#A175FC', grad:'linear-gradient(135deg,#A175FC,#C3A3FF)',
      icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    },
    {
      label:'Closed', value:fmtNum(aClosed), sub: closeRate ? `${closeRate}% close rate` : 'resolved this period',
      accent:'#4ade80', grad:'linear-gradient(135deg,#4ade80,#86efac)',
      icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
      badge: closeRate ? { value:`${closeRate}%`, color:'#4ade80' } : null,
    },
    {
      label:'Open', value:fmtNum(aOpen), sub:'currently awaiting reply',
      accent:'#F97316', grad:'linear-gradient(135deg,#F97316,#fbbf24)',
      icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      label:'Messages', value:fmtNum(aMessages), sub:'total messages received',
      accent:'#38bdf8', grad:'linear-gradient(135deg,#38bdf8,#7dd3fc)',
      icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    },
  ]

  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
      {[0,1,2,3].map(i => (
        <div key={i} className="kpi-card">
          <div className="sk" style={{ height:10, width:'50%', marginBottom:16 }}/>
          <div className="sk" style={{ height:28, width:'65%', marginBottom:9 }}/>
          <div className="sk" style={{ height:9, width:'80%' }}/>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
      {cards.map(c => (
        <div key={c.label} className="kpi-card" style={{ animation:'fadeIn .3s ease-out both' }}>
          <div className="top-bar" style={{ background:c.grad }}/>
          <div className="accent-glow" style={{ background:`radial-gradient(circle at 15% 85%, ${c.accent}0d 0%, transparent 60%)` }}/>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, position:'relative', zIndex:1 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`${c.accent}15`, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent }}>{c.icon}</div>
            {c.badge && (
              <span style={{ fontSize:10, fontWeight:800, color:c.badge.color, background:`${c.badge.color}14`, border:`1px solid ${c.badge.color}25`, borderRadius:6, padding:'2px 7px', letterSpacing:'.03em', fontVariantNumeric:'tabular-nums' }}>{c.badge.value}</span>
            )}
          </div>
          <div style={{ fontSize:30, fontWeight:800, letterSpacing:'-0.04em', color:c.accent, lineHeight:1, marginBottom:6, fontVariantNumeric:'tabular-nums', position:'relative', zIndex:1 }}>{c.value}</div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.09em', color:'rgba(248,250,252,0.3)', textTransform:'uppercase', marginBottom:3, position:'relative', zIndex:1 }}>{c.label}</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.22)', lineHeight:1.4, position:'relative', zIndex:1 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Weekly chart (SVG with gridlines + tooltips) ─────────────────────────────
function WeeklyChart({ weekly, loaded }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  if (!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div className="sk" style={{ height:13, width:'28%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'18%', marginBottom:22 }}/>
      <div className="sk" style={{ height:110, borderRadius:8 }}/>
    </div>
  )
  if (!weekly || weekly.length === 0) return null

  const maxVal = Math.max(...weekly.flatMap(w => [w.created, w.closed]), 1)
  const BAR_H   = 100
  const PAD_TOP = 16
  const PAD_BOT = 26
  const barW    = 18
  const barGap  = 5
  const colW    = barW * 2 + barGap + 18
  const totalW  = weekly.length * colW
  const gridPcts = [0.25, 0.5, 0.75, 1]

  function barY(val) { return PAD_TOP + BAR_H - (val / maxVal) * BAR_H }
  function barH(val) { return (val / maxVal) * BAR_H }

  return (
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Weekly ticket volume</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.32)' }}>Created vs closed per week</div>
        </div>
        <div style={{ display:'flex', gap:18 }}>
          {[['#A175FC','Created'],['#4ade80','Closed']].map(([color, label]) => (
            <span key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'rgba(248,250,252,0.4)' }}>
              <span style={{ width:10, height:10, borderRadius:3, background:color, display:'inline-block', opacity:.7 }}/>{label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ overflowX:'auto' }}>
        <svg
          width={totalW}
          height={PAD_TOP + BAR_H + PAD_BOT}
          style={{ display:'block', minWidth:'100%', overflow:'visible' }}
        >
          {/* Gridlines */}
          {gridPcts.map(p => {
            const y = PAD_TOP + BAR_H - p * BAR_H
            return (
              <line key={p} x1={0} y1={y} x2={totalW} y2={y}
                stroke={p === 1 ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)'}
                strokeWidth={1} strokeDasharray={p === 1 ? '0' : '3 4'}/>
            )
          })}

          {/* Bars */}
          {weekly.map((w, i) => {
            const x = i * colW + 9
            const isHov = hoveredIdx === i
            const cH = barH(w.created), clH = barH(w.closed)
            return (
              <g key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor:'default' }}
              >
                {/* Hover zone */}
                <rect x={x - 4} y={PAD_TOP} width={barW * 2 + barGap + 8} height={BAR_H} fill="transparent"/>

                {/* Created bar */}
                <rect
                  x={x} y={barY(w.created)}
                  width={barW} height={Math.max(cH, 2)} rx={3}
                  fill={isHov ? 'rgba(161,117,252,0.75)' : 'rgba(161,117,252,0.45)'}
                  style={{ transition:'fill .15s' }}
                />
                {/* Closed bar */}
                <rect
                  x={x + barW + barGap} y={barY(w.closed)}
                  width={barW} height={Math.max(clH, 2)} rx={3}
                  fill={isHov ? 'rgba(74,222,128,0.75)' : 'rgba(74,222,128,0.45)'}
                  style={{ transition:'fill .15s' }}
                />

                {/* Tooltip */}
                {isHov && (
                  <g>
                    <rect x={x - 6} y={PAD_TOP - 36} width={60} height={30} rx={5} fill="#1e1040" stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
                    <text x={x + 24} y={PAD_TOP - 24} textAnchor="middle" fill="#A175FC" fontSize={10} fontWeight="700">{w.created}</text>
                    <text x={x + 24} y={PAD_TOP - 13} textAnchor="middle" fill="#4ade80" fontSize={10} fontWeight="700">{w.closed}</text>
                  </g>
                )}

                {/* Week label */}
                <text
                  x={x + barW + barGap / 2} y={PAD_TOP + BAR_H + 16}
                  textAnchor="middle" fill="rgba(248,250,252,0.28)" fontSize={9}
                >{w.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── Productivity KPIs ────────────────────────────────────────────────────────
function ProductivityKPIs({ data, loaded }) {
  const aReplied   = useCountUp(data.ticketsReplied || 0, loaded)
  const aSent      = useCountUp(data.messagesSent   || 0, loaded)
  const aOneTouch  = useCountUp(parseFloat(data.oneTouchPct || 0), loaded)
  const aOneTouchN = useCountUp(data.oneTouchCount  || 0, loaded)

  const cards = [
    {
      label:'Tickets replied', value:fmtNum(aReplied), sub:'agents sent at least 1 reply',
      accent:'#A175FC', grad:'linear-gradient(135deg,#A175FC,#C3A3FF)',
      icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>,
    },
    {
      label:'Messages sent', value:fmtNum(aSent), sub:'outbound agent messages',
      accent:'#38bdf8', grad:'linear-gradient(135deg,#38bdf8,#7dd3fc)',
      icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    },
    {
      label:'One-touch', value:`${aOneTouch.toFixed(1)}%`, sub:`${fmtNum(aOneTouchN)} tickets closed first reply`,
      accent:'#4ade80', grad:'linear-gradient(135deg,#4ade80,#86efac)',
      icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
    },
    {
      label:'Avg messages', value:data.avgMessages || '—', sub:'per ticket on average',
      accent:'#FB923C', grad:'linear-gradient(135deg,#F97316,#fbbf24)',
      icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg>,
    },
  ]

  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
      {[0,1,2,3].map(i => (
        <div key={i} className="kpi-card">
          <div className="sk" style={{ height:10, width:'50%', marginBottom:16 }}/>
          <div className="sk" style={{ height:28, width:'65%', marginBottom:9 }}/>
          <div className="sk" style={{ height:9, width:'80%' }}/>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
      {cards.map(c => (
        <div key={c.label} className="kpi-card" style={{ animation:'fadeIn .3s ease-out both' }}>
          <div className="top-bar" style={{ background:c.grad }}/>
          <div className="accent-glow" style={{ background:`radial-gradient(circle at 15% 85%, ${c.accent}0d 0%, transparent 60%)` }}/>
          <div style={{ marginBottom:16, position:'relative', zIndex:1 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`${c.accent}15`, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent }}>{c.icon}</div>
          </div>
          <div style={{ fontSize:30, fontWeight:800, letterSpacing:'-0.04em', color:c.accent, lineHeight:1, marginBottom:6, fontVariantNumeric:'tabular-nums', position:'relative', zIndex:1 }}>{c.value}</div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.09em', color:'rgba(248,250,252,0.3)', textTransform:'uppercase', marginBottom:3, position:'relative', zIndex:1 }}>{c.label}</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.22)', lineHeight:1.4, position:'relative', zIndex:1 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Channel breakdown ────────────────────────────────────────────────────────
const CH_COLORS = {
  email:'#A175FC', chat:'#38bdf8', 'contact form':'#4ade80',
  sms:'#F97316', api:'#fbbf24', voice:'#f472b6',
}

function ChannelBreakdown({ channels, loaded }) {
  if (!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div className="sk" style={{ height:13, width:'25%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'18%', marginBottom:18 }}/>
      <div className="sk" style={{ height:7, borderRadius:4, marginBottom:20 }}/>
      {[0,1,2].map(i => <div key={i} style={{ marginBottom:12 }}><div style={{ display:'flex', gap:10, marginBottom:7 }}><div className="sk" style={{ width:70, height:11 }}/><div className="sk" style={{ flex:1, height:11 }}/><div className="sk" style={{ width:28, height:11 }}/></div><div className="sk" style={{ height:5, borderRadius:3 }}/></div>)}
    </div>
  )
  if (!channels || channels.length === 0) return null

  const total = channels.reduce((s, c) => s + c.count, 0)

  return (
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Tickets by channel</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.32)' }}>{total.toLocaleString()} tickets · this period</div>
        </div>
      </div>

      {/* Stacked overview bar */}
      <div style={{ display:'flex', height:7, borderRadius:5, overflow:'hidden', marginBottom:22, gap:1.5 }}>
        {channels.map(ch => {
          const color = CH_COLORS[ch.name.toLowerCase()] || 'rgba(248,250,252,0.2)'
          return <div key={ch.name} style={{ flex:ch.pct, background:color, opacity:.65, minWidth:2 }}/>
        })}
      </div>

      {/* Detail rows */}
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {channels.map((ch, i) => {
          const color = CH_COLORS[ch.name.toLowerCase()] || 'rgba(248,250,252,0.2)'
          return (
            <div key={ch.name} className="ch-row" style={{ animation:`fadeIn .3s ease-out ${i * 60}ms both` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, paddingLeft:4, paddingRight:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0, opacity:.8 }}/>
                  <span style={{ fontSize:12.5, fontWeight:600, color:'rgba(248,250,252,0.72)' }}>{ch.name}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:11, color:'rgba(248,250,252,0.28)', fontVariantNumeric:'tabular-nums' }}>{ch.count.toLocaleString()}</span>
                  <span style={{ fontSize:12, fontWeight:800, color, minWidth:36, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{ch.pct}%</span>
                </div>
              </div>
              <div style={{ height:4, borderRadius:3, background:'rgba(255,255,255,0.05)', overflow:'hidden', marginLeft:4, marginRight:4 }}>
                <div style={{ height:'100%', borderRadius:3, background:color, width:`${ch.pct}%`, opacity:.6, transition:'width .9s cubic-bezier(0.34,1.56,0.64,1)' }}/>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [workload, setWorkload]         = useState({})
  const [productivity, setProductivity] = useState({})
  const [loaded, setLoaded]             = useState({ workload:false, productivity:false })
  const [demoMode, setDemoMode]         = useState(false)
  const [gorgiasOk, setGorgiasOk]       = useState(true)
  const [dateRange, setDateRange]       = useState('month')
  const [customFrom, setCustomFrom]     = useState('')
  const [customTo, setCustomTo]         = useState('')
  const [mounted, setMounted]           = useState(false)
  const tokenRef = useRef(null)

  function loadDemo() {
    setWorkload(DEMO_PERF.workload)
    setProductivity(DEMO_PERF.productivity)
    setLoaded({ workload:true, productivity:true })
    setDemoMode(true)
  }

  function exitDemo() {
    setDemoMode(false)
    setWorkload({}); setProductivity({})
    setLoaded({ workload:false, productivity:false })
    if (tokenRef.current) fetchStats(tokenRef.current, dateRange)
  }

  async function fetchStats(token, rangeId, fromOverride, toOverride) {
    setLoaded({ workload:false, productivity:false })
    const range = rangeId === 'custom' ? { from:fromOverride, to:toOverride } : getDateRange(rangeId)
    if (!range.from || !range.to) return
    try {
      const res = await fetch(`/api/gorgias/stats?from=${range.from}&to=${range.to}`, {
        headers: { Authorization:`Bearer ${token}` },
      })
      if (res.status === 400) { setGorgiasOk(false); setLoaded({ workload:true, productivity:true }); return }
      if (!res.ok) { setLoaded({ workload:true, productivity:true }); return }
      const d = await res.json()
      setWorkload(d.workload || {})
      setProductivity(d.productivity || {})
      setGorgiasOk(true)
    } catch {}
    setLoaded({ workload:true, productivity:true })
  }

  function selectRange(id) {
    setDateRange(id)
    if (id !== 'custom' && !demoMode && tokenRef.current) fetchStats(tokenRef.current, id)
  }

  function applyCustomRange(from, to) {
    if (from && to && !demoMode && tokenRef.current) fetchStats(tokenRef.current, 'custom', from, to)
  }

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (!session) { window.location.href = '/login'; return }
      tokenRef.current = session.access_token
      fetchStats(session.access_token, 'month')
    })
  }, [])

  if (!mounted) return null

  const allLoaded = loaded.workload && loaded.productivity

  return (
    <div className="perf-root" style={{ display:'flex', minHeight:'100vh', background:'#1C0F36' }}>
      <style>{CSS}</style>
      <Sidebar/>

      <div style={{ flex:1, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', minWidth:0 }}>
        <PageBackground/>

        <div className="perf-scroll" style={{ flex:1, overflowY:'auto', padding:'40px 40px 60px', position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto', width:'100%' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:32, animation:'fadeIn .3s ease-out both', flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.03em', color:'#F8FAFC', marginBottom:4 }}>Performance</h1>
              <p style={{ fontSize:13, color:'rgba(248,250,252,0.35)', lineHeight:1.5 }}>Customer support metrics · Gorgias</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
              {RANGES.map(r => (
                <button key={r.id} onClick={() => selectRange(r.id)} className="range-pill"
                  style={{
                    background: dateRange === r.id ? 'rgba(161,117,252,0.18)' : 'rgba(255,255,255,0.05)',
                    color:      dateRange === r.id ? '#C3A3FF' : 'rgba(248,250,252,0.4)',
                    boxShadow:  dateRange === r.id ? 'inset 0 0 0 1px rgba(161,117,252,0.4)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  }}>{r.label}</button>
              ))}
              {dateRange === 'custom' && (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:2 }}>
                  <input type="date" style={{ padding:'5px 10px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#F8FAFC', fontSize:12, fontFamily:'inherit' }} value={customFrom} max={customTo||undefined} onChange={e => { setCustomFrom(e.target.value); applyCustomRange(e.target.value, customTo) }}/>
                  <span style={{ fontSize:11, color:'rgba(248,250,252,0.25)' }}>→</span>
                  <input type="date" style={{ padding:'5px 10px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#F8FAFC', fontSize:12, fontFamily:'inherit' }} value={customTo} min={customFrom||undefined} max={new Date().toISOString().slice(0,10)} onChange={e => { setCustomTo(e.target.value); applyCustomRange(customFrom, e.target.value) }}/>
                </div>
              )}
              {!demoMode && (
                <button onClick={loadDemo} style={{ padding:'5px 14px', borderRadius:100, background:'rgba(161,117,252,0.1)', border:'1px solid rgba(161,117,252,0.22)', color:'#C3A3FF', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Preview demo</button>
              )}
            </div>
          </div>

          {/* Demo banner */}
          {demoMode && (
            <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(251,146,60,0.07)', border:'1px solid rgba(251,146,60,0.18)', borderRadius:10, padding:'12px 18px', marginBottom:24, animation:'fadeIn .4s ease-out both' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, fontWeight:700, color:'#FB923C', marginRight:8 }}>Demo mode</span><span style={{ fontSize:12, color:'rgba(248,250,252,0.42)' }}>Showing example data — connect Gorgias in Settings to see live metrics.</span></div>
              <button onClick={exitDemo} style={{ fontSize:11, fontWeight:600, color:'rgba(251,146,60,0.65)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Exit demo →</button>
            </div>
          )}

          {/* Gorgias not connected */}
          {!demoMode && allLoaded && !gorgiasOk && (
            <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(161,117,252,0.07)', border:'1px solid rgba(161,117,252,0.18)', borderRadius:10, padding:'12px 18px', marginBottom:24, animation:'fadeIn .4s ease-out both' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#A175FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, fontWeight:700, color:'#A175FC', marginRight:8 }}>Gorgias not connected</span><span style={{ fontSize:12, color:'rgba(248,250,252,0.5)' }}>Go to Settings → Integrations to connect your Gorgias account.</span></div>
              <button onClick={loadDemo} style={{ fontSize:11, fontWeight:700, color:'#C3A3FF', background:'rgba(161,117,252,0.12)', border:'1px solid rgba(161,117,252,0.25)', borderRadius:100, padding:'4px 12px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Preview demo</button>
            </div>
          )}

          {/* Workload */}
          <SectionDivider title="Workload"/>
          <WorkloadKPIs data={workload} loaded={loaded.workload}/>
          <WeeklyChart  weekly={workload.weekly} loaded={loaded.workload}/>

          {/* Productivity */}
          <SectionDivider title="Productivity" marginTop={16}/>
          <ProductivityKPIs data={productivity} loaded={loaded.productivity}/>
          <ChannelBreakdown channels={productivity.channels} loaded={loaded.productivity}/>

          <div style={{ marginTop:20, textAlign:'center', fontSize:10.5, color:'rgba(248,250,252,0.1)', letterSpacing:'.04em' }}>
            Lynq Analytics · Gorgias data · Refreshed on load
          </div>

        </div>
      </div>
    </div>
  )
}
