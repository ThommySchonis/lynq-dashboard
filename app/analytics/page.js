'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RANGES = [
  { id:'month',     label:'This month'   },
  { id:'7d',        label:'Last 7 days'  },
  { id:'30d',       label:'Last 30 days' },
  { id:'lastMonth', label:'Last month'   },
  { id:'custom',    label:'Custom'       },
]

function getDateRange(id) {
  const now = new Date(), today = now.toISOString().slice(0,10)
  if (id==='7d')        return { from:new Date(now-7*86400000).toISOString().slice(0,10), to:today }
  if (id==='30d')       return { from:new Date(now-30*86400000).toISOString().slice(0,10), to:today }
  if (id==='lastMonth') { const f=new Date(now.getFullYear(),now.getMonth()-1,1),l=new Date(now.getFullYear(),now.getMonth(),0); return { from:f.toISOString().slice(0,10), to:l.toISOString().slice(0,10) } }
  return { from:new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10), to:today }
}

function getPrevDateRange(id) {
  const now = new Date()
  if (id==='7d')        return { from:new Date(now-14*86400000).toISOString().slice(0,10), to:new Date(now-7*86400000).toISOString().slice(0,10) }
  if (id==='30d')       return { from:new Date(now-60*86400000).toISOString().slice(0,10), to:new Date(now-30*86400000).toISOString().slice(0,10) }
  if (id==='lastMonth') { const f=new Date(now.getFullYear(),now.getMonth()-2,1),l=new Date(now.getFullYear(),now.getMonth()-1,0); return { from:f.toISOString().slice(0,10), to:l.toISOString().slice(0,10) } }
  const f=new Date(now.getFullYear(),now.getMonth()-1,1),l=new Date(now.getFullYear(),now.getMonth(),0)
  return { from:f.toISOString().slice(0,10), to:l.toISOString().slice(0,10) }
}

function fmtEur(n) { return `€${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` }
function fmtDate(str) { if(!str)return'—'; return new Date(str).toLocaleDateString('en-US',{day:'2-digit',month:'short',year:'numeric'}) }
function fmtDateShort(d) { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}) }

function computeDelta(cur, prev) {
  const c=parseFloat(cur||0), p=parseFloat(prev||0)
  if(p===0||isNaN(c)||isNaN(p)) return null
  const pct=((c-p)/Math.abs(p))*100
  return { pct, label:`${pct>0?'+':''}${pct.toFixed(1)}%` }
}

// ─── Reason categorization ────────────────────────────────────────────────────

const CATEGORIES = ['All','Sizing','Damaged','Quality','Not as described','Changed mind','Other']
const CAT_COLORS = {
  'Sizing':           { color:'#60A5FA', bg:'rgba(96,165,250,0.12)',  border:'rgba(96,165,250,0.28)',  glow:'rgba(96,165,250,0.3)'  },
  'Damaged':          { color:'#FB923C', bg:'rgba(251,146,60,0.12)',  border:'rgba(251,146,60,0.28)',  glow:'rgba(251,146,60,0.3)'  },
  'Quality':          { color:'#F87171', bg:'rgba(248,113,113,0.12)', border:'rgba(248,113,113,0.28)', glow:'rgba(248,113,113,0.3)' },
  'Not as described': { color:'#C084FC', bg:'rgba(192,132,252,0.12)', border:'rgba(192,132,252,0.28)', glow:'rgba(192,132,252,0.3)' },
  'Changed mind':     { color:'#FCD34D', bg:'rgba(252,211,77,0.12)',  border:'rgba(252,211,77,0.28)',  glow:'rgba(252,211,77,0.3)'  },
  'Other':            { color:'#94A3B8', bg:'rgba(148,163,184,0.10)', border:'rgba(148,163,184,0.22)', glow:'rgba(148,163,184,0.2)' },
}

function categorizeReason(raw) {
  if(!raw) return 'Other'
  const r=raw.toLowerCase()
  if(/size|maat|small|large|fit|klein|groot|sizing|sized/.test(r)) return 'Sizing'
  if(/damage|damaged|broken|kapot|beschadigd|transit|arrived|cracked|defect/.test(r)) return 'Damaged'
  if(/quality|kwaliteit|expect|verwacht|stitching|fabric|material|poor/.test(r)) return 'Quality'
  if(/described|color|colour|kleur|photo|picture|different|anders|not as|mislead/.test(r)) return 'Not as described'
  if(/changed mind|no longer|changed my|besloten|don.t want|don.t need|by mistake/.test(r)) return 'Changed mind'
  return 'Other'
}

// ─── Data builders ────────────────────────────────────────────────────────────

const PROACTIVE_INSIGHTS = [
  { priority:'medium', category:'Product Pages',      title:'Add a size guide to every clothing product', action:'"Wrong size" accounts for 22% of all e-commerce refunds globally. Add chest, waist and hip measurements in cm to every product page.' },
  { priority:'medium', category:'Product Photography', title:'Show texture, true color and scale in photos', action:'"Not as described" is the second most common refund reason. Add texture close-ups and lifestyle photos in natural light.' },
  { priority:'medium', category:'Operations',         title:'Review packaging for all fragile products', action:'"Arrived damaged" causes 14% of e-commerce refunds. Use double-walled boxes and fragile labels for delicate items.' },
  { priority:'low',    category:'Customer Service',   title:'Offer an exchange before processing any refund', action:'Studies show 30–40% of size-related refund requests can be converted to exchanges, retaining the revenue.' },
]

function generatePatternActions(allRefunds) {
  const map = {}
  allRefunds.forEach(r => {
    const cat = categorizeReason(r.reason)
    ;(r.products||[]).forEach(p => {
      if(!map[p]) map[p]={ name:p, refunds:[], catCounts:{} }
      map[p].refunds.push(r)
      map[p].catCounts[cat] = (map[p].catCounts[cat]||0)+1
    })
  })
  const actions = []
  Object.values(map).forEach(prod => {
    if(prod.refunds.length<2) return
    const dom = Object.entries(prod.catCounts).sort((a,b)=>b[1]-a[1])[0][0]
    const amt = prod.refunds.reduce((s,r)=>s+parseFloat(r.refundAmount||0),0)
    const n = prod.refunds.length, a = fmtEur(amt)
    const copies = {
      'Sizing':           { title:`Fix size guide: ${prod.name}`, action:`${n} customers returned "${prod.name}" for size issues (${a} lost). Add measurements in cm and request supplier ships 1 size up on flagged orders.` },
      'Damaged':          { title:`Improve packaging: ${prod.name}`, action:`${n} items arrived damaged (${a} lost). Switch to double-walled boxes and add Fragile labels for "${prod.name}".` },
      'Quality':          { title:`Quality review: ${prod.name}`, action:`${n} refunds for quality issues on "${prod.name}" (${a} lost). Contact supplier for a formal quality review and inspect next shipment before shipping.` },
      'Not as described': { title:`Update listing: ${prod.name}`, action:`${n} customers said "${prod.name}" looked different in person (${a} lost). Add natural-light photos and a color accuracy disclaimer.` },
      'Changed mind':     { title:`Offer exchanges: ${prod.name}`, action:`${n} changed-mind returns on "${prod.name}" (${a} lost). Auto-email before refund to offer free exchange — converts ~30% of returns.` },
      'Other':            { title:`Investigate: ${prod.name}`, action:`${n} refunds on "${prod.name}" (${a} lost). Review order notes for a root cause.` },
    }
    const copy = copies[dom] || copies['Other']
    actions.push({ id:`pattern-${prod.name.replace(/\s+/g,'-').toLowerCase()}`, type:'pattern', priority:n>=3?'high':'medium', category:dom, product:prod.name, refundCount:n, totalAmount:amt, ...copy })
  })
  return actions.sort((a,b)=>({high:0,medium:1,low:2}[a.priority]||2)-({high:0,medium:1,low:2}[b.priority]||2))
}

function buildWeeklyReport(allRefunds) {
  const today = new Date(), dow = today.getDay()
  let ws = new Date(today); ws.setDate(today.getDate()-dow); ws.setHours(0,0,0,0)
  return Array.from({length:4},(_,i)=>{
    const wStart=new Date(ws); wStart.setDate(ws.getDate()-i*7)
    const wEnd=new Date(wStart); wEnd.setDate(wStart.getDate()+6); wEnd.setHours(23,59,59,999)
    const wr=allRefunds.filter(r=>{ const d=new Date(r.refundedAt); return d>=wStart&&d<=wEnd })
    const amt=wr.reduce((s,r)=>s+parseFloat(r.refundAmount||0),0)
    const cc={}, pc={}
    wr.forEach(r=>{ cc[categorizeReason(r.reason)]=(cc[categorizeReason(r.reason)]||0)+1; (r.products||[]).forEach(p=>{pc[p]=(pc[p]||0)+1}) })
    return { label:i===0?'This week':i===1?'Last week':`${fmtDateShort(wStart.toISOString())} – ${fmtDateShort(wEnd.toISOString())}`, refundCount:wr.length, totalAmount:amt, topReason:Object.entries(cc).sort((a,b)=>b[1]-a[1])[0]?.[0]||null, topProduct:Object.entries(pc).sort((a,b)=>b[1]-a[1])[0]?.[0]||null, isCurrentWeek:i===0 }
  })
}

