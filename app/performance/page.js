'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_PERF = {
  workload: {
    created: 47, closed: 38, open: 12, messagesReceived: 186,
    weekly: [
      { label:'Mar 2',  created:14, closed:12 },
      { label:'Mar 9',  created: 9, closed: 7 },
      { label:'Mar 16', created:16, closed:13 },
      { label:'Mar 23', created:12, closed:10 },
      { label:'Mar 30', created:18, closed:15 },
      { label:'Apr 6',  created:13, closed:11 },
      { label:'Apr 13', created: 7, closed: 5 },
    ],
  },
  responseTimes: { avgFirstResponse:452, avgResolution:1584, firstResponseSample:38, resolutionSample:38 },
  productivity: {
    ticketsReplied:42, messagesSent:94, oneTouchCount:16, oneTouchPct:'42.1', avgMessages:'3.9',
    channels: [
      { name:'Email',        count:29, pct:62 },
      { name:'Chat',         count:12, pct:26 },
      { name:'Contact Form', count: 6, pct:13 },
    ],
  },
}

// ─── CSS — exact analytics tokens ─────────────────────────────────────────────
const CSS = `
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{from{background-position:-400% 0}to{background-position:400% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glowPulse{0%,100%{opacity:.5}50%{opacity:1}}

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  }

  .pf-root *{box-sizing:border-box;margin:0;padding:0}
  .pf-root{font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased}
  .pf-scroll::-webkit-scrollbar{width:3px}
  .pf-scroll::-webkit-scrollbar-track{background:transparent}
  .pf-scroll::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:2px}

  .date-inp{background:var(--bg-surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text-1);padding:4px 10px;font-size:11.5px;font-family:inherit;cursor:pointer;outline:none;color-scheme:dark;transition:border-color .15s}
  .date-inp:focus{border-color:var(--accent-border)}
  .date-inp::-webkit-calendar-picker-indicator{filter:invert(.6);cursor:pointer}

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
    transition:border-color .2s ease, box-shadow .2s ease;
    box-shadow:var(--shadow-card);
  }
  .panel:hover{border-color:var(--border-hover);box-shadow:var(--shadow-card-hover)}

  .range-pill{padding:5px 14px;border-radius:100px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s ease}

  .sk{background:linear-gradient(90deg,var(--skeleton-from) 25%,var(--skeleton-to) 50%,var(--skeleton-from) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px}

  .ch-row{transition:background .15s;border-radius:8px;padding:8px 0}
  .ch-row:hover{background:var(--bg-input)}
`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n) { return Math.round(n).toLocaleString('en-US') }

function fmtMinutes(mins) {
  if (mins == null) return null
  if (mins < 60) return `${Math.round(mins)}m`
  if (mins < 24*60) { const h=Math.floor(mins/60),m=Math.round(mins%60); return m>0?`${h}h ${m}m`:`${h}h` }
  const d=Math.floor(mins/(24*60)),h=Math.round((mins%(24*60))/60)
  return h>0?`${d}d ${h}h`:`${d}d`
}

function useCountUp(target, active) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    const dur=900, start=Date.now()
    const run=()=>{ const t=Math.min((Date.now()-start)/dur,1); setVal(target*(1-Math.pow(1-t,3))); if(t<1)requestAnimationFrame(run); else setVal(target) }
    requestAnimationFrame(run)
  }, [target, active])
  return val
}

function Spinner({ size=18 }) {
  return <div style={{ width:size, height:size, border:`2px solid var(--border)`, borderTop:`2px solid #A175FC`, borderRadius:'50%', animation:'spin .7s linear infinite', flexShrink:0 }}/>
}

// ─── Date ranges ──────────────────────────────────────────────────────────────
const RANGES = [
  { id:'7d',     label:'7D'          },
  { id:'30d',    label:'30D'         },
  { id:'month',  label:'This month'  },
  { id:'3month', label:'3 months'    },
  { id:'custom', label:'Custom'      },
]

function getDateRange(id) {
  const today=new Date(), pad=n=>String(n).padStart(2,'0'), fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, to=fmt(today)
  if(id==='7d')    { const f=new Date(today); f.setDate(f.getDate()-6);   return{from:fmt(f),to} }
  if(id==='30d')   { const f=new Date(today); f.setDate(f.getDate()-29);  return{from:fmt(f),to} }
  if(id==='month') { const f=new Date(today.getFullYear(),today.getMonth(),1); return{from:fmt(f),to} }
  if(id==='3month'){ const f=new Date(today); f.setMonth(f.getMonth()-3); return{from:fmt(f),to} }
  return{from:'',to:''}
}

