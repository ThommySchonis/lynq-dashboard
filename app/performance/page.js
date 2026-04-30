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

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{from{background-position:-400% 0}to{background-position:400% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  }

  .pf-root *{box-sizing:border-box;margin:0;padding:0}
  .pf-root{font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased}
  .pf-scroll::-webkit-scrollbar{width:3px}
  .pf-scroll::-webkit-scrollbar-track{background:transparent}
  .pf-scroll::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:2px}

  .date-inp{background:#F5F5F5;border:1px solid rgba(0,0,0,0.08);border-radius:7px;color:#111111;padding:4px 10px;font-size:11.5px;font-family:inherit;cursor:pointer;outline:none;transition:border-color .15s}
  .date-inp:focus{border-color:rgba(0,0,0,0.18)}
  .date-inp::-webkit-calendar-picker-indicator{cursor:pointer}

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
    margin-bottom:16px;
  }

  .range-pill{padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s ease}

  .sk{background:linear-gradient(90deg,var(--skeleton-from) 25%,var(--skeleton-to) 50%,var(--skeleton-from) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px}

  .ch-row{transition:background .15s;border-radius:6px;padding:8px 4px}
  .ch-row:hover{background:#FAFAFA}
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
  return <div style={{ width:size, height:size, border:`2px solid rgba(0,0,0,0.08)`, borderTop:`2px solid #111111`, borderRadius:'50%', animation:'spin .7s linear infinite', flexShrink:0 }}/>
}

// ─── Date ranges ──────────────────────────────────────────────────────────────
const RANGES = [
  { id:'7d',     label:'7D'         },
  { id:'30d',    label:'30D'        },
  { id:'month',  label:'This month' },
  { id:'3month', label:'3 months'   },
  { id:'custom', label:'Custom'     },
]

function getDateRange(id) {
  const today=new Date(), pad=n=>String(n).padStart(2,'0'), fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, to=fmt(today)
  if(id==='7d')    { const f=new Date(today); f.setDate(f.getDate()-6);   return{from:fmt(f),to} }
  if(id==='30d')   { const f=new Date(today); f.setDate(f.getDate()-29);  return{from:fmt(f),to} }
  if(id==='month') { const f=new Date(today.getFullYear(),today.getMonth(),1); return{from:fmt(f),to} }
  if(id==='3month'){ const f=new Date(today); f.setMonth(f.getMonth()-3); return{from:fmt(f),to} }
  return{from:'',to:''}
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, marginTop=24 }) {
  return (
    <div style={{ textAlign:'center', margin:`${marginTop}px 0 16px`, animation:'fadeIn .3s ease-out both' }}>
      <span style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:'#BDBDBD', textTransform:'uppercase' }}>{title}</span>
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
    { label:'CREATED', value:fmtNum(aCreated), sub:'new tickets this period',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { label:'CLOSED', value:fmtNum(aClosed), sub:closeRate?`${closeRate}% close rate`:'resolved this period',
      badge:closeRate?{value:`${closeRate}%`}:null,
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
    { label:'OPEN', value:fmtNum(aOpen), sub:'currently awaiting reply',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'MESSAGES', value:fmtNum(aMessages), sub:'total messages received',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  ]

  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
      {[0,1,2,3].map(i=><div key={i} className="kpi-card"><div className="sk" style={{ height:11, width:'55%', marginBottom:14 }}/><div className="sk" style={{ height:30, width:'65%', marginBottom:8 }}/><div className="sk" style={{ height:9, width:'80%' }}/></div>)}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
      {cards.map(c=>(
        <div key={c.label} className="kpi-card" style={{ animation:'fadeIn .3s ease-out both' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{c.icon}</div>
            {c.badge&&<span style={{ fontSize:11, fontWeight:600, color:'#16A34A', background:'#F0FDF4', borderRadius:4, padding:'2px 7px', letterSpacing:'.02em', fontVariantNumeric:'tabular-nums' }}>{c.badge.value}</span>}
          </div>
          <div style={{ fontSize:28, fontWeight:700, color:'#111111', lineHeight:1, marginBottom:8, fontVariantNumeric:'tabular-nums' }}>{c.value}</div>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em', color:'#BDBDBD', textTransform:'uppercase', marginBottom:4 }}>{c.label}</div>
          <div style={{ fontSize:12, color:'#888888', lineHeight:1.4 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Weekly chart ─────────────────────────────────────────────────────────────
function WeeklyChart({ weekly, loaded }) {
  const [hovIdx, setHovIdx] = useState(null)

  if (!loaded) return (
    <div className="panel">
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
    <div className="panel" style={{ animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#111111', marginBottom:3 }}>Weekly ticket volume</div>
          <div style={{ fontSize:11, color:'#888888' }}>Created vs closed per week</div>
        </div>
        <div style={{ display:'flex', gap:16 }}>
          {[['#111111','Created'],['#E0E0E0','Closed']].map(([color,label])=>(
            <span key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#555555' }}>
              <span style={{ width:10, height:10, borderRadius:2, background:color, display:'inline-block', flexShrink:0 }}/>{label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <svg width={totalW} height={PAD_TOP+BAR_H+PAD_BOT} style={{ display:'block', minWidth:'100%', overflow:'visible' }}>
          {[.25,.5,.75,1].map(p=>{ const y=PAD_TOP+BAR_H-p*BAR_H; return <line key={p} x1={0} y1={y} x2={totalW} y2={y} stroke="rgba(0,0,0,0.05)" strokeWidth={1} strokeDasharray={p===1?'0':'3 4'}/> })}
          {weekly.map((w,i)=>{
            const x=i*colW+9, isHov=hovIdx===i
            return (
              <g key={i} onMouseEnter={()=>setHovIdx(i)} onMouseLeave={()=>setHovIdx(null)} style={{ cursor:'default' }}>
                <rect x={x-4} y={PAD_TOP} width={barW*2+barGap+8} height={BAR_H} fill="transparent"/>
                <rect x={x} y={barY(w.created)} width={barW} height={Math.max(barH(w.created),2)} rx={3} fill={isHov?'#111111':'rgba(17,17,17,0.7)'} style={{ transition:'fill .15s' }}/>
                <rect x={x+barW+barGap} y={barY(w.closed)} width={barW} height={Math.max(barH(w.closed),2)} rx={3} fill={isHov?'#BDBDBD':'#E0E0E0'} style={{ transition:'fill .15s' }}/>
                {isHov&&(
                  <g>
                    <rect x={x-6} y={PAD_TOP-40} width={66} height={34} rx={6} fill="rgba(17,17,17,0.92)" stroke="rgba(255,255,255,0.1)" strokeWidth={1}/>
                    <text x={x+27} y={PAD_TOP-26} textAnchor="middle" fill="#ffffff" fontSize={10} fontWeight="700">{w.created} created</text>
                    <text x={x+27} y={PAD_TOP-13} textAnchor="middle" fill="#BDBDBD" fontSize={10}>{w.closed} closed</text>
                  </g>
                )}
                <text x={x+barW+barGap/2} y={PAD_TOP+BAR_H+16} textAnchor="middle" fill="#BDBDBD" fontSize={9} fontFamily="sans-serif">{w.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── Response Times ───────────────────────────────────────────────────────────
function getRTLabel(mins, thresholds) {
  if (mins==null) return null
  if (mins<thresholds[0]) return { label:'Excellent', color:'#16A34A', bg:'#F0FDF4', border:'rgba(22,163,74,0.15)' }
  if (mins<thresholds[1]) return { label:'Average',   color:'#D97706', bg:'#FFFBEB', border:'rgba(215,163,6,0.15)' }
  return                          { label:'Slow',      color:'#DC2626', bg:'#FEF2F2', border:'rgba(220,38,38,0.15)' }
}

function ResponseTimesSection({ data, loaded }) {
  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
      {[0,1].map(i=><div key={i} className="kpi-card"><div className="sk" style={{ height:11, width:'45%', marginBottom:20 }}/><div className="sk" style={{ height:36, width:'48%', marginBottom:10 }}/><div className="sk" style={{ height:1, marginBottom:14 }}/><div className="sk" style={{ height:9, width:'60%' }}/></div>)}
    </div>
  )

  const cards = [
    { label:'FIRST RESPONSE TIME', value:fmtMinutes(data.avgFirstResponse),
      sub:data.firstResponseSample?`Avg across ${data.firstResponseSample} tickets`:'No tickets with response data yet',
      benchmark:'< 4h target', rtLabel:getRTLabel(data.avgFirstResponse,[240,720]),
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'RESOLUTION TIME', value:fmtMinutes(data.avgResolution),
      sub:data.resolutionSample?`Avg across ${data.resolutionSample} closed tickets`:'No closed tickets in this range',
      benchmark:'< 24h target', rtLabel:getRTLabel(data.avgResolution,[1440,4320]),
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16, animation:'fadeIn .3s ease-out both' }}>
      {cards.map(c=>(
        <div key={c.label} className="kpi-card" style={{ padding:'16px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{c.icon}</div>
            {c.rtLabel&&<span style={{ fontSize:10, fontWeight:600, color:c.rtLabel.color, background:c.rtLabel.bg, border:`1px solid ${c.rtLabel.border}`, borderRadius:4, padding:'2px 8px' }}>{c.rtLabel.label}</span>}
          </div>
          <div style={{ fontSize:28, fontWeight:700, color:'#111111', lineHeight:1, marginBottom:8, fontVariantNumeric:'tabular-nums' }}>{c.value||'—'}</div>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em', color:'#BDBDBD', textTransform:'uppercase', marginBottom:14 }}>{c.label}</div>
          <div style={{ height:1, background:'rgba(0,0,0,0.06)', marginBottom:12 }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <div style={{ fontSize:12, color:'#888888', lineHeight:1.4 }}>{c.sub}</div>
            <span style={{ fontSize:11, color:'#888888', background:'#F5F5F5', borderRadius:4, padding:'2px 8px', flexShrink:0, whiteSpace:'nowrap' }}>{c.benchmark}</span>
          </div>
        </div>
      ))}
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
    { label:'TICKETS REPLIED', value:fmtNum(aReplied), sub:'agents sent at least 1 reply',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg> },
    { label:'MESSAGES SENT', value:fmtNum(aSent), sub:'outbound agent messages',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
    { label:'ONE-TOUCH', value:`${aOT.toFixed(1)}%`, sub:`${fmtNum(aOTN)} tickets closed in one reply`,
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> },
    { label:'AVG MESSAGES', value:data.avgMessages||'—', sub:'per ticket on average',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg> },
  ]

  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
      {[0,1,2,3].map(i=><div key={i} className="kpi-card"><div className="sk" style={{ height:11, width:'55%', marginBottom:14 }}/><div className="sk" style={{ height:30, width:'65%', marginBottom:8 }}/><div className="sk" style={{ height:9, width:'80%' }}/></div>)}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
      {cards.map(c=>(
        <div key={c.label} className="kpi-card" style={{ animation:'fadeIn .3s ease-out both' }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center' }}>{c.icon}</div>
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:'#111111', lineHeight:1, marginBottom:8, fontVariantNumeric:'tabular-nums' }}>{c.value}</div>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em', color:'#BDBDBD', textTransform:'uppercase', marginBottom:4 }}>{c.label}</div>
          <div style={{ fontSize:12, color:'#888888', lineHeight:1.4 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Channel breakdown ────────────────────────────────────────────────────────
const CH_COLORS = {
  email:          '#111111',
  chat:           '#555555',
  'contact form': '#888888',
  sms:            '#BDBDBD',
  api:            '#BDBDBD',
  voice:          '#BDBDBD',
}

function ChannelBreakdown({ channels, loaded }) {
  if (!loaded) return (
    <div className="panel">
      <div className="sk" style={{ height:13, width:'25%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'18%', marginBottom:18 }}/>
      <div className="sk" style={{ height:6, borderRadius:3, marginBottom:20 }}/>
      {[0,1,2].map(i=><div key={i} style={{ marginBottom:12 }}><div style={{ display:'flex', gap:10, marginBottom:7 }}><div className="sk" style={{ width:70, height:11 }}/><div className="sk" style={{ flex:1, height:11 }}/><div className="sk" style={{ width:28, height:11 }}/></div><div className="sk" style={{ height:6, borderRadius:3 }}/></div>)}
    </div>
  )
  if (!channels||channels.length===0) return null
  const total = channels.reduce((s,c)=>s+c.count, 0)

  return (
    <div className="panel" style={{ animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#111111', marginBottom:3 }}>Tickets by channel</div>
          <div style={{ fontSize:11, color:'#888888' }}>{total.toLocaleString()} tickets · this period</div>
        </div>
      </div>
      {/* Combined bar */}
      <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden', marginBottom:22, gap:1.5 }}>
        {channels.map(ch=>{ const color=CH_COLORS[ch.name.toLowerCase()]||'#BDBDBD'; return <div key={ch.name} style={{ flex:ch.pct, background:color, minWidth:2 }}/> })}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {channels.map((ch,i)=>{
          const color=CH_COLORS[ch.name.toLowerCase()]||'#BDBDBD'
          return (
            <div key={ch.name} className="ch-row" style={{ animation:`fadeIn .3s ease-out ${i*60}ms both` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, paddingLeft:2, paddingRight:2 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
                  <span style={{ fontSize:13, color:'#111111' }}>{ch.name}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:12, color:'#888888', fontVariantNumeric:'tabular-nums' }}>{ch.count.toLocaleString()}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#111111', minWidth:36, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{ch.pct}%</span>
                </div>
              </div>
              <div style={{ height:6, borderRadius:3, background:'#F5F5F5', overflow:'hidden', marginLeft:2, marginRight:2 }}>
                <div style={{ height:'100%', borderRadius:3, background:color, width:`${ch.pct}%`, transition:'width .9s cubic-bezier(0.34,1.56,0.64,1)' }}/>
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
    <div className="pf-root" style={{ display:'flex', minHeight:'100vh', background:'#FAFAFA' }}>
      <style>{CSS}</style>
      <Sidebar/>

      <main className="pf-scroll" style={{ flex:1, overflowY:'auto', padding:'24px', position:'relative' }}>
        <div style={{ position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom:24, animation:'fadeIn .5s ease-out both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h1 style={{ fontSize:20, fontWeight:700, color:'#111111', lineHeight:1.2, marginBottom:4 }}>Performance</h1>
                <p style={{ fontSize:12, color:'#888888' }}>Customer support metrics · Gorgias</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {demoMode&&(
                  <span style={{ fontSize:10, fontWeight:700, background:'#F5F5F5', color:'#555555', border:'1px solid rgba(0,0,0,0.08)', borderRadius:4, padding:'2px 7px', letterSpacing:'.05em', textTransform:'uppercase' }}>DEMO</span>
                )}
                {demoMode
                  ? <button onClick={exitDemo} style={{ padding:'5px 12px', borderRadius:7, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.09)', color:'#555555', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Exit Demo</button>
                  : <button onClick={loadDemo} style={{ padding:'5px 12px', borderRadius:7, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.09)', color:'#555555', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Preview Demo</button>
                }
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:7, background:allLoaded&&!demoMode&&gorgiasOk?'#F0FDF4':'#F5F5F5', border:allLoaded&&!demoMode&&gorgiasOk?'1px solid rgba(22,163,74,0.15)':'1px solid rgba(0,0,0,0.08)' }}>
                  {!allLoaded?<Spinner size={12}/>:<div style={{ width:6, height:6, borderRadius:'50%', background:demoMode?'#F59E0B':gorgiasOk?'#16A34A':'#DC2626', flexShrink:0 }}/>}
                  <span style={{ fontSize:11, fontWeight:600, color:allLoaded&&!demoMode&&gorgiasOk?'#15803D':'#555555' }}>{!allLoaded?'Loading…':demoMode?'Demo':gorgiasOk?'Live':'Disconnected'}</span>
                </div>
              </div>
            </div>
            <div style={{ height:'1px', background:'rgba(0,0,0,0.06)', margin:'16px 0 12px' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              {RANGES.map(r=>(
                <button key={r.id} onClick={()=>selectRange(r.id)} className="range-pill" style={{ background:dateRange===r.id?'#111111':'transparent', color:dateRange===r.id?'#ffffff':'#888888', border:dateRange===r.id?'none':'1px solid rgba(0,0,0,0.08)' }}>{r.label}</button>
              ))}
              {dateRange==='custom'&&(
                <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:4 }}>
                  <input type="date" className="date-inp" value={customFrom} max={customTo||undefined} onChange={e=>{ setCustomFrom(e.target.value); applyCustomRange(e.target.value,customTo) }}/>
                  <span style={{ fontSize:11, color:'#888888' }}>→</span>
                  <input type="date" className="date-inp" value={customTo} min={customFrom||undefined} max={new Date().toISOString().slice(0,10)} onChange={e=>{ setCustomTo(e.target.value); applyCustomRange(customFrom,e.target.value) }}/>
                </div>
              )}
            </div>
          </div>

          {/* Demo banner */}
          {demoMode&&(
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#FAFAFA', border:'1px solid rgba(0,0,0,0.07)', borderRadius:6, padding:'8px 14px', marginBottom:16, animation:'fadeIn .4s ease-out both' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:12, fontWeight:600, color:'#555555', marginRight:6 }}>Demo mode</span>
                <span style={{ fontSize:12, color:'#888888' }}>Showing example data — connect Gorgias in Settings to see live metrics.</span>
              </div>
              <button onClick={exitDemo} style={{ fontSize:12, fontWeight:600, color:'#555555', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Exit demo →</button>
            </div>
          )}

          {/* Gorgias not connected */}
          {!demoMode&&allLoaded&&!gorgiasOk&&(
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#FAFAFA', border:'1px solid rgba(0,0,0,0.07)', borderRadius:6, padding:'8px 14px', marginBottom:16, animation:'fadeIn .4s ease-out both' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, fontWeight:600, color:'#555555', marginRight:6 }}>Gorgias not connected</span><span style={{ fontSize:12, color:'#888888' }}>Go to Settings → Integrations to connect your Gorgias account.</span></div>
              <button onClick={loadDemo} style={{ fontSize:12, fontWeight:600, color:'#555555', background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Preview demo</button>
            </div>
          )}

          <SectionHeader title="Workload"/>
          <WorkloadKPIs data={workload} loaded={loaded.workload}/>
          <WeeklyChart  weekly={workload.weekly} loaded={loaded.workload}/>

          <SectionHeader title="Response Times"/>
          <ResponseTimesSection data={responseTimes} loaded={loaded.responseTimes}/>

          <SectionHeader title="Productivity"/>
          <ProductivityKPIs data={productivity} loaded={loaded.productivity}/>
          <ChannelBreakdown channels={productivity.channels} loaded={loaded.productivity}/>

          <div style={{ marginTop:16, textAlign:'center', fontSize:10.5, color:'#BDBDBD', letterSpacing:'.04em' }}>
            Lynq Analytics · Gorgias data · Refreshed on load
          </div>
        </div>
      </main>
    </div>
  )
}