function buildMonthlyTrend(allRefunds) {
  const now = new Date()
  return Array.from({length:6},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1)
    const next=new Date(d.getFullYear(),d.getMonth()+1,1)
    const mr=allRefunds.filter(r=>{ const rd=new Date(r.refundedAt); return rd>=d&&rd<next })
    return { label:d.toLocaleDateString('en-US',{month:'short'}), count:mr.length, amount:mr.reduce((s,r)=>s+parseFloat(r.refundAmount||0),0), isCurrentMonth:i===5 }
  })
}

function buildProductMatrix(allRefunds) {
  const map = {}
  allRefunds.forEach(r=>{ (r.products||[]).forEach(p=>{ if(!map[p])map[p]={name:p,refunds:[],amount:0}; map[p].refunds.push(r); map[p].amount+=parseFloat(r.refundAmount||0) }) })
  return Object.values(map).map(p=>({
    name:p.name, count:p.refunds.length, amount:p.amount,
    avgPct:(p.refunds.reduce((s,r)=>s+parseFloat(r.refundPct||0),0)/p.refunds.length).toFixed(1),
    topCat:Object.entries(p.refunds.reduce((acc,r)=>{ const c=categorizeReason(r.reason); acc[c]=(acc[c]||0)+1; return acc },{} )).sort((a,b)=>b[1]-a[1])[0]?.[0]||'Other',
  })).sort((a,b)=>b.count-a.count)
}

function buildRepeatRefunders(allRefunds) {
  const map = {}
  allRefunds.forEach(r=>{ const k=r.customerEmail||r.customer; if(!map[k])map[k]={customer:r.customer,email:r.customerEmail,refunds:[]}; map[k].refunds.push(r) })
  return Object.values(map).filter(c=>c.refunds.length>=2).map(c=>({
    ...c, count:c.refunds.length,
    totalAmount:c.refunds.reduce((s,r)=>s+parseFloat(r.refundAmount||0),0),
    lastRefund:c.refunds.sort((a,b)=>new Date(b.refundedAt)-new Date(a.refundedAt))[0].refundedAt,
  })).sort((a,b)=>b.count-a.count)
}

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target, loaded) {
  const [val,setVal]=useState(0); const raf=useRef(null)
  useEffect(()=>{ cancelAnimationFrame(raf.current); if(!loaded){setVal(0);return}; const num=parseFloat(target)||0; if(num===0){setVal(0);return}; const start=performance.now(),dur=900; function tick(now){const p=Math.min((now-start)/dur,1),ease=1-Math.pow(1-p,3); setVal(num*ease); if(p<1)raf.current=requestAnimationFrame(tick)}; raf.current=requestAnimationFrame(tick); return()=>cancelAnimationFrame(raf.current) },[target,loaded])
  return val
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes auroraA{0%,100%{transform:translate(0,0) scale(1);opacity:.7}33%{transform:translate(70px,-90px) scale(1.28);opacity:.9}66%{transform:translate(-50px,45px) scale(.88);opacity:.55}}
  @keyframes auroraB{0%,100%{transform:translate(0,0) scale(1);opacity:.6}40%{transform:translate(-90px,65px) scale(1.22);opacity:.85}75%{transform:translate(55px,-40px) scale(.82);opacity:.45}}
  @keyframes auroraC{0%,100%{transform:translate(0,0) scale(1);opacity:.5}55%{transform:translate(45px,80px) scale(1.18);opacity:.75}}
  @keyframes auroraD{0%,100%{transform:translate(0,0) scale(1);opacity:.55}45%{transform:translate(-60px,-55px) scale(1.3);opacity:.8}}
  @keyframes auroraE{0%,100%{transform:translate(0,0) scale(1);opacity:.5}60%{transform:translate(80px,40px) scale(1.2);opacity:.75}}
  @keyframes revealUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{from{background-position:-400% 0}to{background-position:400% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @keyframes pulseRed{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.3)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}
  @keyframes glowPulse{0%,100%{opacity:.5}50%{opacity:1}}
  @keyframes barGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}

  .an-root *{box-sizing:border-box;margin:0;padding:0}
  .an-root{font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased}
  .an-scroll::-webkit-scrollbar{width:3px}
  .an-scroll::-webkit-scrollbar-track{background:transparent}
  .an-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}

  .date-inp{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#F8FAFC;padding:4px 10px;font-size:11.5px;font-family:inherit;cursor:pointer;outline:none;color-scheme:dark;transition:border-color .15s}
  .date-inp:focus{border-color:rgba(161,117,252,0.5)}
  .date-inp::-webkit-calendar-picker-indicator{filter:invert(.6);cursor:pointer}

  .kpi-card{
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:18px;padding:22px 24px;
    position:relative;overflow:hidden;
    transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease;
    cursor:default;
  }
  .kpi-card:hover{transform:translateY(-4px);border-color:rgba(161,117,252,0.25);box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .kpi-card .top-bar{position:absolute;top:0;left:0;right:0;height:2px;opacity:0;transition:opacity .25s ease}
  .kpi-card:hover .top-bar{opacity:1}
  .kpi-glow{text-shadow:none}

  .panel{
    background:rgba(255,255,255,0.028);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:18px;padding:24px;
    transition:border-color .25s ease,box-shadow .25s ease;
  }
  .panel:hover{border-color:rgba(255,255,255,0.11);box-shadow:0 8px 40px rgba(0,0,0,.2)}

  .action-card{border-radius:13px;background:rgba(255,255,255,0.022);border:1px solid rgba(255,255,255,0.06);padding:18px 20px;transition:background .2s,border-color .2s;cursor:default}
  .action-card:hover{background:rgba(255,255,255,0.045);border-color:rgba(161,117,252,0.25)}
  .action-card.done-card{opacity:.45}

  .tab-btn{padding:6px 16px;border-radius:100px;font-size:11.5px;font-weight:700;cursor:pointer;border:none;font-family:inherit;letter-spacing:.02em;transition:all .15s ease}
  .range-pill{padding:5px 14px;border-radius:100px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s ease}
  .filter-pill{padding:4px 12px;border-radius:100px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;font-family:inherit;transition:all .15s ease;white-space:nowrap}
  .tbl-row{transition:background .15s ease;cursor:default}
  .tbl-row:hover{background:rgba(255,255,255,0.03)}

  .sk{background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px}
  .bar-fill{transform-origin:left;animation:growX .6s cubic-bezier(.34,1.56,.64,1) both}
  .bar-col{transform-origin:bottom;animation:barGrow .5s cubic-bezier(.34,1.56,.64,1) both}

  .btn-pickup{padding:5px 13px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid rgba(161,117,252,.3);font-family:inherit;background:rgba(161,117,252,.12);color:#C3A3FF;transition:all .15s}
  .btn-pickup:hover{background:rgba(161,117,252,.22)}
  .btn-done{padding:5px 13px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid rgba(74,222,128,.28);font-family:inherit;background:rgba(74,222,128,.1);color:#4ade80;transition:all .15s}
  .btn-done:hover{background:rgba(74,222,128,.2)}
  .btn-reopen{padding:4px 11px;border-radius:8px;font-size:10.5px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.08);font-family:inherit;background:transparent;color:rgba(248,250,252,.28);transition:all .15s}
  .btn-reopen:hover{border-color:rgba(255,255,255,.18);color:rgba(248,250,252,.55)}
  .name-inp{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#F8FAFC;padding:4px 10px;font-size:11.5px;font-family:inherit;outline:none;transition:border-color .15s;width:140px}
  .name-inp:focus{border-color:rgba(161,117,252,.45)}
  .name-inp::placeholder{color:rgba(248,250,252,.3)}

  .matrix-row{transition:background .15s;border-radius:10px}
  .matrix-row:hover{background:rgba(255,255,255,.035)}
`

// ─── Aurora + Grid ────────────────────────────────────────────────────────────

function AuroraBackground() {
  const blob = (style) => <div style={{ position:'absolute', borderRadius:'50%', filter:'blur(70px)', ...style }}/>
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      {/* Grid overlay */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)', backgroundSize:'52px 52px', maskImage:'radial-gradient(ellipse 80% 60% at 50% 0%,black 40%,transparent 100%)', WebkitMaskImage:'radial-gradient(ellipse 80% 60% at 50% 0%,black 40%,transparent 100%)' }}/>
      {blob({ top:'-8%', right:'10%',  width:800, height:700, background:'radial-gradient(ellipse,rgba(161,117,252,0.22) 0%,transparent 70%)', animation:'auroraA 22s ease-in-out infinite' })}
      {blob({ bottom:'0%', left:'2%',  width:650, height:600, background:'radial-gradient(ellipse,rgba(255,107,53,0.13) 0%,transparent 70%)',  animation:'auroraB 28s ease-in-out infinite' })}
      {blob({ top:'35%', right:'-5%', width:500, height:500, background:'radial-gradient(ellipse,rgba(34,211,238,0.08) 0%,transparent 70%)',  animation:'auroraC 33s ease-in-out infinite' })}
      {blob({ top:'-5%', left:'20%',  width:450, height:400, background:'radial-gradient(ellipse,rgba(239,68,68,0.07) 0%,transparent 70%)',   animation:'auroraD 26s ease-in-out infinite' })}
      {blob({ bottom:'20%', right:'30%', width:550, height:500, background:'radial-gradient(ellipse,rgba(192,132,252,0.1) 0%,transparent 70%)', animation:'auroraE 35s ease-in-out infinite' })}
    </div>
  )
}

function Spinner({ size=18 }) {
  return <div style={{ width:size, height:size, border:`2px solid rgba(255,255,255,0.1)`, borderTop:`2px solid #A175FC`, borderRadius:'50%', animation:'spin .7s linear infinite', flexShrink:0 }}/>
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

function AlertBanner({ rate, loaded }) {
  if(!loaded) return null
  const r=parseFloat(rate||0); if(r<5) return null
  const isCrit=r>=20, isHigh=r>=10
  const bg=isCrit?'rgba(239,68,68,0.1)':isHigh?'rgba(249,115,22,0.08)':'rgba(251,191,36,0.08)'
  const border=isCrit?'rgba(239,68,68,0.3)':isHigh?'rgba(249,115,22,0.25)':'rgba(251,191,36,0.25)'
  const color=isCrit?'#f87171':isHigh?'#fb923c':'#fbbf24'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, background:bg, border:`1px solid ${border}`, borderRadius:14, padding:'13px 20px', marginBottom:24, animation:'revealUp .4s ease-out both', boxShadow:`0 0 30px ${isCrit?'rgba(239,68,68,0.08)':'rgba(249,115,22,0.06)'}` }}>
      <div style={{ animation:'pulseRed 2s ease-in-out infinite', borderRadius:'50%', flexShrink:0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div style={{ flex:1 }}>
        <span style={{ fontSize:12, fontWeight:700, color, marginRight:8, textTransform:'uppercase', letterSpacing:'.06em' }}>{isCrit?'Critical':isHigh?'High':'Warning'}</span>
        <span style={{ fontSize:12, color:'rgba(248,250,252,0.65)', lineHeight:1.5 }}>
          {isCrit?`Your refund rate is ${r}% — industry average is 2–5%. Immediate action required.`:isHigh?`Your refund rate of ${r}% is significantly above the 2–5% e-commerce average.`:`Your refund rate of ${r}% is above the 2–5% benchmark.`}
        </span>
      </div>
    </div>
  )
}

// ─── KPI Row ──────────────────────────────────────────────────────────────────

function CatBadge({ cat, small }) {
  const c = CAT_COLORS[cat]||CAT_COLORS.Other
  return <span style={{ display:'inline-block', fontSize:small?9.5:10.5, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:c.color, background:c.bg, border:`1px solid ${c.border}`, borderRadius:100, padding:small?'1px 7px':'2px 9px', whiteSpace:'nowrap' }}>{cat}</span>
}

function DeltaBadge({ delta, lowerIsBetter=true }) {
  if(!delta) return null
  const improved = lowerIsBetter ? delta.pct<0 : delta.pct>0
  const color = improved?'#4ade80':'#f87171'
  const arrow = delta.pct>0?'↑':'↓'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:10.5, fontWeight:700, color, letterSpacing:'.01em' }}>
      <span style={{ opacity:.85 }}>{arrow}</span>
      <span>{Math.abs(delta.pct).toFixed(1)}%</span>
      <span style={{ opacity:.45, fontSize:9.5, fontWeight:500 }}>vs prev</span>
    </div>
  )
}