// ─── PageBackground — matches analytics ───────────────────────────────────────
function PageBackground() {
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      <div style={{ position:'absolute', top:0, right:0, width:600, height:500, background:'radial-gradient(ellipse at top right,rgba(161,117,252,0.1) 0%,transparent 65%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:0, left:0, width:400, height:400, background:'radial-gradient(ellipse at bottom left,rgba(161,117,252,0.05) 0%,transparent 65%)', pointerEvents:'none' }}/>
    </div>
  )
}

// ─── Section divider — minimal, consistent ────────────────────────────────────
function SectionDivider({ title, marginTop=8 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, marginTop, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ height:1, flex:1, background:'var(--bg-surface-2)' }}/>
      <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.13em', color:'var(--text-3)', textTransform:'uppercase', flexShrink:0 }}>{title}</span>
      <div style={{ height:1, flex:1, background:'var(--bg-surface-2)' }}/>
    </div>
  )
}

// ─── Workload KPIs ────────────────────────────────────────────────────────────
function WorkloadKPIs({ data, loaded }) {
  const aCreated  = useCountUp(data.created          ||0, loaded)
  const aClosed   = useCountUp(data.closed           ||0, loaded)
  const aOpen     = useCountUp(data.open             ||0, loaded)
  const aMessages = useCountUp(data.messagesReceived ||0, loaded)
  const closeRate = data.created>0 ? ((data.closed/data.created)*100).toFixed(0) : null

  const cards = [
    { label:'Created', value:fmtNum(aCreated), sub:'new tickets this period',
      accent:'#A175FC', grad:'linear-gradient(135deg,#A175FC,#C3A3FF)',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { label:'Closed', value:fmtNum(aClosed), sub:closeRate?`${closeRate}% close rate`:'resolved this period',
      accent:'#4ade80', grad:'linear-gradient(135deg,#4ade80,#86efac)',
      badge:closeRate?{value:`${closeRate}%`,color:'#4ade80'}:null,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
    { label:'Open', value:fmtNum(aOpen), sub:'currently awaiting reply',
      accent:'#F97316', grad:'linear-gradient(135deg,#F97316,#fbbf24)',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'Messages', value:fmtNum(aMessages), sub:'total messages received',
      accent:'#38bdf8', grad:'linear-gradient(135deg,#38bdf8,#7dd3fc)',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  ]

  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {[0,1,2,3].map(i=><div key={i} className="kpi-card"><div className="sk" style={{ height:11, width:'55%', marginBottom:14 }}/><div className="sk" style={{ height:30, width:'65%', marginBottom:8 }}/><div className="sk" style={{ height:9, width:'80%' }}/></div>)}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {cards.map(c=>(
        <div key={c.label} className="kpi-card" style={{ animation:'fadeIn .3s ease-out both' }}>
          <div className="top-bar" style={{ background:c.grad }}/>
          <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 100% 0%,${c.accent}08 0%,transparent 60%)`, borderRadius:12, pointerEvents:'none' }}/>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14, position:'relative', zIndex:1 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${c.accent}1a`, border:`1px solid ${c.accent}20`, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent }}>{c.icon}</div>
            {c.badge&&<span style={{ fontSize:10, fontWeight:800, color:c.badge.color, background:`${c.badge.color}14`, border:`1px solid ${c.badge.color}28`, borderRadius:6, padding:'2px 8px', letterSpacing:'.03em', fontVariantNumeric:'tabular-nums' }}>{c.badge.value}</span>}
          </div>
          <div style={{ fontSize:27, fontWeight:800, letterSpacing:'-0.04em', color:c.accent, lineHeight:1, marginBottom:5, fontVariantNumeric:'tabular-nums', position:'relative', zIndex:1 }}>{c.value}</div>
          <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.1em', color:'var(--text-3)', textTransform:'uppercase', marginBottom:4, position:'relative', zIndex:1 }}>{c.label}</div>
          <div style={{ fontSize:11, color:'var(--text-3)', lineHeight:1.4, position:'relative', zIndex:1 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Weekly chart ─────────────────────────────────────────────────────────────
function WeeklyChart({ weekly, loaded }) {
  const [hovIdx, setHovIdx] = useState(null)

  if (!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div className="sk" style={{ height:13, width:'28%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'18%', marginBottom:22 }}/>
      <div className="sk" style={{ height:110, borderRadius:8 }}/>
    </div>
  )
  if (!weekly||weekly.length===0) return null

  const maxVal=Math.max(...weekly.flatMap(w=>[w.created,w.closed]),1)
  const BAR_H=100,PAD_TOP=16,PAD_BOT=26,barW=18,barGap=5,colW=barW*2+barGap+18
  const totalW=weekly.length*colW
  const barY=v=>PAD_TOP+BAR_H-(v/maxVal)*BAR_H, barH=v=>(v/maxVal)*BAR_H

  return (
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Weekly ticket volume</div>
          <div style={{ fontSize:11, color:'var(--text-3)' }}>Created vs closed per week</div>
        </div>
        <div style={{ display:'flex', gap:18 }}>
          {[['#A175FC','Created'],['#4ade80','Closed']].map(([color,label])=>(
            <span key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-3)' }}>
              <span style={{ width:10, height:10, borderRadius:3, background:color, display:'inline-block', opacity:.75 }}/>{label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <svg width={totalW} height={PAD_TOP+BAR_H+PAD_BOT} style={{ display:'block', minWidth:'100%', overflow:'visible' }}>
          {[.25,.5,.75,1].map(p=>{const y=PAD_TOP+BAR_H-p*BAR_H; return <line key={p} x1={0} y1={y} x2={totalW} y2={y} stroke={p===1?'var(--bg-surface-2)':'var(--bg-input)'} strokeWidth={1} strokeDasharray={p===1?'0':'3 4'}/>})}
          {weekly.map((w,i)=>{
            const x=i*colW+9, isHov=hovIdx===i
            return (
              <g key={i} onMouseEnter={()=>setHovIdx(i)} onMouseLeave={()=>setHovIdx(null)} style={{ cursor:'default' }}>
                <rect x={x-4} y={PAD_TOP} width={barW*2+barGap+8} height={BAR_H} fill="transparent"/>
                <rect x={x} y={barY(w.created)} width={barW} height={Math.max(barH(w.created),2)} rx={3} fill={isHov?'rgba(161,117,252,0.8)':'rgba(161,117,252,0.5)'} style={{ transition:'fill .15s' }}/>
                <rect x={x+barW+barGap} y={barY(w.closed)} width={barW} height={Math.max(barH(w.closed),2)} rx={3} fill={isHov?'rgba(74,222,128,0.8)':'rgba(74,222,128,0.5)'} style={{ transition:'fill .15s' }}/>
                {isHov&&<g><rect x={x-6} y={PAD_TOP-38} width={64} height={32} rx={6} fill="rgba(15,8,40,0.95)" stroke="rgba(255,255,255,0.15)" strokeWidth={1}/><text x={x+26} y={PAD_TOP-25} textAnchor="middle" fill="#A175FC" fontSize={10} fontWeight="700">{w.created}</text><text x={x+26} y={PAD_TOP-13} textAnchor="middle" fill="#4ade80" fontSize={10} fontWeight="700">{w.closed}</text></g>}
                <text x={x+barW+barGap/2} y={PAD_TOP+BAR_H+16} textAnchor="middle" fill="rgba(248,250,252,0.3)" fontSize={9}>{w.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── Response Times ───────────────────────────────────────────────────────────
function getRTStatus(mins, thresholds) {
  if (mins==null) return { color:'var(--text-3)', grad:'linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))', label:'No data' }
  if (mins<thresholds[0]) return { color:'#4ade80', grad:'linear-gradient(135deg,#4ade80,#86efac)', label:'Excellent' }
  if (mins<thresholds[1]) return { color:'#fbbf24', grad:'linear-gradient(135deg,#fbbf24,#fde68a)', label:'Average' }
  return { color:'#f87171', grad:'linear-gradient(135deg,#f87171,#fca5a5)', label:'Slow' }
}

function ResponseTimesSection({ data, loaded }) {
  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:28 }}>
      {[0,1].map(i=><div key={i} className="kpi-card" style={{ padding:'22px 24px' }}><div className="sk" style={{ height:11, width:'45%', marginBottom:20 }}/><div className="sk" style={{ height:36, width:'48%', marginBottom:10 }}/><div className="sk" style={{ height:1, marginBottom:14 }}/><div className="sk" style={{ height:9, width:'60%' }}/></div>)}
    </div>
  )

  const cards = [
    { label:'First Response Time', value:fmtMinutes(data.avgFirstResponse), sub:data.firstResponseSample?`Avg across ${data.firstResponseSample} tickets`:'No tickets with response data yet', benchmark:'< 4h target', status:getRTStatus(data.avgFirstResponse,[240,720]), icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'Resolution Time', value:fmtMinutes(data.avgResolution), sub:data.resolutionSample?`Avg across ${data.resolutionSample} closed tickets`:'No closed tickets in this range', benchmark:'< 24h target', status:getRTStatus(data.avgResolution,[1440,4320]), icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:28, animation:'fadeIn .3s ease-out both' }}>
      {cards.map(c=>{
        const noData = c.value===null
        return (
          <div key={c.label} className="kpi-card" style={{ padding:'22px 24px' }}>
            <div className="top-bar" style={{ background:c.status.grad }}/>
            <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 100% 0%,${noData?'var(--bg-input)':c.status.color+'08'} 0%,transparent 55%)`, borderRadius:12, pointerEvents:'none' }}/>
            {noData ? (
              <div style={{ display:'flex', alignItems:'center', gap:20, position:'relative', zIndex:1 }}>
                <div style={{ flexShrink:0, position:'relative' }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeDasharray="5 4"/>
                    <circle cx="32" cy="32" r="18" fill="rgba(255,255,255,0.04)"/>
                  </svg>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-3)' }}>{c.icon}</div>
                </div>
                <div>
                  <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.1em', color:'var(--text-3)', textTransform:'uppercase', marginBottom:7 }}>{c.label}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--text-3)', marginBottom:5 }}>No data yet</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', lineHeight:1.5, marginBottom:10 }}>{c.sub}</div>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10.5, color:'var(--text-3)', background:'var(--bg-surface-2)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 9px' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {c.benchmark}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ position:'relative', zIndex:1 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${c.status.color}1a`, border:`1px solid ${c.status.color}20`, display:'flex', alignItems:'center', justifyContent:'center', color:c.status.color }}>{c.icon}</div>
                  <span style={{ fontSize:10, fontWeight:800, color:c.status.color, background:`${c.status.color}14`, border:`1px solid ${c.status.color}28`, borderRadius:6, padding:'2px 9px', letterSpacing:'.04em' }}>{c.status.label}</span>
                </div>
                <div style={{ fontSize:38, fontWeight:800, letterSpacing:'-0.04em', color:c.status.color, lineHeight:1, marginBottom:7, fontVariantNumeric:'tabular-nums' }}>{c.value}</div>
                <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.1em', color:'var(--text-3)', textTransform:'uppercase', marginBottom:14 }}>{c.label}</div>
                <div style={{ height:1, background:'var(--bg-surface-2)', marginBottom:12 }}/>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:11, color:'var(--text-3)', lineHeight:1.4 }}>{c.sub}</div>
                  <span style={{ fontSize:10.5, color:c.status.color, background:`${c.status.color}12`, border:`1px solid ${c.status.color}22`, borderRadius:6, padding:'2px 9px', flexShrink:0, marginLeft:12, whiteSpace:'nowrap' }}>{c.benchmark}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Productivity KPIs ────────────────────────────────────────────────────────
function ProductivityKPIs({ data, loaded }) {
  const aReplied  = useCountUp(data.ticketsReplied||0, loaded)
  const aSent     = useCountUp(data.messagesSent  ||0, loaded)
  const aOT       = useCountUp(parseFloat(data.oneTouchPct||0), loaded)
  const aOTN      = useCountUp(data.oneTouchCount ||0, loaded)

  const cards = [
    { label:'Tickets replied', value:fmtNum(aReplied), sub:'agents sent at least 1 reply',
      accent:'#A175FC', grad:'linear-gradient(135deg,#A175FC,#C3A3FF)',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg> },
    { label:'Messages sent', value:fmtNum(aSent), sub:'outbound agent messages',
      accent:'#38bdf8', grad:'linear-gradient(135deg,#38bdf8,#7dd3fc)',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
    { label:'One-touch', value:`${aOT.toFixed(1)}%`, sub:`${fmtNum(aOTN)} tickets closed in one reply`,
      accent:'#4ade80', grad:'linear-gradient(135deg,#4ade80,#86efac)',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> },
    { label:'Avg messages', value:data.avgMessages||'—', sub:'per ticket on average',
      accent:'#FB923C', grad:'linear-gradient(135deg,#F97316,#fbbf24)',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg> },
  ]

  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {[0,1,2,3].map(i=><div key={i} className="kpi-card"><div className="sk" style={{ height:11, width:'55%', marginBottom:14 }}/><div className="sk" style={{ height:30, width:'65%', marginBottom:8 }}/><div className="sk" style={{ height:9, width:'80%' }}/></div>)}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {cards.map(c=>(
        <div key={c.label} className="kpi-card" style={{ animation:'fadeIn .3s ease-out both' }}>
          <div className="top-bar" style={{ background:c.grad }}/>
          <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 100% 0%,${c.accent}08 0%,transparent 60%)`, borderRadius:12, pointerEvents:'none' }}/>
          <div style={{ marginBottom:14, position:'relative', zIndex:1 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${c.accent}1a`, border:`1px solid ${c.accent}20`, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent }}>{c.icon}</div>
          </div>
          <div style={{ fontSize:27, fontWeight:800, letterSpacing:'-0.04em', color:c.accent, lineHeight:1, marginBottom:5, fontVariantNumeric:'tabular-nums', position:'relative', zIndex:1 }}>{c.value}</div>
          <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.1em', color:'var(--text-3)', textTransform:'uppercase', marginBottom:4, position:'relative', zIndex:1 }}>{c.label}</div>
          <div style={{ fontSize:11, color:'var(--text-3)', lineHeight:1.4, position:'relative', zIndex:1 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Channel breakdown ────────────────────────────────────────────────────────
const CH_COLORS = { email:'#A175FC', chat:'#38bdf8', 'contact form':'#4ade80', sms:'#F97316', api:'#fbbf24', voice:'#f472b6' }

function ChannelBreakdown({ channels, loaded }) {
  if (!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div className="sk" style={{ height:13, width:'25%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'18%', marginBottom:18 }}/>
      <div className="sk" style={{ height:7, borderRadius:4, marginBottom:20 }}/>
      {[0,1,2].map(i=><div key={i} style={{ marginBottom:12 }}><div style={{ display:'flex', gap:10, marginBottom:7 }}><div className="sk" style={{ width:70, height:11 }}/><div className="sk" style={{ flex:1, height:11 }}/><div className="sk" style={{ width:28, height:11 }}/></div><div className="sk" style={{ height:5, borderRadius:3 }}/></div>)}
    </div>
  )
  if (!channels||channels.length===0) return null
  const total = channels.reduce((s,c)=>s+c.count, 0)
  return (
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Tickets by channel</div>
          <div style={{ fontSize:11, color:'var(--text-3)' }}>{total.toLocaleString()} tickets · this period</div>
        </div>
      </div>
      <div style={{ display:'flex', height:7, borderRadius:5, overflow:'hidden', marginBottom:22, gap:1.5 }}>
        {channels.map(ch=>{ const color=CH_COLORS[ch.name.toLowerCase()]||'var(--text-3)'; return <div key={ch.name} style={{ flex:ch.pct, background:color, opacity:.7, minWidth:2 }}/> })}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {channels.map((ch,i)=>{
          const color=CH_COLORS[ch.name.toLowerCase()]||'var(--text-3)'
          return (
            <div key={ch.name} className="ch-row" style={{ animation:`fadeIn .3s ease-out ${i*60}ms both` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, paddingLeft:4, paddingRight:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0, opacity:.85 }}/>
                  <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text-2)' }}>{ch.name}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:11, color:'var(--text-3)', fontVariantNumeric:'tabular-nums' }}>{ch.count.toLocaleString()}</span>
                  <span style={{ fontSize:12, fontWeight:800, color, minWidth:36, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{ch.pct}%</span>
                </div>
              </div>
              <div style={{ height:4, borderRadius:3, background:'var(--bg-surface-2)', overflow:'hidden', marginLeft:4, marginRight:4 }}>
                <div style={{ height:'100%', borderRadius:3, background:color, width:`${ch.pct}%`, opacity:.65, transition:'width .9s cubic-bezier(0.34,1.56,0.64,1)' }}/>
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
  const [workload, setWorkload]           = useState({})
  const [responseTimes, setResponseTimes] = useState({})
  const [productivity, setProductivity]   = useState({})
  const [loaded, setLoaded]               = useState({ workload:false, responseTimes:false, productivity:false })
  const [demoMode, setDemoMode]           = useState(false)
  const [gorgiasOk, setGorgiasOk]         = useState(true)
  const [dateRange, setDateRange]         = useState('month')
  const [customFrom, setCustomFrom]       = useState('')
  const [customTo, setCustomTo]           = useState('')
  const [mounted, setMounted]             = useState(false)
  const tokenRef = useRef(null)

  const allLoaded = loaded.workload && loaded.responseTimes && loaded.productivity

  function loadDemo() {
    setWorkload(DEMO_PERF.workload); setResponseTimes(DEMO_PERF.responseTimes); setProductivity(DEMO_PERF.productivity)
    setLoaded({ workload:true, responseTimes:true, productivity:true }); setDemoMode(true)
  }
  function exitDemo() {
    setDemoMode(false); setWorkload({}); setResponseTimes({}); setProductivity({})
    setLoaded({ workload:false, responseTimes:false, productivity:false })
    if (tokenRef.current) fetchStats(tokenRef.current, dateRange)
  }

  async function fetchStats(token, rangeId, fromO, toO) {
    setLoaded({ workload:false, responseTimes:false, productivity:false })
    const range = rangeId==='custom' ? {from:fromO,to:toO} : getDateRange(rangeId)
    if (!range.from||!range.to) return
    try {
      const res = await fetch(`/api/gorgias/stats?from=${range.from}&to=${range.to}`, { headers:{ Authorization:`Bearer ${token}` } })
      if (res.status===400) { setGorgiasOk(false); setLoaded({ workload:true, responseTimes:true, productivity:true }); return }
      if (!res.ok) { setLoaded({ workload:true, responseTimes:true, productivity:true }); return }
      const d = await res.json()
      setWorkload(d.workload||{}); setResponseTimes(d.responseTimes||{}); setProductivity(d.productivity||{})
      setGorgiasOk(true)
    } catch {}
    setLoaded({ workload:true, responseTimes:true, productivity:true })
  }

  function selectRange(id) { setDateRange(id); if(id!=='custom'&&!demoMode&&tokenRef.current) fetchStats(tokenRef.current,id) }
  function applyCustomRange(from,to) { if(from&&to&&!demoMode&&tokenRef.current) fetchStats(tokenRef.current,'custom',from,to) }

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (!session) { window.location.href='/login'; return }
      tokenRef.current = session.access_token
      fetchStats(session.access_token, 'month')
    })
  }, [])

  if (!mounted) return null

  return (
    <div className="pf-root" style={{ display:'flex', minHeight:'100vh', background:'var(--bg-page)' }}>
      <style>{CSS}</style>
      <Sidebar/>

      <main className="pf-scroll" style={{ flex:1, overflowY:'auto', padding:'36px 44px', position:'relative' }}>
        <PageBackground/>
        <div style={{ position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto' }}>

          {/* ── Header — matches analytics exactly ── */}
          <div style={{ marginBottom:28, animation:'fadeIn .5s ease-out both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h1 style={{ fontSize:28, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.04em', lineHeight:1.15, marginBottom:5, textShadow:'none' }}>Performance</h1>
                <p style={{ fontSize:12.5, color:'var(--text-3)' }}>Customer support metrics · Gorgias</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {demoMode
                  ? <button onClick={exitDemo} style={{ padding:'6px 14px', borderRadius:100, background:'rgba(251,146,60,0.12)', border:'1px solid rgba(251,146,60,0.3)', color:'#FB923C', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'.04em', fontFamily:'inherit' }}>Exit Demo</button>
                  : <button onClick={loadDemo} style={{ padding:'6px 14px', borderRadius:100, background:'rgba(161,117,252,0.1)', border:'1px solid rgba(161,117,252,0.25)', color:'#C3A3FF', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'.04em', fontFamily:'inherit' }}>Preview Demo</button>
                }
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', borderRadius:100, background:'var(--bg-input)', border:'1px solid var(--border)', backdropFilter:'blur(10px)' }}>
                  {!allLoaded
                    ? <Spinner size={14}/>
                    : <div style={{ width:6, height:6, borderRadius:'50%', background:demoMode?'#FB923C':gorgiasOk?'#4ade80':'#f87171', boxShadow:`0 0 6px ${demoMode?'rgba(251,146,60,0.5)':gorgiasOk?'rgba(74,222,128,0.5)':'rgba(248,113,113,0.5)'}`, animation:'glowPulse 2s ease-in-out infinite' }}/>
                  }
                  <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.09em', color:'var(--text-3)', textTransform:'uppercase' }}>
                    {!allLoaded?'Loading…':demoMode?'Demo':gorgiasOk?'Live':'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ height:'1px', background:'var(--bg-surface-2)', margin:'20px 0 16px' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              {RANGES.map(r=>(
                <button key={r.id} onClick={()=>selectRange(r.id)} className="range-pill" style={{ background:dateRange===r.id?'rgba(161,117,252,0.18)':'var(--bg-input)', color:dateRange===r.id?'#C3A3FF':'var(--text-3)', boxShadow:dateRange===r.id?'inset 0 0 0 1px rgba(161,117,252,0.4),0 0 12px rgba(161,117,252,0.08)':'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>{r.label}</button>
              ))}
              {dateRange==='custom'&&(
                <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:4 }}>
                  <input type="date" className="date-inp" value={customFrom} max={customTo||undefined} onChange={e=>{ setCustomFrom(e.target.value); applyCustomRange(e.target.value,customTo) }}/>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>→</span>
                  <input type="date" className="date-inp" value={customTo} min={customFrom||undefined} max={new Date().toISOString().slice(0,10)} onChange={e=>{ setCustomTo(e.target.value); applyCustomRange(customFrom,e.target.value) }}/>
                </div>
              )}
            </div>
          </div>

          {/* ── Demo banner ── */}
          {demoMode&&(
            <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(251,146,60,0.07)', border:'1px solid rgba(251,146,60,0.2)', borderRadius:10, padding:'12px 18px', marginBottom:24, animation:'fadeIn .4s ease-out both' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, fontWeight:700, color:'#FB923C', marginRight:8 }}>Demo mode</span><span style={{ fontSize:12, color:'var(--text-2)' }}>Showing example data — connect Gorgias in Settings to see live metrics.</span></div>
              <button onClick={exitDemo} style={{ fontSize:11, fontWeight:600, color:'rgba(251,146,60,0.7)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Exit demo →</button>
            </div>
          )}

          {/* ── Gorgias not connected ── */}
          {!demoMode&&allLoaded&&!gorgiasOk&&(
            <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(161,117,252,0.07)', border:'1px solid rgba(161,117,252,0.18)', borderRadius:10, padding:'12px 18px', marginBottom:24, animation:'fadeIn .4s ease-out both' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A175FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, fontWeight:700, color:'#A175FC', marginRight:8 }}>Gorgias not connected</span><span style={{ fontSize:12, color:'var(--text-2)' }}>Go to Settings → Integrations to connect your Gorgias account.</span></div>
              <button onClick={loadDemo} style={{ fontSize:11, fontWeight:700, color:'#C3A3FF', background:'rgba(161,117,252,0.12)', border:'1px solid rgba(161,117,252,0.25)', borderRadius:100, padding:'4px 12px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Preview demo</button>
            </div>
          )}

          <SectionDivider title="Workload"/>
          <WorkloadKPIs data={workload} loaded={loaded.workload}/>
          <WeeklyChart  weekly={workload.weekly} loaded={loaded.workload}/>

          <SectionDivider title="Response Times" marginTop={8}/>
          <ResponseTimesSection data={responseTimes} loaded={loaded.responseTimes}/>

          <SectionDivider title="Productivity" marginTop={8}/>
          <ProductivityKPIs data={productivity} loaded={loaded.productivity}/>
          <ChannelBreakdown channels={productivity.channels} loaded={loaded.productivity}/>

          <div style={{ marginTop:16, textAlign:'center', fontSize:10.5, color:'var(--text-3)', letterSpacing:'.04em' }}>
            Lynq Analytics · Gorgias data · Refreshed on load
          </div>
        </div>
      </main>
    </div>
  )
}
