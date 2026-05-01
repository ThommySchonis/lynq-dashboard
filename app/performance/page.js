'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
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
  @keyframes shimmer{from{background-position:-400% 0}to{background-position:400% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn1{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn2{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn3{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn4{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  }

  .pf-root *{box-sizing:border-box;margin:0;padding:0}
  .pf-root{font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased}
  .pf-scroll::-webkit-scrollbar{width:3px}
  .pf-scroll::-webkit-scrollbar-track{background:transparent}
  .pf-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:2px}

  .date-inp{background:#F5F5F5;border:1px solid rgba(0,0,0,0.08);border-radius:7px;color:#0F0F10;padding:4px 10px;font-size:11.5px;font-family:'Switzer',sans-serif;cursor:pointer;outline:none;transition:border-color .15s}
  .date-inp:focus{border-color:rgba(0,0,0,0.18)}
  .date-inp::-webkit-calendar-picker-indicator{cursor:pointer}

  .kpi-card{
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:10px;
    padding:18px 20px;
    position:relative;overflow:hidden;
    transition:border-color 0.15s ease;
    cursor:default;
  }
  .kpi-card:hover{border-color:rgba(0,0,0,0.12)}

  .metric-card{
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:10px;
    padding:18px 20px;
    position:relative;overflow:hidden;
    transition:border-color 0.15s ease, box-shadow 0.15s ease;
    cursor:default;
  }
  .metric-card:hover{border-color:rgba(0,0,0,0.12)}
  .metric-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--metric-gradient,linear-gradient(90deg,#6366F1,#8B5CF6))}

  .animate-fade-in{animation:fadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both}
  .animate-fade-in-1{animation:fadeIn1 0.4s cubic-bezier(0.16,1,0.3,1) 0.00s both}
  .animate-fade-in-2{animation:fadeIn2 0.4s cubic-bezier(0.16,1,0.3,1) 0.08s both}
  .animate-fade-in-3{animation:fadeIn3 0.4s cubic-bezier(0.16,1,0.3,1) 0.16s both}
  .animate-fade-in-4{animation:fadeIn4 0.4s cubic-bezier(0.16,1,0.3,1) 0.24s both}

  .panel{
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:10px;
    padding:20px;
    margin-bottom:12px;
  }

  .section-divider{
    display:flex;align-items:center;gap:12px;
    padding:20px 0 12px;
  }
  .section-divider::before,.section-divider::after{
    content:'';flex:1;height:1px;background:rgba(0,0,0,0.06);
  }

  .filter-pill-bar{
    display:inline-flex;gap:2px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:3px;
  }

  .filter-pill{
    padding:4px 12px;border-radius:6px;
    font-size:12px;font-weight:600;
    cursor:pointer;font-family:'Switzer',sans-serif;
    border:none;outline:none;
    transition:all .15s ease;
    background:transparent;color:#6B7280;
  }
  .filter-pill.active{background:#111111;color:#FFFFFF}

  .sk{background:linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px}

  .ch-row{transition:background .15s;border-radius:6px;padding:8px 4px}
  .ch-row:hover{background:#F9F8FF}
`

// ─── useCountUp ───────────────────────────────────────────────────────────────
function useCountUp(end, duration = 1200) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!end || end === 0) { setCount(0); return }
    let start = 0
    const step = end / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [end])
  return count
}

// ─── AnimatedNumber ───────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let start = 0
    const end = parseFloat(String(value).replace(/[^0-9.]/g, ''))
    if (isNaN(end) || end === 0) { setDisplay(0); return }
    const duration = 1200
    const step = end / (duration / 16)

    const timer = setInterval(() => {
      start += step
      if (start >= end) {
        setDisplay(end)
        clearInterval(timer)
      } else {
        setDisplay(start)
      }
    }, 16)

    return () => clearInterval(timer)
  }, [value])

  const formatted = suffix === '%' || decimals > 0
    ? display.toFixed(decimals || 1)
    : Math.round(display).toLocaleString()

  return <span>{formatted}{suffix}</span>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n) { return Math.round(n).toLocaleString('en-US') }

function fmtMinutes(mins) {
  if (mins == null) return null
  if (mins < 60) return `${Math.round(mins)}m`
  if (mins < 24*60) { const h=Math.floor(mins/60),m=Math.round(mins%60); return m>0?`${h}h ${m}m`:`${h}h` }
  const d=Math.floor(mins/(24*60)),h=Math.round((mins%(24*60))/60)
  return h>0?`${d}d ${h}h`:`${d}d`
}

function Spinner({ size=18 }) {
  return <div style={{ width:size, height:size, border:`2px solid rgba(0,0,0,0.08)`, borderTop:`2px solid #0F0F10`, borderRadius:'50%', animation:'spin .7s linear infinite', flexShrink:0 }}/>
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

// ─── Section divider ──────────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <div className="section-divider">
      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', color:'#9CA3AF', textTransform:'uppercase', whiteSpace:'nowrap' }}>{title}</span>
    </div>
  )
}

// ─── Workload KPIs ────────────────────────────────────────────────────────────
function WorkloadKPIs({ data, loaded }) {
  const closeRate = data.created>0 ? ((data.closed/data.created)*100).toFixed(0) : null

  const cards = [
    {
      label:'CREATED', sub:'new tickets this period',
      topGradient:'linear-gradient(90deg, #6366F1, #8B5CF6)',
      iconBg:'rgba(99,102,241,0.08)', iconColor:'#6366F1',
      valueNode: <AnimatedNumber value={data.created||0} />,
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    },
    {
      label:'CLOSED', sub:closeRate?`${closeRate}% close rate`:'resolved this period',
      badge:closeRate?{value:`${closeRate}%`}:null,
      topGradient:'linear-gradient(90deg, #10B981, #34D399)',
      iconBg:'rgba(16,185,129,0.08)', iconColor:'#10B981',
      valueNode: <AnimatedNumber value={data.closed||0} />,
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    },
    {
      label:'OPEN', sub:'currently awaiting reply',
      topGradient:'linear-gradient(90deg, #F59E0B, #FCD34D)',
      iconBg:'rgba(245,158,11,0.08)', iconColor:'#F59E0B',
      valueNode: <AnimatedNumber value={data.open||0} />,
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      label:'MESSAGES', sub:'total messages received',
      topGradient:'linear-gradient(90deg, #3B82F6, #60A5FA)',
      iconBg:'rgba(59,130,246,0.08)', iconColor:'#3B82F6',
      valueNode: <AnimatedNumber value={data.messagesReceived||0} />,
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    },
  ]

  const WORKLOAD_GRADIENTS = [
    'linear-gradient(90deg, #6366F1, #8B5CF6)',
    'linear-gradient(90deg, #10B981, #34D399)',
    'linear-gradient(90deg, #F59E0B, #FCD34D)',
    'linear-gradient(90deg, #3B82F6, #60A5FA)',
  ]

  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
      {[0,1,2,3].map(i=>(
        <div key={i} className={`metric-card animate-fade-in-${i+1}`} style={{ '--metric-gradient': WORKLOAD_GRADIENTS[i] }}>
          <div className="sk" style={{ height:11, width:'55%', marginBottom:14, marginTop:4 }}/>
          <div className="sk" style={{ height:28, width:'65%', marginBottom:8 }}/>
          <div className="sk" style={{ height:9, width:'80%' }}/>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
      {cards.map((c, index) => (
        <motion.div
          key={c.label}
          className={`metric-card animate-fade-in-${index+1}`}
          style={{ '--metric-gradient': c.topGradient }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', transition: { duration: 0.15, ease: 'easeOut' } }}
        >
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14, marginTop:4 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:c.iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{c.icon(c.iconColor)}</div>
            {c.badge&&<span style={{ fontSize:11, fontWeight:600, color:'#059669', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:5, padding:'2px 7px', fontVariantNumeric:'tabular-nums' }}>{c.badge.value}</span>}
          </div>
          <div style={{ fontSize:26, fontWeight:700, color:'#0F0F10', lineHeight:1, marginBottom:6, letterSpacing:'-0.025em', fontVariantNumeric:'tabular-nums' }}>{c.valueNode}</div>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em', color:'#9CA3AF', textTransform:'uppercase', marginBottom:2 }}>{c.label}</div>
          <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.4 }}>{c.sub}</div>
        </motion.div>
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
    <div className="panel">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'#0F0F10', marginBottom:3 }}>Weekly ticket volume</div>
          <div style={{ fontSize:12, color:'#6B7280' }}>Created vs closed per week</div>
        </div>
        <div style={{ display:'flex', gap:16 }}>
          {[['#6366F1','Created','#374151'],['rgba(99,102,241,0.3)','Closed','#9CA3AF']].map(([color,label,textColor])=>(
            <span key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:textColor }}>
              <span style={{ width:10, height:10, borderRadius:2, background:color, display:'inline-block', flexShrink:0 }}/>{label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <svg width={totalW} height={PAD_TOP+BAR_H+PAD_BOT} style={{ display:'block', minWidth:'100%', overflow:'visible' }}>
          {[.25,.5,.75,1].map(p=>{ const y=PAD_TOP+BAR_H-p*BAR_H; return <line key={p} x1={0} y1={y} x2={totalW} y2={y} stroke="rgba(0,0,0,0.04)" strokeWidth={1} strokeDasharray={p===1?'0':'3 4'}/> })}
          {weekly.map((w,i)=>{
            const x=i*colW+9, isHov=hovIdx===i
            return (
              <g key={i} onMouseEnter={()=>setHovIdx(i)} onMouseLeave={()=>setHovIdx(null)} style={{ cursor:'default' }}>
                <rect x={x-4} y={PAD_TOP} width={barW*2+barGap+8} height={BAR_H} fill="transparent"/>
                <rect x={x} y={barY(w.created)} width={barW} height={Math.max(barH(w.created),2)} rx={3} fill={isHov?'#4F46E5':'#6366F1'} style={{ transition:'fill .15s' }}/>
                <rect x={x+barW+barGap} y={barY(w.closed)} width={barW} height={Math.max(barH(w.closed),2)} rx={3} fill={isHov?'rgba(99,102,241,0.40)':'rgba(99,102,241,0.25)'} style={{ transition:'fill .15s' }}/>
                {isHov&&(
                  <g>
                    <rect x={x-6} y={PAD_TOP-40} width={66} height={34} rx={6} fill="rgba(17,17,17,0.92)" stroke="rgba(255,255,255,0.1)" strokeWidth={1}/>
                    <text x={x+27} y={PAD_TOP-26} textAnchor="middle" fill="#ffffff" fontSize={10} fontWeight="700">{w.created} created</text>
                    <text x={x+27} y={PAD_TOP-13} textAnchor="middle" fill="#9CA3AF" fontSize={10}>{w.closed} closed</text>
                  </g>
                )}
                <text x={x+barW+barGap/2} y={PAD_TOP+BAR_H+16} textAnchor="middle" fill="#9CA3AF" fontSize={9} fontFamily="'Switzer', sans-serif">{w.label}</text>
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
  if (mins<thresholds[0]) return { label:'Excellent', color:'#059669', bg:'rgba(16,185,129,0.08)',  border:'rgba(16,185,129,0.15)' }
  if (mins<thresholds[1]) return { label:'Average',   color:'#D97706', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.15)' }
  return                          { label:'Slow',      color:'#DC2626', bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.15)' }
}

function ResponseTimesSection({ data, loaded }) {
  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
      {[
        { grad:'linear-gradient(90deg, #F59E0B, #FCD34D)' },
        { grad:'linear-gradient(90deg, #EF4444, #F87171)' },
      ].map((item,i)=>(
        <div key={i} className="metric-card" style={{ padding:20, '--metric-gradient': item.grad }}>
          <div className="sk" style={{ height:11, width:'45%', marginBottom:20, marginTop:4 }}/>
          <div className="sk" style={{ height:36, width:'48%', marginBottom:10 }}/>
          <div className="sk" style={{ height:1, marginBottom:14 }}/>
          <div className="sk" style={{ height:9, width:'60%' }}/>
        </div>
      ))}
    </div>
  )

  const cards = [
    {
      label:'FIRST RESPONSE TIME', value:fmtMinutes(data.avgFirstResponse),
      sub:data.firstResponseSample?`Avg across ${data.firstResponseSample} tickets`:'No tickets with response data yet',
      benchmark:'< 4h target', rtLabel:getRTLabel(data.avgFirstResponse,[240,720]),
      topGradient:'linear-gradient(90deg, #F59E0B, #FCD34D)',
      iconBg:'rgba(245,158,11,0.08)', iconColor:'#F59E0B',
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      label:'RESOLUTION TIME', value:fmtMinutes(data.avgResolution),
      sub:data.resolutionSample?`Avg across ${data.resolutionSample} closed tickets`:'No closed tickets in this range',
      benchmark:'< 24h target', rtLabel:getRTLabel(data.avgResolution,[1440,4320]),
      topGradient:'linear-gradient(90deg, #EF4444, #F87171)',
      iconBg:'rgba(239,68,68,0.08)', iconColor:'#EF4444',
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
      {cards.map((c, index) => (
        <motion.div
          key={c.label}
          className="metric-card"
          style={{ padding:20, '--metric-gradient': c.topGradient }}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', transition: { duration: 0.15, ease: 'easeOut' } }}
        >
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14, marginTop:4 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:c.iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{c.icon(c.iconColor)}</div>
            {c.rtLabel&&<span style={{ fontSize:10, fontWeight:700, color:c.rtLabel.color, background:c.rtLabel.bg, border:`1px solid ${c.rtLabel.border}`, borderRadius:5, padding:'2px 8px' }}>{c.rtLabel.label}</span>}
          </div>
          <div style={{ fontSize:28, fontWeight:700, color:'#0F0F10', lineHeight:1, marginBottom:8, letterSpacing:'-0.025em', fontVariantNumeric:'tabular-nums' }}>{c.value||'—'}</div>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em', color:'#9CA3AF', textTransform:'uppercase', marginBottom:14 }}>{c.label}</div>
          <div style={{ height:1, background:'rgba(0,0,0,0.06)', marginBottom:12 }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.4 }}>{c.sub}</div>
            <span style={{ fontSize:11, color:'#6B7280', background:'#F3F4F6', borderRadius:4, padding:'2px 8px', flexShrink:0, whiteSpace:'nowrap' }}>{c.benchmark}</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Productivity KPIs ────────────────────────────────────────────────────────
function ProductivityKPIs({ data, loaded }) {
  const oneTouchCount = data.oneTouchCount||0

  const cards = [
    {
      label:'TICKETS REPLIED', sub:'agents sent at least 1 reply',
      topGradient:'linear-gradient(90deg, #8B5CF6, #A78BFA)',
      iconBg:'rgba(139,92,246,0.08)', iconColor:'#8B5CF6',
      valueNode: <AnimatedNumber value={data.ticketsReplied||0} />,
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>,
    },
    {
      label:'MESSAGES SENT', sub:'outbound agent messages',
      topGradient:'linear-gradient(90deg, #3B82F6, #60A5FA)',
      iconBg:'rgba(59,130,246,0.08)', iconColor:'#3B82F6',
      valueNode: <AnimatedNumber value={data.messagesSent||0} />,
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    },
    {
      label:'ONE-TOUCH', sub:`${fmtNum(oneTouchCount)} tickets closed in one reply`,
      topGradient:'linear-gradient(90deg, #10B981, #34D399)',
      iconBg:'rgba(16,185,129,0.08)', iconColor:'#10B981',
      valueNode: <AnimatedNumber value={parseFloat(data.oneTouchPct||0)} suffix="%" />,
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
    },
    {
      label:'AVG MESSAGES', sub:'per ticket on average',
      topGradient:'linear-gradient(90deg, #F59E0B, #FCD34D)',
      iconBg:'rgba(245,158,11,0.08)', iconColor:'#F59E0B',
      valueNode: <AnimatedNumber value={parseFloat(data.avgMessages||0)} decimals={1} />,
      icon: c => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg>,
    },
  ]

  const PROD_GRADIENTS = [
    'linear-gradient(90deg, #8B5CF6, #A78BFA)',
    'linear-gradient(90deg, #3B82F6, #60A5FA)',
    'linear-gradient(90deg, #10B981, #34D399)',
    'linear-gradient(90deg, #F59E0B, #FCD34D)',
  ]

  if (!loaded) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
      {[0,1,2,3].map(i=>(
        <div key={i} className={`metric-card animate-fade-in-${i+1}`} style={{ '--metric-gradient': PROD_GRADIENTS[i] }}>
          <div className="sk" style={{ height:11, width:'55%', marginBottom:14, marginTop:4 }}/>
          <div className="sk" style={{ height:28, width:'65%', marginBottom:8 }}/>
          <div className="sk" style={{ height:9, width:'80%' }}/>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
      {cards.map((c, index) => (
        <motion.div
          key={c.label}
          className={`metric-card animate-fade-in-${index+1}`}
          style={{ '--metric-gradient': c.topGradient }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', transition: { duration: 0.15, ease: 'easeOut' } }}
        >
          <div style={{ marginBottom:14, marginTop:4 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:c.iconBg, display:'flex', alignItems:'center', justifyContent:'center' }}>{c.icon(c.iconColor)}</div>
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:'#0F0F10', lineHeight:1, marginBottom:6, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums' }}>{c.valueNode}</div>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em', color:'#9CA3AF', textTransform:'uppercase', marginBottom:4 }}>{c.label}</div>
          <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.4 }}>{c.sub}</div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Channel breakdown ────────────────────────────────────────────────────────
const CH_COLORS = {
  email:          '#6366F1',
  chat:           '#10B981',
  'contact form': '#F59E0B',
  sms:            '#9CA3AF',
  api:            '#9CA3AF',
  voice:          '#9CA3AF',
}

function ChannelBreakdown({ channels, loaded }) {
  const [barMounted, setBarMounted] = useState(false)

  useEffect(() => {
    if (loaded && channels && channels.length > 0) {
      const t = setTimeout(() => setBarMounted(true), 80)
      return () => clearTimeout(t)
    }
  }, [loaded, channels])

  if (!loaded) return (
    <div className="panel">
      <div className="sk" style={{ height:13, width:'25%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'18%', marginBottom:18 }}/>
      <div className="sk" style={{ height:8, borderRadius:6, marginBottom:20 }}/>
      {[0,1,2].map(i=><div key={i} style={{ marginBottom:12 }}><div style={{ display:'flex', gap:10, marginBottom:7 }}><div className="sk" style={{ width:70, height:11 }}/><div className="sk" style={{ flex:1, height:11 }}/><div className="sk" style={{ width:28, height:11 }}/></div><div className="sk" style={{ height:6, borderRadius:10 }}/></div>)}
    </div>
  )
  if (!channels||channels.length===0) return null
  const total = channels.reduce((s,c)=>s+c.count, 0)

  return (
    <div className="panel">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'#0F0F10', marginBottom:3 }}>Tickets by channel</div>
          <div style={{ fontSize:12, color:'#6B7280' }}>{total.toLocaleString()} tickets · this period</div>
        </div>
      </div>
      <div style={{ display:'flex', height:8, borderRadius:6, overflow:'hidden', marginBottom:22, gap:2 }}>
        {channels.map(ch=>{ const color=CH_COLORS[ch.name.toLowerCase()]||'#9CA3AF'; return <div key={ch.name} style={{ flex:ch.pct, background:color, minWidth:2 }}/> })}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {channels.map((ch, i)=>{
          const color=CH_COLORS[ch.name.toLowerCase()]||'#9CA3AF'
          return (
            <motion.div
              key={ch.name}
              className="ch-row"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, paddingLeft:2, paddingRight:2 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }}/>
                  <span style={{ fontSize:13, fontWeight:500, color:'#374151' }}>{ch.name}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:12, color:'#6B7280', fontVariantNumeric:'tabular-nums' }}>{ch.count.toLocaleString()}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#0F0F10', minWidth:36, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{ch.pct}%</span>
                </div>
              </div>
              <div style={{ height:6, borderRadius:10, background:'#F3F4F6', overflow:'hidden', marginLeft:2, marginRight:2 }}>
                <div style={{ height:'100%', borderRadius:10, background:color, width: barMounted ? `${ch.pct}%` : '0%', transition:'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }}/>
              </div>
            </motion.div>
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
    <div className="pf-root" style={{ display:'flex', minHeight:'100vh', background:'#F9F8FF' }}>
      <style>{CSS}</style>
      <Sidebar/>

      <main className="pf-scroll" style={{ flex:1, overflowY:'auto', padding:'24px', position:'relative' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto' }}
        >

          {/* Header */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h1 className="animate-fade-in" style={{ fontSize:20, fontWeight:700, color:'#0F0F10', lineHeight:1.2, marginBottom:4, letterSpacing:'-0.02em' }}>Performance</h1>
                <p style={{ fontSize:13, color:'#6B7280' }}>Customer support metrics · Gorgias</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {demoMode&&(
                  <span style={{ fontSize:10, fontWeight:700, background:'#F5F5F5', color:'#6B7280', border:'1px solid rgba(0,0,0,0.08)', borderRadius:4, padding:'2px 7px', letterSpacing:'.05em', textTransform:'uppercase' }}>DEMO</span>
                )}
                {demoMode
                  ? <button onClick={exitDemo} style={{ padding:'5px 12px', borderRadius:7, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.09)', color:'#6B7280', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Switzer', sans-serif" }}>Exit Demo</button>
                  : <button onClick={loadDemo} style={{ padding:'5px 12px', borderRadius:7, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.09)', color:'#6B7280', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Switzer', sans-serif" }}>Preview Demo</button>
                }
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:7, background:allLoaded&&!demoMode&&gorgiasOk?'rgba(16,185,129,0.06)':'#F5F5F5', border:allLoaded&&!demoMode&&gorgiasOk?'1px solid rgba(16,185,129,0.15)':'1px solid rgba(0,0,0,0.08)' }}>
                  {!allLoaded?<Spinner size={12}/>:<div style={{ width:6, height:6, borderRadius:'50%', background:demoMode?'#F59E0B':gorgiasOk?'#10B981':'#EF4444', flexShrink:0 }}/>}
                  <span style={{ fontSize:11, fontWeight:600, color:allLoaded&&!demoMode&&gorgiasOk?'#059669':'#6B7280' }}>{!allLoaded?'Loading…':demoMode?'Demo':gorgiasOk?'Live':'Disconnected'}</span>
                </div>
              </div>
            </div>
            <div style={{ height:'1px', background:'rgba(0,0,0,0.06)', margin:'16px 0 12px' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <div className="filter-pill-bar">
                {RANGES.map(r=>(
                  <button key={r.id} onClick={()=>selectRange(r.id)} className={`filter-pill${dateRange===r.id?' active':''}`}>{r.label}</button>
                ))}
              </div>
              {dateRange==='custom'&&(
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input type="date" className="date-inp" value={customFrom} max={customTo||undefined} onChange={e=>{ setCustomFrom(e.target.value); applyCustomRange(e.target.value,customTo) }}/>
                  <span style={{ fontSize:11, color:'#9CA3AF' }}>→</span>
                  <input type="date" className="date-inp" value={customTo} min={customFrom||undefined} max={new Date().toISOString().slice(0,10)} onChange={e=>{ setCustomTo(e.target.value); applyCustomRange(customFrom,e.target.value) }}/>
                </div>
              )}
            </div>
          </div>

          {/* Demo banner */}
          {demoMode&&(
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'linear-gradient(135deg, #FFFBEB, #FFFDF0)', border:'1px solid rgba(245,158,11,0.2)', borderLeft:'3px solid #F59E0B', borderRadius:8, padding:'10px 16px', marginBottom:16 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:12, fontWeight:600, color:'#92400E', marginRight:6 }}>Demo mode</span>
                <span style={{ fontSize:12, color:'#92400E' }}>Showing example data — connect Gorgias in Settings to see live metrics.</span>
              </div>
              <button onClick={exitDemo} style={{ fontSize:12, fontWeight:600, color:'#92400E', background:'transparent', border:'none', cursor:'pointer', fontFamily:"'Switzer', sans-serif", whiteSpace:'nowrap' }}>Exit demo →</button>
            </div>
          )}

          {/* Gorgias not connected */}
          {!demoMode&&allLoaded&&!gorgiasOk&&(
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#FAFAFA', border:'1px solid rgba(0,0,0,0.07)', borderRadius:8, padding:'10px 16px', marginBottom:16 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, fontWeight:600, color:'#374151', marginRight:6 }}>Gorgias not connected</span><span style={{ fontSize:12, color:'#6B7280' }}>Go to Settings → Integrations to connect your Gorgias account.</span></div>
              <button onClick={loadDemo} style={{ fontSize:12, fontWeight:600, color:'#6B7280', background:'#F3F4F6', border:'1px solid rgba(0,0,0,0.08)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontFamily:"'Switzer', sans-serif", whiteSpace:'nowrap' }}>Preview demo</button>
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

          <div style={{ marginTop:16, textAlign:'center', fontSize:10.5, color:'#9CA3AF', letterSpacing:'.04em' }}>
            Lynq Analytics · Gorgias data · Refreshed on load
          </div>
        </motion.div>
      </main>
    </div>
  )
}