function KpiRow({ kpis, prevKpis, refunds, loaded }) {
  const totalRef = refunds.reduce((s,r)=>s+parseFloat(r.refundAmount||0),0)
  const count    = refunds.length
  const avg      = count>0?totalRef/count:0
  const rate     = parseFloat(kpis.refundRate||0)
  const prevRef  = parseFloat(prevKpis.refundAmount||0)
  const prevRate = parseFloat(prevKpis.refundRate||0)
  const prevCount= prevKpis.totalRefunds||0
  const prevAvg  = prevCount>0?prevRef/prevCount:0

  const aTotal = useCountUp(totalRef, loaded.refunds)
  const aCount = useCountUp(count, loaded.refunds)
  const aRate  = useCountUp(rate, loaded.kpis)
  const aAvg   = useCountUp(avg, loaded.refunds)
  const isHealthy = rate===0&&loaded.kpis&&loaded.refunds

  if(!loaded.kpis&&!loaded.refunds) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {[0,1,2,3].map(i=><div key={i} className="kpi-card" style={{ animation:`revealUp .5s ease-out ${.1+i*.07}s both` }}><div className="sk" style={{ height:11, width:'55%', marginBottom:14 }}/><div className="sk" style={{ height:30, width:'70%', marginBottom:8 }}/><div className="sk" style={{ height:9, width:'85%' }}/></div>)}
    </div>
  )

  const cards = [
    { label:'MONEY LOST',    value:fmtEur(aTotal), sub:`${count} refunded order${count!==1?'s':''} this period`, accent:'#EF4444', grad:'linear-gradient(135deg,#EF4444,#FF6B35)', delta:computeDelta(totalRef, prevRef), lowerBetter:true,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg> },
    { label:'TOTAL REFUNDS', value:Math.floor(aCount), sub:'fully or partially refunded', accent:'#F97316', grad:'linear-gradient(135deg,#F97316,#fbbf24)', delta:computeDelta(count, prevCount), lowerBetter:true,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg> },
    { label:'REFUND RATE',   value:isHealthy?'0.0% ✓':`${aRate.toFixed(1)}%`, sub:isHealthy?'Excellent — below average':rate>5?`${(rate/2.5).toFixed(1)}× above 2–5% avg`:'Industry avg: 2–5%', accent:isHealthy?'#22C55E':rate>10?'#EF4444':rate>5?'#F97316':'#22C55E', grad:isHealthy?'linear-gradient(135deg,#22C55E,#86efac)':rate>10?'linear-gradient(135deg,#EF4444,#f87171)':rate>5?'linear-gradient(135deg,#F97316,#fbbf24)':'linear-gradient(135deg,#22C55E,#86efac)', delta:computeDelta(rate, prevRate), lowerBetter:true,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { label:'AVG REFUND',    value:fmtEur(aAvg), sub:'average per refunded order', accent:'#A175FC', grad:'linear-gradient(135deg,#A175FC,#C3A3FF)', delta:computeDelta(avg, prevAvg), lowerBetter:true,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {cards.map((c,i)=>(
        <div key={c.label} className="kpi-card" style={{ animation:`revealUp .5s ease-out ${.1+i*.07}s both` }}>
          <div className="top-bar" style={{ background:c.grad }}/>
          <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 100% 0%,${c.accent}08 0%,transparent 60%)`, borderRadius:18, pointerEvents:'none' }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${c.accent}18`, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent, boxShadow:'none' }}>{c.icon}</div>
            <DeltaBadge delta={loaded.prevKpis?c.delta:null} lowerIsBetter={c.lowerBetter}/>
          </div>
          <div className="kpi-glow" style={{ fontSize:27, fontWeight:800, letterSpacing:'-0.04em', color:c.accent, lineHeight:1, marginBottom:5, fontVariantNumeric:'tabular-nums' }}>{c.value}</div>
          <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.1em', color:'rgba(248,250,252,0.32)', textTransform:'uppercase', marginBottom:4 }}>{c.label}</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.25)', lineHeight:1.4 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Revenue Trend ────────────────────────────────────────────────────────────

function RevenueTrendChart({ trend, loaded, rangeLabel }) {
  if(!loaded) return <div className="panel" style={{ marginBottom:24 }}><div className="sk" style={{ height:13, width:'30%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'20%', marginBottom:20 }}/><div className="sk" style={{ height:120, borderRadius:8 }}/></div>
  if(!trend.length||trend.every(d=>d.revenue===0)) return null
  const W=800,H=130,pL=48,pR=12,pT=10,pB=24
  const mx=Math.max(...trend.map(d=>d.revenue),1), tot=trend.reduce((s,d)=>s+d.revenue,0)
  const pts=trend.map((d,i)=>({ x:pL+(i/Math.max(trend.length-1,1))*(W-pL-pR), y:pT+(1-d.revenue/mx)*(H-pT-pB), ...d }))
  const line=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area=`${pts[0].x.toFixed(1)},${(H-pB).toFixed(1)} ${line} ${pts[pts.length-1].x.toFixed(1)},${(H-pB).toFixed(1)}`
  const step=Math.ceil(trend.length/6)
  const xlbls=pts.filter((_,i)=>i===0||i%step===0||i===pts.length-1)
  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .28s both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div><div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Revenue Trend</div><div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>{rangeLabel} · daily net revenue</div></div>
        <div style={{ fontSize:16, fontWeight:700, color:'#A175FC', letterSpacing:'-0.02em' }}>{fmtEur(tot)}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', overflow:'visible' }} aria-hidden>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A175FC" stopOpacity="0.25"/><stop offset="100%" stopColor="#A175FC" stopOpacity="0"/></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {[0,.5,1].map((s,i)=>{ const y=pT+s*(H-pT-pB); return <line key={i} x1={pL} y1={y} x2={W-pR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/> })}
        <polygon points={area} fill="url(#tg)"/>
        <polyline points={line} fill="none" stroke="#A175FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)"/>
        {pts.filter(p=>p.revenue>0).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#A175FC" filter="url(#glow)"/>)}
        {xlbls.map((p,i)=><text key={i} x={p.x} y={H} textAnchor="middle" fontSize="9" fill="rgba(248,250,252,0.28)" fontFamily="sans-serif">{new Date(p.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</text>)}
        {[0,mx/2,mx].map((v,i)=>{ const y=pT+(1-v/mx)*(H-pT-pB); const lbl=v>=1000?`€${(v/1000).toFixed(1)}k`:`€${Math.round(v)}`; return <text key={i} x={pL-6} y={y+3} textAnchor="end" fontSize="9" fill="rgba(248,250,252,0.22)" fontFamily="sans-serif">{lbl}</text> })}
      </svg>
    </div>
  )
}

// ─── Donut + Monthly charts (side by side) ────────────────────────────────────

function DonutReasonChart({ refunds, loaded }) {
  if(!loaded) return <div className="panel" style={{ flex:'1 1 0' }}><div className="sk" style={{ height:13, width:'55%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'35%', marginBottom:20 }}/><div className="sk" style={{ height:160, borderRadius:100, width:160, margin:'0 auto' }}/></div>
  const map={}; refunds.forEach(r=>{ const c=categorizeReason(r.reason); map[c]=(map[c]||0)+1 })
  const total=Object.values(map).reduce((s,v)=>s+v,0)
  if(total===0) return (
    <div className="panel" style={{ flex:'1 1 0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:200 }}>
      <div style={{ fontSize:13, color:'rgba(248,250,252,0.25)' }}>No refund reasons this period</div>
    </div>
  )
  const segments=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>({ cat, val, color:(CAT_COLORS[cat]||CAT_COLORS.Other).color, pct:((val/total)*100).toFixed(0) }))
  const r=58, C=2*Math.PI*r
  let cum=0
  const slices=segments.map(s=>{ const dashLen=(s.val/total)*C-1.5; const offset=-cum; cum+=(s.val/total)*C; return { ...s, dashLen:Math.max(dashLen,0), offset } })

  return (
    <div className="panel" style={{ flex:'1 1 0' }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Refund Reasons</div>
        <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>Distribution this period</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:24 }}>
        {/* Donut */}
        <div style={{ position:'relative', flexShrink:0, width:130, height:130 }}>
          <svg viewBox="0 0 130 130" style={{ width:130, height:130, transform:'rotate(-90deg)' }} aria-hidden>
            <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18"/>
            {slices.map((s,i)=>(
              <circle key={i} cx="65" cy="65" r={r} fill="none" stroke={s.color} strokeWidth="18"
                strokeDasharray={`${s.dashLen} ${C}`} strokeDashoffset={s.offset} strokeLinecap="butt"
                style={{ filter:'none' }}
              />
            ))}
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.04em', lineHeight:1 }}>{total}</div>
            <div style={{ fontSize:9.5, color:'rgba(248,250,252,0.35)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>refunds</div>
          </div>
        </div>
        {/* Legend */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          {segments.map((s,i)=>(
            <div key={s.cat} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }}/>
                <span style={{ fontSize:11.5, color:'rgba(248,250,252,0.65)', fontWeight:500 }}>{s.cat}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
                <span style={{ fontSize:11, color:'rgba(248,250,252,0.38)', fontVariantNumeric:'tabular-nums' }}>{s.val}×</span>
                <span style={{ fontSize:10.5, fontWeight:700, color:s.color, minWidth:28, textAlign:'right' }}>{s.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MonthlyTrendChart({ allRefunds, loaded }) {
  if(!loaded) return <div className="panel" style={{ flex:'1 1 0' }}><div className="sk" style={{ height:13, width:'50%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'30%', marginBottom:20 }}/><div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120 }}>{[0,1,2,3,4,5].map(i=><div key={i} className="sk" style={{ flex:1, height:`${30+i*10}%`, borderRadius:'4px 4px 0 0' }}/>)}</div></div>
  const months = buildMonthlyTrend(allRefunds)
  const maxCount = Math.max(...months.map(m=>m.count), 1)
  const maxAmt = Math.max(...months.map(m=>m.amount), 1)
  const totalLost = months.reduce((s,m)=>s+m.amount,0)

  return (
    <div className="panel" style={{ flex:'1 1 0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Monthly Refunds</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>Last 6 months — count + amount</div>
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:'#EF4444' }}>{fmtEur(totalLost)}</div>
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:110 }}>
        {months.map((m,i)=>{
          const barH = maxCount>0 ? Math.max((m.count/maxCount)*100,m.count>0?8:0) : 0
          const isMax = m.count===maxCount&&m.count>0
          return (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'100%', gap:5 }}>
              <div style={{ fontSize:10, fontWeight:700, color:m.count>0?'#EF4444':'rgba(248,250,252,0.2)', fontVariantNumeric:'tabular-nums' }}>{m.count>0?m.count:''}</div>
              <div style={{ width:'100%', borderRadius:'5px 5px 0 0', position:'relative', overflow:'hidden',
                background:m.isCurrentMonth?'rgba(161,117,252,0.15)':isMax?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.05)',
                border:`1px solid ${m.isCurrentMonth?'rgba(161,117,252,0.3)':isMax?'rgba(239,68,68,0.25)':'rgba(255,255,255,0.06)'}`,
                height:`${Math.max(barH,4)}%`, minHeight:4, transition:'height .3s ease',
              }}>
                {m.count>0&&<div className="bar-col" style={{ position:'absolute', inset:0, background:m.isCurrentMonth?'linear-gradient(180deg,rgba(161,117,252,0.6),rgba(161,117,252,0.2))':isMax?'linear-gradient(180deg,rgba(239,68,68,0.7),rgba(239,68,68,0.25))':'linear-gradient(180deg,rgba(255,107,53,0.5),rgba(255,107,53,0.15))', animationDelay:`${i*.06}s` }}/>}
              </div>
              <div style={{ fontSize:10, color:m.isCurrentMonth?'#C3A3FF':'rgba(248,250,252,0.3)', fontWeight:m.isCurrentMonth?700:400 }}>{m.label}</div>
            </div>
          )
        })}
      </div>
      {/* Amount sparkline */}
      <svg viewBox="0 0 300 28" style={{ width:'100%', marginTop:12 }} aria-hidden>
        <defs><linearGradient id="sparkG" x1="0" y1="0" x2="1" y2="0">{months.map((_,i)=><stop key={i} offset={`${(i/(months.length-1))*100}%`} stopColor="#EF4444" stopOpacity={0.4+i*0.1}/>)}</linearGradient></defs>
        {months.map((m,i)=>{ const x=(i/(months.length-1))*280+10; const y=28-(m.amount/maxAmt)*22-3; return <circle key={i} cx={x} cy={y} r="2.5" fill="#EF4444" style={{ filter:'none' }}/> })}
        <polyline points={months.map((m,i)=>{ const x=(i/(months.length-1))*280+10; const y=28-(m.amount/maxAmt)*22-3; return `${x},${y}` }).join(' ')} fill="none" stroke="url(#sparkG)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ─── Action Board ─────────────────────────────────────────────────────────────

function ActionBoard({ patternActions, aiInsights, noRefunds, loaded, onStatusChange, statuses, usingFallback }) {
  const [activeTab,setActiveTab]=useState('open')
  const [nameInps,setNameInps]=useState({})
  const [noteInps,setNoteInps]=useState({})

  const aiItems=(aiInsights||[]).map((ins,i)=>({ ...ins, id:`ai-${ins.category?.replace(/\s+/g,'-').toLowerCase()??i}`, type:'ai' }))
  const patternCats=new Set(patternActions.map(a=>a.category))
  const filteredAi=noRefunds
    ? PROACTIVE_INSIGHTS.map((ins,i)=>({ ...ins, id:`best-${i}`, type:'best' }))
    : aiItems.filter(ai=>!patternCats.has(ai.category))
  const allItems=[...patternActions,...filteredAi]
  const getStatus=id=>statuses[id]?.status||'open'
  const openItems=allItems.filter(a=>getStatus(a.id)==='open')
  const pickupItems=allItems.filter(a=>getStatus(a.id)==='picked_up')
  const doneItems=allItems.filter(a=>getStatus(a.id)==='done')
  const tabItems=activeTab==='open'?openItems:activeTab==='picked_up'?pickupItems:doneItems

  if(!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}><Spinner size={16}/><div style={{ fontSize:14, fontWeight:700, color:'rgba(248,250,252,0.6)' }}>Analysing refund patterns…</div></div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{[0,1,2,3].map(i=><div key={i} className="sk" style={{ height:80, borderRadius:12 }}/>)}</div>
    </div>
  )

  const PRIO_C={high:'#F87171',medium:'#FB923C',low:'#A175FC'}
  const PRIO_BG={high:'rgba(248,113,113,0.1)',medium:'rgba(251,146,60,0.08)',low:'rgba(161,117,252,0.08)'}

  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .35s both' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            {noRefunds
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
            <span style={{ fontSize:15, fontWeight:700, color:'#F8FAFC' }}>{noRefunds?'No refunds — stay ahead':'Action Board'}</span>
            {!noRefunds&&<span style={{ fontSize:11, color:'rgba(248,250,252,0.3)' }}>— {allItems.length} action{allItems.length!==1?'s':''}{patternActions.length>0&&` · ${patternActions.length} pattern-detected`}</span>}
          </div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>{noRefunds?'Proactive best practices to keep your refund rate at 0%':'Pattern-detected issues + AI recommendations — assign to your team'}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {usingFallback&&<div style={{ fontSize:10, color:'rgba(248,250,252,0.22)', padding:'3px 9px', borderRadius:100, border:'1px solid rgba(255,255,255,0.07)' }}>Local only</div>}
          {!noRefunds&&(['open','picked_up','done']).map(tab=>{
            const cnt=tab==='open'?openItems.length:tab==='picked_up'?pickupItems.length:doneItems.length
            const isAct=activeTab===tab
            return <button key={tab} onClick={()=>setActiveTab(tab)} className="tab-btn" style={{ background:isAct?'rgba(161,117,252,0.18)':'rgba(255,255,255,0.05)', color:isAct?'#C3A3FF':'rgba(248,250,252,0.38)', boxShadow:isAct?'inset 0 0 0 1px rgba(161,117,252,0.38)':'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>{tab==='open'?'Open':tab==='picked_up'?'Picked Up':'Done'}{cnt>0&&<span style={{ marginLeft:4, fontSize:10, opacity:.7 }}>{cnt}</span>}</button>
          })}
          {noRefunds&&<div style={{ padding:'4px 12px', borderRadius:100, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', fontSize:11, fontWeight:700, color:'#22C55E', letterSpacing:'.05em' }}>STORE HEALTHY</div>}
        </div>
      </div>

      {!noRefunds&&allItems.length>0&&(
        <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:100, marginBottom:16, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:100, width:`${(doneItems.length/allItems.length)*100}%`, background:'linear-gradient(90deg,#22C55E,#86efac)', transition:'width .4s ease' }}/>
        </div>
      )}

      {tabItems.length===0&&!noRefunds&&(
        <div style={{ textAlign:'center', padding:'36px 0' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={activeTab==='done'?'rgba(74,222,128,0.4)':'rgba(255,255,255,0.12)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'block', margin:'0 auto 10px' }}>
            {activeTab==='done'?<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          </svg>
          <div style={{ fontSize:13, color:'rgba(248,250,252,0.3)' }}>{activeTab==='open'?'All actions picked up or done':activeTab==='picked_up'?'No actions currently in progress':'No completed actions yet'}</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {tabItems.map(item=>{
          const status=getStatus(item.id), st=statuses[item.id]||{}
          const pc=PRIO_C[item.priority]||'#94A3B8', pbg=PRIO_BG[item.priority]||'rgba(148,163,184,0.08)'
          const isDone=status==='done'
          return (
            <div key={item.id} className={`action-card${isDone?' done-card':''}`}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:pc, marginTop:6, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                    {item.type==='pattern'&&<span style={{ fontSize:9, fontWeight:800, letterSpacing:'.08em', color:'rgba(248,250,252,0.4)', background:'rgba(255,255,255,0.06)', borderRadius:100, padding:'2px 8px', textTransform:'uppercase', border:'1px solid rgba(255,255,255,0.08)' }}>PATTERN DETECTED</span>}
                    {item.type==='best'&&<span style={{ fontSize:9, fontWeight:800, letterSpacing:'.08em', color:'#22C55E', background:'rgba(34,197,94,0.08)', borderRadius:100, padding:'2px 8px', textTransform:'uppercase', border:'1px solid rgba(34,197,94,0.2)' }}>BEST PRACTICE</span>}
                    <CatBadge cat={item.category} small/>
                    <span style={{ fontSize:9.5, fontWeight:700, color:pc, background:pbg, borderRadius:100, padding:'1px 7px', textTransform:'uppercase', letterSpacing:'.06em' }}>{(item.priority||'low').toUpperCase()}</span>
                    {item.type==='pattern'&&<span style={{ fontSize:10, color:'rgba(248,250,252,0.35)' }}>{item.refundCount}× · {fmtEur(item.totalAmount)} lost</span>}
                  </div>
                  <div style={{ fontSize:13.5, fontWeight:700, color:isDone?'rgba(248,250,252,0.4)':'#F8FAFC', marginBottom:6, lineHeight:1.35, textDecoration:isDone?'line-through':'none' }}>{item.title}</div>
                  <div style={{ fontSize:12, color:'rgba(248,250,252,0.5)', lineHeight:1.65, marginBottom:status!=='open'?10:0 }}>{item.action}</div>
                  {status==='picked_up'&&st.pickedUpBy&&<div style={{ fontSize:11, color:'rgba(161,117,252,0.7)', marginBottom:8 }}>Picked up by <strong style={{ color:'#C3A3FF' }}>{st.pickedUpBy}</strong></div>}
                  {isDone&&<div style={{ fontSize:11, color:'rgba(74,222,128,0.7)', marginBottom:8 }}>{st.pickedUpBy&&<>Completed by <strong style={{ color:'#4ade80' }}>{st.pickedUpBy}</strong>{st.resultNote?' — ':''}</>}{st.resultNote&&<span style={{ color:'rgba(248,250,252,0.45)' }}>{st.resultNote}</span>}</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end', flexShrink:0 }}>
                  {status==='open'&&<><input className="name-inp" placeholder="Your name (optional)" value={nameInps[item.id]||''} onChange={e=>setNameInps(p=>({...p,[item.id]:e.target.value}))}/><button className="btn-pickup" onClick={()=>onStatusChange(item.id,'picked_up',nameInps[item.id],'')}>Pick Up</button></>}
                  {status==='picked_up'&&<><input className="name-inp" placeholder="Result note (optional)" value={noteInps[item.id]||''} onChange={e=>setNoteInps(p=>({...p,[item.id]:e.target.value}))}/><div style={{ display:'flex', gap:5 }}><button className="btn-reopen" onClick={()=>onStatusChange(item.id,'open','','')}>Re-open</button><button className="btn-done" onClick={()=>onStatusChange(item.id,'done',st.pickedUpBy,noteInps[item.id]||'')}>Mark Done</button></div></>}
                  {isDone&&<button className="btn-reopen" onClick={()=>onStatusChange(item.id,'open','','')}>Re-open</button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Refund Table ─────────────────────────────────────────────────────────────

function RefundTable({ refunds, loaded }) {
  const [showAll,setShowAll]=useState(false), [catFilter,setCatFilter]=useState('All'), [sortCol,setSortCol]=useState('refundedAt'), [sortDir,setSortDir]=useState('desc')
  const enriched=(loaded?refunds:[]).map(r=>({...r,category:categorizeReason(r.reason)}))
  const filtered=catFilter==='All'?enriched:enriched.filter(r=>r.category===catFilter)
  const sorted=[...filtered].sort((a,b)=>{ let av,bv; if(sortCol==='refundedAt'){av=new Date(a.refundedAt);bv=new Date(b.refundedAt)}else if(sortCol==='refundAmount'){av=parseFloat(a.refundAmount);bv=parseFloat(b.refundAmount)}else if(sortCol==='refundPct'){av=parseFloat(a.refundPct);bv=parseFloat(b.refundPct)}else{av=a[sortCol]||'';bv=b[sortCol]||''}; return sortDir==='desc'?(av<bv?1:-1):(av>bv?1:-1) })
  const display=showAll?sorted:sorted.slice(0,20)
  const toggleSort=col=>{ if(sortCol===col)setSortDir(d=>d==='desc'?'asc':'desc'); else{setSortCol(col);setSortDir('desc')} }
  const SortIco=({col})=>{ if(sortCol!==col)return<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"/></svg>; return sortDir==='desc'?<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(248,250,252,.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>:<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(248,250,252,.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg> }

  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .45s both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div><div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Refund History</div><div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>{loaded?`${filtered.length} of ${enriched.length} refund${enriched.length!==1?'s':''} · ${catFilter==='All'?'all categories':catFilter}`:'Loading…'}</div></div>
        {loaded&&enriched.length>0&&<div style={{ padding:'3px 12px', borderRadius:100, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', fontSize:11, fontWeight:700, color:'#EF4444' }}>{enriched.length} refunds</div>}
      </div>

      {loaded&&enriched.length>0&&(
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:16 }}>
          {CATEGORIES.map(cat=>{ const cc=cat==='All'?null:CAT_COLORS[cat]; const cnt=cat==='All'?enriched.length:enriched.filter(r=>r.category===cat).length; if(cnt===0&&cat!=='All')return null; const isAct=catFilter===cat; return <button key={cat} onClick={()=>{setCatFilter(cat);setShowAll(false)}} className="filter-pill" style={{ background:isAct?(cc?cc.bg:'rgba(255,255,255,0.08)'):'transparent', color:isAct?(cc?cc.color:'#F8FAFC'):'rgba(248,250,252,0.38)', borderColor:isAct?(cc?cc.border:'rgba(255,255,255,0.2)'):'rgba(255,255,255,0.08)' }}>{cat} <span style={{ opacity:.6, fontSize:10 }}>{cnt}</span></button> })}
        </div>
      )}

      {!loaded&&<div style={{ display:'flex', flexDirection:'column', gap:12 }}>{[0,1,2,3,4].map(i=><div key={i} style={{ display:'flex', gap:16 }}><div className="sk" style={{ height:13, width:60 }}/><div className="sk" style={{ height:13, flex:1 }}/><div className="sk" style={{ height:13, flex:2 }}/><div className="sk" style={{ height:13, width:90 }}/><div className="sk" style={{ height:13, width:70 }}/></div>)}</div>}

      {loaded&&enriched.length===0&&(
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 0', gap:12 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'rgba(74,222,128,0.08)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(74,222,128,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:14, fontWeight:600, color:'rgba(248,250,252,0.7)', marginBottom:4 }}>No refunds this period</div><div style={{ fontSize:12, color:'rgba(248,250,252,0.28)' }}>Keep it up — no refunded orders found</div></div>
        </div>
      )}

      {loaded&&filtered.length===0&&enriched.length>0&&<div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:'rgba(248,250,252,0.3)' }}>No refunds in category "{catFilter}"</div>}

      {loaded&&display.length>0&&(
        <>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:780 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {[{label:'Date',col:'refundedAt',align:'left'},{label:'Order',col:'orderId',align:'left'},{label:'Customer',col:'customer',align:'left'},{label:'Product(s)',col:null,align:'left'},{label:'Category',col:'category',align:'left'},{label:'% of Order',col:'refundPct',align:'right'},{label:'Amount',col:'refundAmount',align:'right'}].map(h=>(
                    <th key={h.label} onClick={()=>h.col&&toggleSort(h.col)} style={{ textAlign:h.align, fontSize:9.5, fontWeight:700, letterSpacing:'.08em', color:'rgba(248,250,252,0.25)', textTransform:'uppercase', padding:'0 0 12px', paddingLeft:h.align==='right'?14:0, whiteSpace:'nowrap', cursor:h.col?'pointer':'default', userSelect:'none' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>{h.label}{h.col&&<SortIco col={h.col}/>}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((r,ri)=>{ const pct=parseFloat(r.refundPct||0); const pc=pct>=80?'#F87171':pct>=40?'#FB923C':'rgba(248,250,252,0.45)'; const pb=pct>=80?'rgba(248,113,113,0.1)':pct>=40?'rgba(251,146,60,0.1)':'rgba(255,255,255,0.05)'; return (
                  <tr key={`${r.orderId}-${ri}`} className="tbl-row" style={{ borderBottom:ri<display.length-1?'1px solid rgba(255,255,255,0.04)':'none' }}>
                    <td style={{ padding:'11px 14px 11px 0', fontSize:11.5, color:'rgba(248,250,252,0.38)', whiteSpace:'nowrap' }}>{fmtDate(r.refundedAt)}</td>
                    <td style={{ padding:'11px 14px', fontSize:12, fontWeight:700, color:'rgba(248,250,252,0.52)', whiteSpace:'nowrap' }}>{r.orderId}</td>
                    <td style={{ padding:'11px 14px', maxWidth:130 }}><div style={{ fontSize:12.5, color:'#F8FAFC', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.customer}>{r.customer}</div>{r.customerEmail&&<div style={{ fontSize:10, color:'rgba(248,250,252,0.26)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.customerEmail}</div>}</td>
                    <td style={{ padding:'11px 14px', fontSize:12, color:'rgba(248,250,252,0.48)', maxWidth:160 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={(r.products||[]).join(', ')}>{(r.products||[]).join(', ')||'—'}</div></td>
                    <td style={{ padding:'11px 14px' }}><CatBadge cat={r.category} small/></td>
                    <td style={{ padding:'11px 14px', textAlign:'right', whiteSpace:'nowrap' }}><span style={{ fontSize:11, fontWeight:700, color:pc, background:pb, borderRadius:5, padding:'2px 8px', display:'inline-block' }}>{r.refundPct}%</span></td>
                    <td style={{ padding:'11px 0 11px 14px', textAlign:'right', fontSize:13, fontWeight:800, color:'#F87171', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', textShadow:'none' }}>{fmtEur(r.refundAmount)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {sorted.length>20&&!showAll&&(
            <div style={{ marginTop:16, textAlign:'center' }}>
              <button onClick={()=>setShowAll(true)} style={{ padding:'7px 20px', borderRadius:100, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(248,250,252,0.5)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.color='#F8FAFC'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.05)';e.currentTarget.style.color='rgba(248,250,252,0.5)'}}>Show all {sorted.length} refunds</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Product Refund Matrix ────────────────────────────────────────────────────

function ProductMatrix({ allRefunds, loaded }) {
  if(!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div className="sk" style={{ height:13, width:'35%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'25%', marginBottom:20 }}/>
      {[0,1,2,3,4].map(i=><div key={i} style={{ display:'flex', gap:14, marginBottom:12, alignItems:'center' }}><div className="sk" style={{ width:28, height:28, borderRadius:8, flexShrink:0 }}/><div className="sk" style={{ flex:1, height:13 }}/><div className="sk" style={{ width:60, height:13 }}/><div className="sk" style={{ width:55, height:13 }}/><div className="sk" style={{ width:70, height:13 }}/></div>)}
    </div>
  )
  const products = buildProductMatrix(allRefunds)
  if(products.length===0) return null
  const maxAmt=Math.max(...products.map(p=>p.amount),1)

  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .5s both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div><div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Product Refund Matrix</div><div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>All-time · products with 1+ refund · sorted by count</div></div>
        <div style={{ padding:'3px 12px', borderRadius:100, background:'rgba(161,117,252,0.08)', border:'1px solid rgba(161,117,252,0.2)', fontSize:11, fontWeight:700, color:'#A175FC' }}>{products.length} products</div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {['#','Product','Category','Refunds','Avg %','Amount Lost','Risk'].map((h,i)=>(
              <th key={h} style={{ textAlign:i>=3?'right':'left', fontSize:9.5, fontWeight:700, letterSpacing:'.08em', color:'rgba(248,250,252,0.25)', textTransform:'uppercase', padding:'0 0 12px', paddingLeft:i>0&&i<3?14:i>=3?14:0, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p,i)=>{
            const risk = p.count>=3?{ label:'High', color:'#F87171', bg:'rgba(248,113,113,0.1)', border:'rgba(248,113,113,0.25)' }:p.count===2?{ label:'Watch', color:'#FCD34D', bg:'rgba(252,211,77,0.1)', border:'rgba(252,211,77,0.22)' }:{ label:'Low', color:'#4ade80', bg:'rgba(74,222,128,0.08)', border:'rgba(74,222,128,0.2)' }
            const cc=CAT_COLORS[p.topCat]||CAT_COLORS.Other
            return (
              <tr key={p.name} className="matrix-row" style={{ borderBottom:i<products.length-1?'1px solid rgba(255,255,255,0.04)':'none' }}>
                <td style={{ padding:'11px 0', fontSize:12, fontWeight:700, color:'rgba(248,250,252,0.3)', width:28 }}>{i+1}</td>
                <td style={{ padding:'11px 14px' }}>
                  <div style={{ fontSize:12.5, color:'#F8FAFC', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }} title={p.name}>{p.name}</div>
                  <div style={{ marginTop:5, height:3, background:'rgba(255,255,255,0.05)', borderRadius:100, overflow:'hidden', maxWidth:180 }}>
                    <div className="bar-fill" style={{ height:'100%', width:`${(p.amount/maxAmt)*100}%`, background:`linear-gradient(90deg,#EF4444,rgba(161,117,252,0.7))`, borderRadius:100, animationDelay:`${i*.05}s` }}/>
                  </div>
                </td>
                <td style={{ padding:'11px 14px' }}><CatBadge cat={p.topCat} small/></td>
                <td style={{ padding:'11px 14px', textAlign:'right', fontSize:13, fontWeight:800, color:'#F87171', fontVariantNumeric:'tabular-nums' }}>{p.count}</td>
                <td style={{ padding:'11px 14px', textAlign:'right', fontSize:12, fontWeight:600, color:'rgba(248,250,252,0.5)', fontVariantNumeric:'tabular-nums' }}>{p.avgPct}%</td>
                <td style={{ padding:'11px 14px', textAlign:'right', fontSize:12.5, fontWeight:700, color:'rgba(248,250,252,0.65)', fontVariantNumeric:'tabular-nums' }}>{fmtEur(p.amount)}</td>
                <td style={{ padding:'11px 0 11px 14px', textAlign:'right' }}>
                  <span style={{ fontSize:10, fontWeight:700, color:risk.color, background:risk.bg, border:`1px solid ${risk.border}`, borderRadius:100, padding:'2px 9px' }}>{risk.label}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Repeat Refunders ─────────────────────────────────────────────────────────

function RepeatRefunders({ allRefunds, loaded }) {
  if(!loaded) return null
  const repeaters = buildRepeatRefunders(allRefunds)
  if(repeaters.length===0) return null

  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .55s both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC' }}>Repeat Refunders</div>
          </div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>Customers with 2+ refunds all-time — flag for review</div>
        </div>
        <div style={{ padding:'3px 12px', borderRadius:100, background:'rgba(252,211,77,0.08)', border:'1px solid rgba(252,211,77,0.22)', fontSize:11, fontWeight:700, color:'#FCD34D' }}>{repeaters.length} flagged</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {repeaters.map((c,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:11, background:'rgba(252,211,77,0.04)', border:'1px solid rgba(252,211,77,0.1)', transition:'background .15s' }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'rgba(252,211,77,0.1)', border:'1px solid rgba(252,211,77,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.customer}</div>
              {c.email&&<div style={{ fontSize:10.5, color:'rgba(248,250,252,0.35)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.email}</div>}
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#F87171', fontVariantNumeric:'tabular-nums' }}>{c.count}× refunded</div>
              <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)', marginTop:1 }}>{fmtEur(c.totalAmount)} total</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0, minWidth:80 }}>
              <div style={{ fontSize:10.5, color:'rgba(248,250,252,0.28)' }}>Last refund</div>
              <div style={{ fontSize:11, color:'rgba(248,250,252,0.45)', marginTop:1 }}>{fmtDateShort(c.lastRefund)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Breakdown panels ─────────────────────────────────────────────────────────

function RefundReasons({ refunds, loaded }) {
  const map={}; refunds.forEach(r=>{ const k=categorizeReason(r.reason); if(!map[k])map[k]={cat:k,count:0,amount:0}; map[k].count++; map[k].amount+=parseFloat(r.refundAmount||0) })
  const reasons=Object.values(map).sort((a,b)=>b.amount-a.amount)
  const mx=Math.max(...reasons.map(r=>r.amount),1)
  return (
    <div className="panel" style={{ flex:'1 1 0' }}>
      <div style={{ marginBottom:18 }}><div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Why refunds happen</div><div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>By total amount lost</div></div>
      {!loaded?<div style={{ display:'flex', flexDirection:'column', gap:14 }}>{[0,1,2,3,4].map(i=><div key={i} style={{ display:'flex', flexDirection:'column', gap:6 }}><div className="sk" style={{ height:11, width:`${50+i*9}%` }}/><div className="sk" style={{ height:5, borderRadius:100 }}/></div>)}</div>
      :reasons.length===0?<div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:'rgba(248,250,252,0.2)' }}>No data this period</div>
      :<div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {reasons.map((r,i)=>{ const cc=CAT_COLORS[r.cat]||CAT_COLORS.Other; return (
          <div key={r.cat}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:7, height:7, borderRadius:'50%', background:cc.color, flexShrink:0 }}/><span style={{ fontSize:12, color:'rgba(248,250,252,0.7)', fontWeight:500 }}>{r.cat}</span></div>
              <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}><span style={{ fontSize:11, color:'rgba(248,250,252,0.38)', fontVariantNumeric:'tabular-nums' }}>{fmtEur(r.amount)}</span><span style={{ fontSize:10, fontWeight:700, color:cc.color, background:cc.bg, borderRadius:5, padding:'1px 7px', border:`1px solid ${cc.border}` }}>{r.count}×</span></div>
            </div>
            <div style={{ height:5, background:'rgba(255,255,255,0.05)', borderRadius:100, overflow:'hidden' }}>
              <div className="bar-fill" style={{ height:'100%', width:`${(r.amount/mx)*100}%`, borderRadius:100, background:`linear-gradient(90deg,${cc.color},${cc.color}66)`, animationDelay:`${.08*i}s` }}/>
            </div>
          </div>
        )})}
      </div>}
    </div>
  )
}

function TopProducts({ refunds, loaded }) {
  const map={}; refunds.forEach(r=>{(r.products||[]).forEach(p=>{if(!map[p])map[p]={name:p,count:0,amount:0};map[p].count++;map[p].amount+=parseFloat(r.refundAmount||0)})})
  const products=Object.values(map).sort((a,b)=>b.amount-a.amount).slice(0,6)
  const mx=Math.max(...products.map(p=>p.amount),1)
  return (
    <div className="panel" style={{ flex:'1 1 0' }}>
      <div style={{ marginBottom:18 }}><div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Most refunded products</div><div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>By total value refunded</div></div>
      {!loaded?<div style={{ display:'flex', flexDirection:'column', gap:12 }}>{[0,1,2,3,4].map(i=><div key={i} style={{ display:'flex', gap:12, alignItems:'center' }}><div className="sk" style={{ width:30, height:30, borderRadius:8, flexShrink:0 }}/><div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}><div className="sk" style={{ height:11, width:'75%' }}/><div className="sk" style={{ height:4, borderRadius:100 }}/></div><div className="sk" style={{ height:11, width:45, flexShrink:0 }}/></div>)}</div>
      :products.length===0?<div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:'rgba(248,250,252,0.2)' }}>No data this period</div>
      :<div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {products.map((p,i)=>(
          <div key={p.name} className="tbl-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0' }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#EF4444', flexShrink:0 }}>{i+1}</div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <div style={{ fontSize:12.5, color:'#F8FAFC', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:5 }} title={p.name}>{p.name}</div>
              <div style={{ height:4, background:'rgba(255,255,255,0.05)', borderRadius:100, overflow:'hidden' }}>
                <div className="bar-fill" style={{ height:'100%', width:`${(p.amount/mx)*100}%`, background:'linear-gradient(90deg,#EF4444,rgba(161,117,252,0.7))', borderRadius:100, animationDelay:`${.06*i}s` }}/>
              </div>
            </div>
            <div style={{ flexShrink:0, textAlign:'right' }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:'#EF4444', fontVariantNumeric:'tabular-nums' }}>{fmtEur(p.amount)}</div>
              <div style={{ fontSize:10, color:'rgba(248,250,252,0.32)', marginTop:1 }}>{p.count}× refunded</div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  )
}

// ─── Weekly Report ────────────────────────────────────────────────────────────

function WeeklyReport({ allRefunds, loaded }) {
  if(!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}><div className="sk" style={{ height:13, width:'25%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'18%', marginBottom:20 }}/><div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>{[0,1,2,3].map(i=><div key={i} className="sk" style={{ height:100, borderRadius:12 }}/>)}</div></div>
  )
  const weeks = buildWeeklyReport(allRefunds)
  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .65s both' }}>
      <div style={{ marginBottom:18 }}><div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Weekly Overview</div><div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>Last 4 weeks (Sun–Sat) · all refunds</div></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {weeks.map((w,i)=>{ const cc=w.topReason?(CAT_COLORS[w.topReason]||CAT_COLORS.Other):null; return (
          <div key={i} style={{ borderRadius:13, padding:'14px 16px', background:w.isCurrentWeek?'rgba(161,117,252,0.07)':'rgba(255,255,255,0.025)', border:`1px solid ${w.isCurrentWeek?'rgba(161,117,252,0.22)':'rgba(255,255,255,0.06)'}`, boxShadow:w.isCurrentWeek?'0 0 20px rgba(161,117,252,0.06)':'none' }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:w.isCurrentWeek?'#C3A3FF':'rgba(248,250,252,0.38)', letterSpacing:'.04em', marginBottom:10, textTransform:'uppercase' }}>{w.label}</div>
            <div style={{ fontSize:24, fontWeight:800, color:w.refundCount===0?'#4ade80':'#F87171', letterSpacing:'-0.04em', marginBottom:2, fontVariantNumeric:'tabular-nums', textShadow:'none' }}>{w.refundCount}</div>
            <div style={{ fontSize:10, color:'rgba(248,250,252,0.28)', marginBottom:10 }}>refund{w.refundCount!==1?'s':''}</div>
            {w.refundCount>0&&<><div style={{ fontSize:12.5, fontWeight:700, color:'rgba(248,250,252,0.65)', fontVariantNumeric:'tabular-nums', marginBottom:8 }}>{fmtEur(w.totalAmount)} lost</div>{w.topReason&&<div style={{ marginBottom:4 }}><CatBadge cat={w.topReason} small/></div>}{w.topProduct&&<div style={{ fontSize:10, color:'rgba(248,250,252,0.28)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:4 }} title={w.topProduct}>{w.topProduct}</div>}</>}
            {w.refundCount===0&&<div style={{ fontSize:10.5, color:'rgba(74,222,128,0.55)' }}>No refunds</div>}
          </div>
        )})}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [kpis,setKpis]=useState({})
  const [prevKpis,setPrevKpis]=useState({})
  const [refunds,setRefunds]=useState([])
  const [allRefunds,setAllRefunds]=useState([])
  const [trend,setTrend]=useState([])
  const [insights,setInsights]=useState([])
  const [actionStatuses,setActionStatuses]=useState({})
  const [usingFallback,setUsingFallback]=useState(false)
  const [dateRange,setDateRange]=useState('month')
  const [customFrom,setCustomFrom]=useState('')
  const [customTo,setCustomTo]=useState('')
  const [loaded,setLoaded]=useState({ kpis:false, prevKpis:false, refunds:false, allRefunds:false, trend:false, insights:false })
  const [mounted,setMounted]=useState(false)
  const tokenRef=useRef(null)

  useEffect(()=>{
    setMounted(true)
    supabase.auth.getSession().then(({ data:{ session } })=>{
      if(!session){ window.location.href='/login'; return }
      tokenRef.current=session.access_token
      fetchAll(session.access_token,'month')
      fetchAllTimeRefunds(session.access_token)
      fetchActionStatuses(session.access_token)
    })
  },[])

  async function fetchActionStatuses(token) {
    try {
      const res=await fetch('/api/analytics/actions',{ headers:{ Authorization:`Bearer ${token}` } })
      if(!res.ok){ setUsingFallback(true); loadLS(); return }
      const d=await res.json()
      if(d.fallback){ setUsingFallback(true); loadLS() } else setActionStatuses(d.actions||{})
    } catch { setUsingFallback(true); loadLS() }
  }
  function loadLS(){ try{ const s=localStorage.getItem('lynq-action-statuses'); if(s)setActionStatuses(JSON.parse(s)) }catch{} }

  async function handleStatusChange(id, status, pickedUpBy, resultNote) {
    const next={ ...actionStatuses, [id]:{ status, pickedUpBy:pickedUpBy||null, pickedUpAt:status==='picked_up'?new Date().toISOString():null, resultNote:resultNote||null } }
    setActionStatuses(next)
    if(usingFallback){ try{ localStorage.setItem('lynq-action-statuses',JSON.stringify(next)) }catch{}; return }
    try{ await fetch('/api/analytics/actions',{ method:'PATCH', headers:{ Authorization:`Bearer ${tokenRef.current}`,'Content-Type':'application/json' }, body:JSON.stringify({ id, status, pickedUpBy, resultNote }) }) }catch{}
  }

  async function fetchAllTimeRefunds(token) {
    const from=new Date(Date.now()-365*86400000).toISOString().slice(0,10), to=new Date().toISOString().slice(0,10)
    try{ const res=await fetch(`/api/shopify/refunds?from=${from}&to=${to}`,{ headers:{ Authorization:`Bearer ${token}` } }); if(res.ok){ const d=await res.json(); setAllRefunds(d.refunds||[]) } }catch{}
    setLoaded(p=>({...p,allRefunds:true}))
  }

  async function fetchInsights(token, refundsData) {
    if(refundsData.length===0){ setLoaded(p=>({...p,insights:true})); return }
    try{ const res=await fetch('/api/analytics/refund-insights',{ method:'POST', headers:{ Authorization:`Bearer ${token}`,'Content-Type':'application/json' }, body:JSON.stringify({ refunds:refundsData }) }); if(res.ok){ const d=await res.json(); setInsights(d.insights||[]) } }catch{}
    setLoaded(p=>({...p,insights:true}))
  }

  function fetchAll(token, rangeId, explicitFrom, explicitTo) {
    const { from, to }=(explicitFrom&&explicitTo)?{ from:explicitFrom, to:explicitTo }:getDateRange(rangeId)
    const prevR=getPrevDateRange(rangeId)
    const headers={ Authorization:`Bearer ${token}` }
    const q=`from=${from}&to=${to}`
    setLoaded(p=>({...p,kpis:false,prevKpis:false,refunds:false,trend:false,insights:false}))
    setInsights([])

    fetch(`/api/shopify/kpis?${q}`,{ headers }).then(r=>r.ok?r.json():{}).then(d=>{ setKpis(d); setLoaded(p=>({...p,kpis:true})) }).catch(()=>setLoaded(p=>({...p,kpis:true})))
    fetch(`/api/shopify/kpis?from=${prevR.from}&to=${prevR.to}`,{ headers }).then(r=>r.ok?r.json():{}).then(d=>{ setPrevKpis(d); setLoaded(p=>({...p,prevKpis:true})) }).catch(()=>setLoaded(p=>({...p,prevKpis:true})))
    fetch(`/api/shopify/refunds?${q}`,{ headers }).then(r=>r.ok?r.json():{}).then(d=>{ const data=d.refunds||[]; setRefunds(data); setLoaded(p=>({...p,refunds:true})); fetchInsights(token,data) }).catch(()=>setLoaded(p=>({...p,refunds:true,insights:true})))
    fetch(`/api/shopify/revenue-trend?${q}`,{ headers }).then(r=>r.ok?r.json():{ trend:[] }).then(d=>{ setTrend(d.trend||[]); setLoaded(p=>({...p,trend:true})) }).catch(()=>setLoaded(p=>({...p,trend:true})))
  }

  function selectRange(id){ setDateRange(id); if(id!=='custom'&&tokenRef.current)fetchAll(tokenRef.current,id) }
  function applyCustomRange(from, to){ if(from&&to&&from<=to&&tokenRef.current)fetchAll(tokenRef.current,'custom',from,to) }

  if(!mounted) return null

  const allLoaded=loaded.kpis&&loaded.refunds&&loaded.trend
  const rangeLabel=dateRange==='custom'&&customFrom&&customTo?`${customFrom} → ${customTo}`:RANGES.find(r=>r.id===dateRange)?.label||'This month'
  const noRefunds=loaded.refunds&&refunds.length===0
  const patternActions=loaded.allRefunds?generatePatternActions(allRefunds):[]
  const actionLoaded=loaded.insights&&loaded.allRefunds

  return (
    <div className="an-root" style={{ display:'flex', minHeight:'100vh', background:'#0B0819' }}>
      <style>{CSS}</style>
      <Sidebar/>
      <main className="an-scroll" style={{ flex:1, overflowY:'auto', padding:'36px 44px', position:'relative' }}>
        <AuroraBackground/>
        <div style={{ position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom:28, animation:'revealUp .5s ease-out 0s both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h1 style={{ fontSize:28, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.04em', lineHeight:1.15, marginBottom:5, textShadow:'none' }}>Refund Intelligence</h1>
                <p style={{ fontSize:12.5, color:'rgba(248,250,252,0.35)' }}>Where money is lost · {rangeLabel}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', borderRadius:100, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(10px)' }}>
                {!allLoaded?<Spinner size={14}/>:<div style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px rgba(74,222,128,0.5)', animation:'glowPulse 2s ease-in-out infinite' }}/>}
                <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.09em', color:'rgba(248,250,252,0.4)', textTransform:'uppercase' }}>{allLoaded?'Live':'Loading…'}</span>
              </div>
            </div>
            <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(161,117,252,0.3),transparent)', margin:'20px 0 16px' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              {RANGES.map(r=>(
                <button key={r.id} onClick={()=>selectRange(r.id)} className="range-pill" style={{ background:dateRange===r.id?'rgba(161,117,252,0.18)':'rgba(255,255,255,0.05)', color:dateRange===r.id?'#C3A3FF':'rgba(248,250,252,0.42)', boxShadow:dateRange===r.id?'inset 0 0 0 1px rgba(161,117,252,0.4),0 0 12px rgba(161,117,252,0.08)':'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>{r.label}</button>
              ))}
              {dateRange==='custom'&&(
                <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:4 }}>
                  <input type="date" className="date-inp" value={customFrom} max={customTo||undefined} onChange={e=>{ const v=e.target.value; setCustomFrom(v); applyCustomRange(v,customTo) }}/>
                  <span style={{ fontSize:11, color:'rgba(248,250,252,0.28)' }}>→</span>
                  <input type="date" className="date-inp" value={customTo} min={customFrom||undefined} max={new Date().toISOString().slice(0,10)} onChange={e=>{ const v=e.target.value; setCustomTo(v); applyCustomRange(customFrom,v) }}/>
                </div>
              )}
            </div>
          </div>

          {/* Sync banner */}
          {loaded.kpis&&kpis.needsSync&&(
            <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(161,117,252,0.07)', border:'1px solid rgba(161,117,252,0.18)', borderRadius:14, padding:'12px 18px', marginBottom:24, animation:'revealUp .4s ease-out both' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A175FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, fontWeight:700, color:'#A175FC', marginRight:8 }}>Sync required</span><span style={{ fontSize:12, color:'rgba(248,250,252,0.55)' }}>No order data found. Go to Settings → Shopify to sync your orders.</span></div>
            </div>
          )}

          <AlertBanner rate={kpis.refundRate} loaded={loaded.kpis}/>
          <KpiRow kpis={kpis} prevKpis={prevKpis} refunds={refunds} loaded={loaded}/>
          <RevenueTrendChart trend={trend} loaded={loaded.trend} rangeLabel={rangeLabel}/>

          {/* Donut + Monthly side by side */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24, animation:'revealUp .5s ease-out .3s both' }}>
            <DonutReasonChart refunds={refunds} loaded={loaded.refunds}/>
            <MonthlyTrendChart allRefunds={allRefunds} loaded={loaded.allRefunds}/>
          </div>

          <ActionBoard patternActions={patternActions} aiInsights={insights} noRefunds={noRefunds} loaded={actionLoaded} onStatusChange={handleStatusChange} statuses={actionStatuses} usingFallback={usingFallback}/>
          <RefundTable refunds={refunds} loaded={loaded.refunds}/>
          <ProductMatrix allRefunds={allRefunds} loaded={loaded.allRefunds}/>
          <RepeatRefunders allRefunds={allRefunds} loaded={loaded.allRefunds}/>

          {!noRefunds&&(
            <div style={{ display:'flex', gap:16, marginBottom:24, animation:'revealUp .5s ease-out .6s both' }}>
              <RefundReasons refunds={refunds} loaded={loaded.refunds}/>
              <TopProducts refunds={refunds} loaded={loaded.refunds}/>
            </div>
          )}
          {!loaded.refunds&&(
            <div style={{ display:'flex', gap:16, marginBottom:24 }}>
              <div className="panel" style={{ flex:'1 1 0' }}><div className="sk" style={{ height:13, width:'45%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'30%', marginBottom:20 }}/>{[0,1,2,3,4].map(i=><div key={i} style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}><div className="sk" style={{ height:11, width:`${60+i*7}%` }}/><div className="sk" style={{ height:5, borderRadius:100 }}/></div>)}</div>
              <div className="panel" style={{ flex:'1 1 0' }}><div className="sk" style={{ height:13, width:'50%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'35%', marginBottom:20 }}/>{[0,1,2,3,4].map(i=><div key={i} style={{ display:'flex', gap:10, marginBottom:12 }}><div className="sk" style={{ width:30, height:30, borderRadius:8, flexShrink:0 }}/><div style={{ flex:1 }}><div className="sk" style={{ height:11, width:'75%', marginBottom:5 }}/><div className="sk" style={{ height:4, borderRadius:100 }}/></div></div>)}</div>
            </div>
          )}

          <WeeklyReport allRefunds={allRefunds} loaded={loaded.allRefunds}/>

          <div style={{ marginTop:16, textAlign:'center', fontSize:10.5, color:'rgba(248,250,252,0.12)', letterSpacing:'.04em' }}>
            Lynq Analytics · Shopify data · AI by Claude · Refreshed on load
          </div>
        </div>
      </main>
    </div>
  )
}
