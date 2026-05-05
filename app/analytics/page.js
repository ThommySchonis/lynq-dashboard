'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import EmptyState from '../components/EmptyState'
import { DEMO_REFUNDS, DEMO_KPIS, DEMO_TREND, DEMO_INSIGHTS } from '../../lib/demoData'

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
  'Sizing':           { color:'#B45309', bg:'#FFFBEB', border:'rgba(245,158,11,0.22)', chartColor:'#F59E0B'  },
  'Damaged':          { color:'#B91C1C', bg:'#FEF2F2', border:'rgba(239,68,68,0.22)',  chartColor:'#EF4444'  },
  'Quality':          { color:'#6D28D9', bg:'#F5F3FF', border:'rgba(139,92,246,0.22)', chartColor:'#8B5CF6'  },
  'Not as described': { color:'#065F46', bg:'#ECFDF5', border:'rgba(16,185,129,0.22)', chartColor:'#10B981'  },
  'Changed mind':     { color:'#374151', bg:'#F9FAFB', border:'rgba(107,114,128,0.22)',chartColor:'#6B7280'  },
  'Other':            { color:'#6B7280', bg:'#F9FAFB', border:'rgba(107,114,128,0.15)',chartColor:'#9CA3AF'  },
  'Customer Outreach':{ color:'#1D4ED8', bg:'#EFF6FF', border:'rgba(59,130,246,0.22)', chartColor:'#3B82F6'  },
  'Supplier':         { color:'#B45309', bg:'#FFFBEB', border:'rgba(245,158,11,0.22)', chartColor:'#F59E0B'  },
  'Listing Fix':      { color:'#065F46', bg:'#ECFDF5', border:'rgba(16,185,129,0.22)', chartColor:'#10B981'  },
  'Quality Control':  { color:'#6D28D9', bg:'#F5F3FF', border:'rgba(139,92,246,0.22)', chartColor:'#8B5CF6'  },
  'Operations':       { color:'#374151', bg:'#F9FAFB', border:'rgba(107,114,128,0.2)', chartColor:'#9CA3AF'  },
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

function generateRepeatRefunderActions(allRefunds) {
  const map = {}
  allRefunds.forEach(r => {
    const k = r.customerEmail || r.customer
    if (!k) return
    if (!map[k]) map[k] = { customer: r.customer, email: r.customerEmail, refunds: [], totalAmount: 0 }
    map[k].refunds.push(r)
    map[k].totalAmount += parseFloat(r.refundAmount || 0)
  })
  return Object.values(map)
    .filter(c => c.refunds.length >= 2)
    .sort((a, b) => b.refunds.length - a.refunds.length)
    .slice(0, 3)
    .map(c => {
      const name = c.customer || c.email || 'Unknown customer'
      const n = c.refunds.length
      return {
        id: `repeat-${(c.email||c.customer||Math.random()).toString().replace(/\s+|@|\./g,'-').toLowerCase()}`,
        type: 'pattern',
        priority: n >= 3 ? 'high' : 'medium',
        category: 'Customer Outreach',
        refundCount: n,
        totalAmount: c.totalAmount,
        title: `Contact repeat refunder: ${name}`,
        action: `${name} has refunded ${n} times (${fmtEur(c.totalAmount)} total lost). Reach out personally — offer store credit or a free exchange to retain the customer and eliminate chargeback risk.`,
      }
    })
}

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

// ─── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const end = parseFloat(value) || 0
    if (end === 0) { setDisplay(0); return }
    const duration = 1200
    const step = end / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setDisplay(end); clearInterval(timer) }
      else setDisplay(start)
    }, 16)
    return () => clearInterval(timer)
  }, [value])
  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()
  return <span>{prefix}{formatted}{suffix}</span>
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{from{background-position:-400% 0}to{background-position:400% 0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @keyframes barGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}

  .an-root *{box-sizing:border-box;margin:0;padding:0}
  .an-root{font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased}
  .an-scroll::-webkit-scrollbar{width:3px}
  .an-scroll::-webkit-scrollbar-track{background:transparent}
  .an-scroll::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:2px}

  .date-inp{background:#F5F5F5;border:1px solid rgba(0,0,0,0.08);border-radius:7px;color:#111111;padding:4px 10px;font-size:11.5px;font-family:inherit;cursor:pointer;outline:none;transition:border-color .15s}
  .date-inp:focus{border-color:rgba(0,0,0,0.18)}
  .date-inp::-webkit-calendar-picker-indicator{cursor:pointer}

  .kpi-card{
    background:rgba(255,255,255,0.80);
    backdrop-filter:blur(12px);
    -webkit-backdrop-filter:blur(12px);
    border:1px solid rgba(255,255,255,0.65);
    border-radius:10px;
    padding:18px 20px;
    position:relative;overflow:hidden;
    box-shadow:0 2px 16px rgba(0,0,0,0.05);
    transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease;
    cursor:default;
  }
  .kpi-card:hover{border-color:rgba(255,255,255,0.9);box-shadow:0 8px 32px rgba(0,0,0,0.08);transform:translateY(-1px)}

  .panel{
    background:rgba(255,255,255,0.80);
    backdrop-filter:blur(12px);
    -webkit-backdrop-filter:blur(12px);
    border:1px solid rgba(255,255,255,0.65);
    border-radius:12px;
    padding:22px 24px;
    margin-bottom:16px;
    box-shadow:0 2px 12px rgba(0,0,0,0.04);
    transition:box-shadow .2s ease;
  }
  .panel:hover{box-shadow:0 8px 28px rgba(0,0,0,0.07)}

  .action-card{border-radius:8px;background:rgba(255,255,255,0.75);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.6);padding:12px 14px;margin-bottom:6px;cursor:pointer;transition:all 0.15s ease;box-shadow:0 1px 6px rgba(0,0,0,0.04)}
  .action-card:hover{background:rgba(255,255,255,0.92);border-color:rgba(255,255,255,0.85);box-shadow:0 4px 16px rgba(0,0,0,0.07);transform:translateY(-1px)}
  .action-card.done-card{opacity:.45}

  .tab-btn{padding:4px 14px;border-radius:100px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid transparent;font-family:inherit;transition:all .15s ease}
  .range-pill{padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s ease}
  .filter-pill{padding:4px 12px;border-radius:100px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;font-family:inherit;transition:all .15s ease;white-space:nowrap}
  .tbl-row{transition:background .15s ease;cursor:default}
  .tbl-row:hover{background:#FAFAFA}

  .sk{background:linear-gradient(90deg,var(--skeleton-from) 25%,var(--skeleton-to) 50%,var(--skeleton-from) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px}
  .bar-fill{transform-origin:left;animation:growX .6s cubic-bezier(.34,1.56,.64,1) both}
  .bar-col{transform-origin:bottom;animation:barGrow .5s cubic-bezier(.34,1.56,.64,1) both}

  .btn-pickup{padding:5px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid rgba(0,0,0,0.08);font-family:inherit;background:#F3F4F6;color:#374151;transition:all .15s}
  .btn-pickup:hover{background:#E5E7EB}
  .btn-done{padding:5px 14px;border-radius:100px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid rgba(21,128,61,0.25);font-family:inherit;background:#F0FDF4;color:#15803D;transition:all .15s}
  .btn-done:hover{background:#DCFCE7}
  .btn-reopen{padding:4px 11px;border-radius:100px;font-size:11px;font-weight:500;cursor:pointer;border:1px solid rgba(0,0,0,0.08);font-family:inherit;background:transparent;color:#888888;transition:all .15s}
  .btn-reopen:hover{background:#F5F5F5;color:#555555}
  .name-inp{background:#F5F5F5;border:1px solid rgba(0,0,0,0.08);border-radius:7px;color:#111111;padding:4px 10px;font-size:11.5px;font-family:inherit;outline:none;transition:border-color .15s;width:140px}
  .name-inp:focus{border-color:rgba(0,0,0,0.18)}
  .name-inp::placeholder{color:#BDBDBD}

  .matrix-row{transition:background .15s}
  .matrix-row:hover{background:#FAFAFA}
`

// ─── Aurora + Grid ────────────────────────────────────────────────────────────

function PageBackground() {
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
    </div>
  )
}

function Spinner({ size=18 }) {
  return <div style={{ width:size, height:size, border:`2px solid var(--border)`, borderTop:`2px solid #111111`, borderRadius:'50%', animation:'spin .7s linear infinite', flexShrink:0 }}/>
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

function AlertBanner({ rate, loaded }) {
  if(!loaded) return null
  const r=parseFloat(rate||0); if(r<5) return null
  const isCrit=r>=20
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, background:'linear-gradient(135deg,#FEF2F2,#FFF5F5)', border:'1px solid rgba(220,38,38,0.15)', borderLeft:'3px solid #DC2626', borderRadius:10, padding:'12px 16px', marginBottom:16, animation:'fadeIn .4s ease-out both' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span style={{ fontSize:12, fontWeight:600, color:'#DC2626', marginRight:4 }}>{isCrit?'Critical':'Warning'}:</span>
      <span style={{ fontSize:12, color:'#DC2626', lineHeight:1.5 }}>
        {isCrit?`Refund rate ${r}% — industry average is 2–5%. Immediate action required.`:`Refund rate ${r}% is above the 2–5% benchmark.`}
      </span>
    </div>
  )
}

// ─── KPI Row ──────────────────────────────────────────────────────────────────

const BADGE_COLORS = {
  'Sizing':           { bg:'rgba(245,158,11,0.08)', color:'#D97706', border:'none' },
  'Damaged':          { bg:'rgba(239,68,68,0.08)',  color:'#DC2626', border:'1px solid rgba(239,68,68,0.15)' },
  'Quality':          { bg:'rgba(139,92,246,0.08)', color:'#7C3AED', border:'none' },
  'Quality Control':  { bg:'rgba(139,92,246,0.08)', color:'#7C3AED', border:'none' },
  'Not as described': { bg:'rgba(16,185,129,0.08)', color:'#059669', border:'none' },
  'Changed mind':     { bg:'#F5F5F5',               color:'#555555', border:'none' },
  'Customer Outreach':{ bg:'rgba(59,130,246,0.08)', color:'#2563EB', border:'none' },
  'Supplier':         { bg:'rgba(16,185,129,0.08)', color:'#059669', border:'none' },
  'Listing Fix':      { bg:'rgba(16,185,129,0.08)', color:'#059669', border:'none' },
  'Operations':       { bg:'#F5F5F5',               color:'#555555', border:'none' },
  'Other':            { bg:'#F5F5F5',               color:'#555555', border:'none' },
}

function CatBadge({ cat, small }) {
  const c = BADGE_COLORS[cat] || BADGE_COLORS['Other']
  return <span style={{ display:'inline-block', fontSize:small?9.5:10.5, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:c.color, background:c.bg, border:c.border||'none', borderRadius:100, padding:small?'1px 7px':'2px 9px', whiteSpace:'nowrap' }}>{cat}</span>
}

function DeltaBadge({ delta, lowerIsBetter=true }) {
  if(!delta) return null
  const improved = lowerIsBetter ? delta.pct<0 : delta.pct>0
  const color = improved?'#10B981':'#DC2626'
  const arrow = delta.pct>0?'↑':'↓'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, fontWeight:500, color, letterSpacing:'.01em' }}>
      <span>{arrow}</span>
      <span>{Math.abs(delta.pct).toFixed(1)}%</span>
      <span style={{ opacity:.55, fontSize:11, fontWeight:400, color:'#888888' }}>vs prev</span>
    </div>
  )
}

function KpiCardInner({ c, index, loaded }) {
  const animCount = useCountUp(index === 0 ? Math.round(c.rawValue * 100) : index === 2 ? Math.round(c.rawValue * 10) : index === 3 ? Math.round(c.rawValue * 100) : c.rawValue)
  let displayVal
  if (index === 0) displayVal = `€${(animCount / 100).toFixed(2)}`
  else if (index === 1) displayVal = animCount.toLocaleString()
  else if (index === 2) displayVal = `${(animCount / 10).toFixed(1)}%`
  else displayVal = `€${(animCount / 100).toFixed(2)}`

  return (
    <div
      className={`animate-fade-in-${index + 1}`}
      style={{ background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.07)', borderRadius:'10px', padding:'18px 20px', position:'relative', overflow:'hidden', transition:'all 0.2s ease' }}
    >
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'#BDBDBD' }}>{c.label}</div>
        <div style={{ width:30, height:30, borderRadius:7, background:'rgba(161,117,252,0.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9B91A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
        </div>
      </div>
      <div style={{ fontSize:24, fontWeight:700, color:'#111111', lineHeight:1, marginBottom:8, fontVariantNumeric:'tabular-nums' }}>{displayVal}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ fontSize:11, color:'#888888' }}>{c.sub}</div>
        <DeltaBadge delta={loaded.prevKpis?c.delta:null} lowerIsBetter={c.lowerBetter}/>
      </div>
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

  const isHealthy = rate===0&&loaded.kpis&&loaded.refunds

  if(!loaded.kpis&&!loaded.refunds) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {[0,1,2,3].map(i=><div key={i} className="kpi-card" style={{ animation:'fadeIn .3s ease-out both' }}><div className="sk" style={{ height:11, width:'55%', marginBottom:14 }}/><div className="sk" style={{ height:30, width:'70%', marginBottom:8 }}/><div className="sk" style={{ height:9, width:'85%' }}/></div>)}
    </div>
  )

  const cards = [
    { label:'REFUNDS THIS PERIOD', rawValue:totalRef, sub:`${count} refunded order${count!==1?'s':''}`, delta:computeDelta(totalRef, prevRef), lowerBetter:true, accent:'#EF4444', accentBg:'rgba(239,68,68,0.06)', metricGradient:'linear-gradient(90deg, #EF4444, #F87171)', icon:<><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></> },
    { label:'TOTAL REFUNDS',       rawValue:count,    sub:'fully or partially refunded',               delta:computeDelta(count, prevCount),   lowerBetter:true, accent:'#F59E0B', accentBg:'rgba(245,158,11,0.06)', metricGradient:'linear-gradient(90deg, #F59E0B, #FCD34D)', icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></> },
    { label:'REFUND RATE',         rawValue:rate,     sub:isHealthy?'Below average':rate>5?`${(rate/2.5).toFixed(1)}× above avg`:'Industry avg: 2–5%', delta:computeDelta(rate, prevRate), lowerBetter:true, accent:'#8B5CF6', accentBg:'rgba(139,92,246,0.06)', metricGradient:'linear-gradient(90deg, #8B5CF6, #A78BFA)', icon:<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
    { label:'AVG REFUND',          rawValue:avg,      sub:'per refunded order',                        delta:computeDelta(avg, prevAvg),       lowerBetter:true, accent:'#10B981', accentBg:'rgba(16,185,129,0.06)', metricGradient:'linear-gradient(90deg, #10B981, #34D399)', icon:<><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></> },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
      {cards.map((c,i)=>(
        <KpiCardInner key={c.label} c={c} index={i} loaded={loaded}/>
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
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div><div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Revenue Trend</div><div style={{ fontSize:11, color:'var(--text-3)' }}>{rangeLabel} · daily net revenue</div></div>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--text-1)', letterSpacing:'-0.02em' }}>{fmtEur(tot)}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', overflow:'visible' }} aria-hidden>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.06"/><stop offset="100%" stopColor="#10B981" stopOpacity="0"/></linearGradient>
        </defs>
        {[0,.5,1].map((s,i)=>{ const y=pT+s*(H-pT-pB); return <line key={i} x1={pL} y1={y} x2={W-pR} y2={y} stroke="rgba(0,0,0,0.04)" strokeWidth="1"/> })}
        <polygon points={area} fill="url(#tg)"/>
        <polyline points={line} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.filter(p=>p.revenue>0).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#10B981"/>)}
        {xlbls.map((p,i)=><text key={i} x={p.x} y={H} textAnchor="middle" fontSize="9" fill="#BDBDBD" fontFamily="'Switzer', sans-serif">{new Date(p.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</text>)}
        {[0,mx/2,mx].map((v,i)=>{ const y=pT+(1-v/mx)*(H-pT-pB); const lbl=v>=1000?`€${(v/1000).toFixed(1)}k`:`€${Math.round(v)}`; return <text key={i} x={pL-6} y={y+3} textAnchor="end" fontSize="9" fill="#BDBDBD" fontFamily="'Switzer', sans-serif">{lbl}</text> })}
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
      <div style={{ fontSize:13, color:'var(--text-3)' }}>No refund reasons this period</div>
    </div>
  )
  const segments=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>({ cat, val, color:(CAT_COLORS[cat]||CAT_COLORS.Other).chartColor, pct:((val/total)*100).toFixed(0) }))
  const r=58, C=2*Math.PI*r
  let cum=0
  const slices=segments.map(s=>{ const dashLen=(s.val/total)*C-1.5; const offset=-cum; cum+=(s.val/total)*C; return { ...s, dashLen:Math.max(dashLen,0), offset } })

  return (
    <div className="panel" style={{ flex:'1 1 0' }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Refund Reasons</div>
        <div style={{ fontSize:11, color:'var(--text-3)' }}>Distribution this period</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:24 }}>
        {/* Donut */}
        <div style={{ position:'relative', flexShrink:0, width:130, height:130 }}>
          <svg viewBox="0 0 130 130" style={{ width:130, height:130, transform:'rotate(-90deg)' }} aria-hidden>
            <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="18"/>
            {slices.map((s,i)=>(
              <circle key={i} cx="65" cy="65" r={r} fill="none" stroke={s.color} strokeWidth="18"
                strokeDasharray={`${s.dashLen} ${C}`} strokeDashoffset={s.offset} strokeLinecap="butt"
                style={{ filter:'none' }}
              />
            ))}
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.04em', lineHeight:1 }}>{total}</div>
            <div style={{ fontSize:9.5, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>refunds</div>
          </div>
        </div>
        {/* Legend */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          {segments.map((s,i)=>(
            <div key={s.cat} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }}/>
                <span style={{ fontSize:11.5, color:'#555555', fontWeight:500 }}>{s.cat}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
                <span style={{ fontSize:11, color:'#888888', fontVariantNumeric:'tabular-nums' }}>{s.val}×</span>
                <span style={{ fontSize:11, fontWeight:600, color:'#111111', minWidth:28, textAlign:'right' }}>{s.pct}%</span>
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
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Monthly Refunds</div>
          <div style={{ fontSize:11, color:'var(--text-3)' }}>Last 6 months — count + amount</div>
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:'#DC2626' }}>{fmtEur(totalLost)}</div>
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:110 }}>
        {months.map((m,i)=>{
          const barH = maxCount>0 ? Math.max((m.count/maxCount)*100,m.count>0?8:0) : 0
          const isMax = m.count===maxCount&&m.count>0
          return (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'100%', gap:5 }}>
              <div style={{ fontSize:10, fontWeight:700, color:m.count>0?'#555555':'#BDBDBD', fontVariantNumeric:'tabular-nums' }}>{m.count>0?m.count:''}</div>
              <div style={{ width:'100%', borderRadius:'4px 4px 0 0', position:'relative', overflow:'hidden',
                background:m.isCurrentMonth?'rgba(0,0,0,0.06)':'rgba(0,0,0,0.03)',
                border:'none',
                height:`${Math.max(barH,4)}%`, minHeight:4, transition:'height .3s ease',
              }}>
                {m.count>0&&<div className="bar-col" style={{ position:'absolute', inset:0, background:m.isCurrentMonth?'#111111':'#E0E0E0', animationDelay:`${i*.06}s` }}/>}
              </div>
              <div style={{ fontSize:10, color:m.isCurrentMonth?'var(--text-1)':'var(--text-3)', fontWeight:m.isCurrentMonth?700:400 }}>{m.label}</div>
            </div>
          )
        })}
      </div>
      {/* Amount sparkline */}
      <svg viewBox="0 0 300 28" style={{ width:'100%', marginTop:12 }} aria-hidden>
        {months.map((m,i)=>{ const x=(i/(months.length-1))*280+10; const y=28-(m.amount/maxAmt)*22-3; return <circle key={i} cx={x} cy={y} r="2.5" fill="#DC2626"/> })}
        <polyline points={months.map((m,i)=>{ const x=(i/(months.length-1))*280+10; const y=28-(m.amount/maxAmt)*22-3; return `${x},${y}` }).join(' ')} fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
  const allItems=noRefunds?[...patternActions]:[...patternActions,...aiItems]
  const getStatus=id=>statuses[id]?.status||'open'
  const openItems=allItems.filter(a=>getStatus(a.id)==='open')
  const pickupItems=allItems.filter(a=>getStatus(a.id)==='picked_up')
  const doneItems=allItems.filter(a=>getStatus(a.id)==='done')
  const tabItems=activeTab==='open'?openItems:activeTab==='picked_up'?pickupItems:doneItems

  if(!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}><Spinner size={16}/><div style={{ fontSize:14, fontWeight:700, color:'var(--text-2)' }}>Analysing refund patterns…</div></div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{[0,1,2,3].map(i=><div key={i} className="sk" style={{ height:80, borderRadius:12 }}/>)}</div>
    </div>
  )


  return (
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            {noRefunds
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
            <span style={{ fontSize:15, fontWeight:700, color:'var(--text-1)' }}>{noRefunds?'No refunds — stay ahead':'Action Board'}</span>
            {!noRefunds&&<span style={{ fontSize:11, color:'var(--text-3)' }}>— {allItems.length} action{allItems.length!==1?'s':''}{patternActions.length>0&&` · ${patternActions.length} pattern-detected`}</span>}
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)' }}>{noRefunds?'No refunds in this period — all clear':'Real-time tasks based on your refund data — assign to your team'}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {usingFallback&&<div style={{ fontSize:10, color:'var(--text-3)', padding:'3px 9px', borderRadius:100, border:'1px solid var(--border)' }}>Local only</div>}
          {!noRefunds&&(['open','picked_up','done']).map(tab=>{
            const cnt=tab==='open'?openItems.length:tab==='picked_up'?pickupItems.length:doneItems.length
            const isAct=activeTab===tab
            return <button key={tab} onClick={()=>setActiveTab(tab)} className="tab-btn" style={{ background:isAct?'#111111':'transparent', color:isAct?'#ffffff':'#888888', borderColor:isAct?'#111111':'rgba(0,0,0,0.08)' }}>{tab==='open'?'Open':tab==='picked_up'?'Picked Up':'Done'}{cnt>0&&<span style={{ marginLeft:5, fontSize:10, opacity:.65 }}>{cnt}</span>}</button>
          })}
          {noRefunds&&<div style={{ padding:'4px 12px', borderRadius:6, background:'#F0FDF4', border:'1px solid rgba(22,163,74,0.2)', fontSize:11, fontWeight:600, color:'#15803D', letterSpacing:'.05em', textTransform:'uppercase' }}>Store healthy</div>}
        </div>
      </div>

      {!noRefunds&&allItems.length>0&&(
        <div style={{ height:3, background:'#F5F5F5', borderRadius:100, marginBottom:16, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:100, width:`${(doneItems.length/allItems.length)*100}%`, background:'#111111', transition:'width .4s ease' }}/>
        </div>
      )}

      {tabItems.length===0&&!noRefunds&&(
        <div style={{ textAlign:'center', padding:'36px 0' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={activeTab==='done'?'rgba(21,128,61,0.35)':'#E0E0E0'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'block', margin:'0 auto 10px' }}>
            {activeTab==='done'?<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          </svg>
          <div style={{ fontSize:13, color:'var(--text-3)' }}>{activeTab==='open'?'All actions picked up or done':activeTab==='picked_up'?'No actions currently in progress':'No completed actions yet'}</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {tabItems.map(item=>{
          const status=getStatus(item.id), st=statuses[item.id]||{}
          const isDone=status==='done'
          return (
            <div key={item.id} className={`action-card${isDone?' done-card':''}`}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                    {item.priority==='high'&&<span style={{ display:'inline-block', fontSize:10, fontWeight:600, color:'#DC2626', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:4, padding:'2px 7px' }}>URGENT</span>}
                    <CatBadge cat={item.category} small/>
                    {item.type==='pattern'&&item.refundCount&&<span style={{ fontSize:10.5, color:'#888888', fontVariantNumeric:'tabular-nums' }}>{item.refundCount}× · {fmtEur(item.totalAmount)} lost</span>}
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:isDone?'#888888':'#111111', marginBottom:6, lineHeight:1.35, textDecoration:isDone?'line-through':'none' }}>{item.title}</div>
                  <div style={{ fontSize:12, color:'#555555', lineHeight:1.5, marginBottom:status!=='open'?10:0 }}>{item.action}</div>
                  {status==='picked_up'&&st.pickedUpBy&&<div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8 }}>Picked up by <strong style={{ color:'var(--text-2)' }}>{st.pickedUpBy}</strong></div>}
                  {isDone&&<div style={{ fontSize:11, color:'#888888', marginBottom:8 }}>{st.pickedUpBy&&<>Completed by <strong style={{ color:'#555555' }}>{st.pickedUpBy}</strong>{st.resultNote?' — ':''}</>}{st.resultNote&&<span style={{ color:'#555555' }}>{st.resultNote}</span>}</div>}
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
  const SortIco=({col})=>{ if(sortCol!==col)return<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"/></svg>; return sortDir==='desc'?<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>:<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg> }

  return (
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div><div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Refund History</div><div style={{ fontSize:11, color:'var(--text-3)' }}>{loaded?`${filtered.length} of ${enriched.length} refund${enriched.length!==1?'s':''} · ${catFilter==='All'?'all categories':catFilter}`:'Loading…'}</div></div>
        {loaded&&enriched.length>0&&<div style={{ padding:'3px 12px', borderRadius:100, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', fontSize:11, fontWeight:600, color:'#555555' }}>{enriched.length} refunds</div>}
      </div>

      {loaded&&enriched.length>0&&(
        <div className="filter-pill-bar" style={{ flexWrap:'wrap', marginBottom:16 }}>
          {CATEGORIES.map(cat=>{ const cnt=cat==='All'?enriched.length:enriched.filter(r=>r.category===cat).length; if(cnt===0&&cat!=='All')return null; const isAct=catFilter===cat; return <button key={cat} onClick={()=>{setCatFilter(cat);setShowAll(false)}} className={`filter-pill${isAct?' active':''}`}>{cat} <span style={{ opacity:.7, fontSize:10 }}>{cnt}</span></button> })}
        </div>
      )}

      {!loaded&&<div style={{ display:'flex', flexDirection:'column', gap:12 }}>{[0,1,2,3,4].map(i=><div key={i} style={{ display:'flex', gap:16 }}><div className="sk" style={{ height:13, width:60 }}/><div className="sk" style={{ height:13, flex:1 }}/><div className="sk" style={{ height:13, flex:2 }}/><div className="sk" style={{ height:13, width:90 }}/><div className="sk" style={{ height:13, width:70 }}/></div>)}</div>}

      {loaded&&enriched.length===0&&(
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 0', gap:12 }}>
          <div style={{ width:48, height:48, borderRadius:8, background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:14, fontWeight:600, color:'#111111', marginBottom:4 }}>No refunds this period</div><div style={{ fontSize:13, color:'#888888' }}>Keep it up — no refunded orders found</div></div>
        </div>
      )}

      {loaded&&filtered.length===0&&enriched.length>0&&<div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:'var(--text-3)' }}>No refunds in category "{catFilter}"</div>}

      {loaded&&display.length>0&&(
        <>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:780 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(0,0,0,0.07)', background:'#F9F8FF' }}>
                  {[{label:'Date',col:'refundedAt',align:'left'},{label:'Order',col:'orderId',align:'left'},{label:'Customer',col:'customer',align:'left'},{label:'Product(s)',col:null,align:'left'},{label:'Category',col:'category',align:'left'},{label:'% of Order',col:'refundPct',align:'right'},{label:'Amount',col:'refundAmount',align:'right'}].map(h=>(
                    <th key={h.label} onClick={()=>h.col&&toggleSort(h.col)} style={{ textAlign:h.align, fontSize:11, fontWeight:600, letterSpacing:'.06em', color:'#9CA3AF', textTransform:'uppercase', padding:'9px 12px', paddingLeft:h.align==='right'?12:0, whiteSpace:'nowrap', cursor:h.col?'pointer':'default', userSelect:'none' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>{h.label}{h.col&&<SortIco col={h.col}/>}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((r,ri)=>{ return (
                  <tr key={`${r.orderId}-${ri}`} className="tbl-row" style={{ borderBottom:ri<display.length-1?'1px solid rgba(0,0,0,0.05)':'none' }}>
                    <td style={{ padding:'10px 12px 10px 0', fontSize:13, color:'#888888', whiteSpace:'nowrap' }}>{fmtDate(r.refundedAt)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, color:'#555555', whiteSpace:'nowrap' }}>{r.orderId}</td>
                    <td style={{ padding:'10px 12px', maxWidth:130 }}><div style={{ fontSize:13, fontWeight:500, color:'#111111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.customer}>{r.customer}</div>{r.customerEmail&&<div style={{ fontSize:11, color:'#888888', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.customerEmail}</div>}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, color:'#555555', maxWidth:160 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={(r.products||[]).join(', ')}>{(r.products||[]).join(', ')||'—'}</div></td>
                    <td style={{ padding:'10px 12px' }}><CatBadge cat={r.category} small/></td>
                    <td style={{ padding:'10px 12px', textAlign:'right', whiteSpace:'nowrap' }}><span style={{ fontSize:12, fontWeight:500, color:'#888888', fontVariantNumeric:'tabular-nums' }}>{r.refundPct}%</span></td>
                    <td style={{ padding:'10px 0 10px 12px', textAlign:'right', fontSize:13, fontWeight:600, color:'#DC2626', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{fmtEur(r.refundAmount)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {sorted.length>20&&!showAll&&(
            <div style={{ marginTop:16, textAlign:'center' }}>
              <button onClick={()=>setShowAll(true)} style={{ padding:'7px 20px', borderRadius:100, background:'var(--bg-surface-2)', border:'1px solid var(--border)', color:'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-input)';e.currentTarget.style.color='var(--text-1)'}} onMouseLeave={e=>{e.currentTarget.style.background='var(--bg-input)';e.currentTarget.style.color='var(--text-2)'}}>Show all {sorted.length} refunds</button>
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
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div><div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Product Refund Matrix</div><div style={{ fontSize:11, color:'var(--text-3)' }}>All-time · products with 1+ refund · sorted by count</div></div>
        <div style={{ padding:'3px 12px', borderRadius:100, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', fontSize:11, fontWeight:600, color:'#555555' }}>{products.length} products</div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid rgba(0,0,0,0.07)', background:'#F9F8FF' }}>
            {['#','Product','Category','Refunds','Avg %','Amount Lost','Risk'].map((h,i)=>(
              <th key={h} style={{ textAlign:i>=3?'right':'left', fontSize:11, fontWeight:600, letterSpacing:'.06em', color:'#9CA3AF', textTransform:'uppercase', padding:'9px 12px', paddingLeft:i>0&&i<3?12:i>=3?12:0, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p,i)=>{
            const risk = p.count>=3?{ label:'High', color:'#DC2626', bg:'#FEF2F2', border:'rgba(220,38,38,0.15)' }:p.count===2?{ label:'Medium', color:'#D97706', bg:'#FFFBEB', border:'rgba(217,119,6,0.15)' }:{ label:'Low', color:'#15803D', bg:'#F0FDF4', border:'rgba(21,128,61,0.15)' }
            const cc=CAT_COLORS[p.topCat]||CAT_COLORS.Other
            return (
              <tr key={p.name} className="matrix-row" style={{ borderBottom:i<products.length-1?'1px solid rgba(0,0,0,0.05)':'none' }}>
                <td style={{ padding:'10px 0', fontSize:12, fontWeight:600, color:'#BDBDBD', width:28 }}>{i+1}</td>
                <td style={{ padding:'10px 12px' }}>
                  <div style={{ fontSize:13, color:'#111111', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }} title={p.name}>{p.name}</div>
                  <div style={{ marginTop:5, height:3, background:'#F5F5F5', borderRadius:100, overflow:'hidden', maxWidth:180 }}>
                    <div className="bar-fill" style={{ height:'100%', width:`${(p.amount/maxAmt)*100}%`, background:(CAT_COLORS[p.topCat]||CAT_COLORS.Other).chartColor, borderRadius:100, animationDelay:`${i*.05}s`, opacity:0.7 }}/>
                  </div>
                </td>
                <td style={{ padding:'10px 12px' }}><CatBadge cat={p.topCat} small/></td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontSize:13, fontWeight:700, color:'#111111', fontVariantNumeric:'tabular-nums' }}>{p.count}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontSize:12, fontWeight:500, color:'#888888', fontVariantNumeric:'tabular-nums' }}>{p.avgPct}%</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontSize:13, fontWeight:600, color:'#111111', fontVariantNumeric:'tabular-nums' }}>{fmtEur(p.amount)}</td>
                <td style={{ padding:'10px 0 10px 12px', textAlign:'right' }}>
                  <span style={{ fontSize:10, fontWeight:600, color:risk.color, background:risk.bg, border:`1px solid ${risk.border}`, borderRadius:4, padding:'2px 7px' }}>{risk.label}</span>
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

// ─── Breakdown panels ─────────────────────────────────────────────────────────

function RefundReasons({ refunds, loaded }) {
  const map={}; refunds.forEach(r=>{ const k=categorizeReason(r.reason); if(!map[k])map[k]={cat:k,count:0,amount:0}; map[k].count++; map[k].amount+=parseFloat(r.refundAmount||0) })
  const reasons=Object.values(map).sort((a,b)=>b.amount-a.amount)
  const mx=Math.max(...reasons.map(r=>r.amount),1)
  return (
    <div className="panel" style={{ flex:'1 1 0' }}>
      <div style={{ marginBottom:18 }}><div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Why refunds happen</div><div style={{ fontSize:11, color:'var(--text-3)' }}>By total amount lost</div></div>
      {!loaded?<div style={{ display:'flex', flexDirection:'column', gap:14 }}>{[0,1,2,3,4].map(i=><div key={i} style={{ display:'flex', flexDirection:'column', gap:6 }}><div className="sk" style={{ height:11, width:`${50+i*9}%` }}/><div className="sk" style={{ height:5, borderRadius:100 }}/></div>)}</div>
      :reasons.length===0?<div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:'var(--text-3)' }}>No data this period</div>
      :<div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {reasons.map((r,i)=>{ const cc=CAT_COLORS[r.cat]||CAT_COLORS.Other; const barClr=cc.chartColor||'#9CA3AF'; return (
          <div key={r.cat}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:13, color:'#555555' }}>{r.cat}</span>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                <span style={{ fontSize:11, color:'#888888', fontVariantNumeric:'tabular-nums' }}>{fmtEur(r.amount)}</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#111111', minWidth:28, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{((r.count/(refunds.length||1))*100).toFixed(0)}%</span>
              </div>
            </div>
            <div style={{ height:6, background:'#F5F5F5', borderRadius:3, overflow:'hidden' }}>
              <div className="bar-fill" style={{ height:'100%', width:`${(r.amount/mx)*100}%`, borderRadius:3, background:barClr, animationDelay:`${.08*i}s` }}/>
            </div>
          </div>
        )})}
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
    <div className="panel" style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
      <div style={{ marginBottom:18 }}><div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Weekly Overview</div><div style={{ fontSize:11, color:'var(--text-3)' }}>Last 4 weeks (Sun–Sat) · all refunds</div></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {weeks.map((w,i)=>{ const cc=w.topReason?(CAT_COLORS[w.topReason]||CAT_COLORS.Other):null; return (
          <div key={i} style={{ borderRadius:10, padding:'16px 18px', background:w.isCurrentWeek?'#FFFFFF':'#FAFAFA', border:`1px solid ${w.isCurrentWeek?'rgba(0,0,0,0.09)':'rgba(0,0,0,0.05)'}`, boxShadow:w.isCurrentWeek?'0 2px 12px rgba(0,0,0,0.05)':'none' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:w.isCurrentWeek?'#111111':'#BDBDBD', letterSpacing:'.06em', textTransform:'uppercase' }}>{w.label}</div>
              {w.isCurrentWeek&&<div style={{ width:6, height:6, borderRadius:'50%', background:'#10B981' }}/>}
            </div>
            <div style={{ fontSize:28, fontWeight:800, color:'#111111', letterSpacing:'-0.04em', lineHeight:1, marginBottom:2, fontVariantNumeric:'tabular-nums' }}>{w.refundCount}</div>
            <div style={{ fontSize:11, color:'#888888', marginBottom:12 }}>refund{w.refundCount!==1?'s':''}</div>
            {w.refundCount>0&&<>
              <div style={{ fontSize:12, fontWeight:700, color:'#EF4444', fontVariantNumeric:'tabular-nums', marginBottom:8 }}>{fmtEur(w.totalAmount)} lost</div>
              {w.topReason&&<div style={{ marginBottom:4 }}><CatBadge cat={w.topReason} small/></div>}
              {w.topProduct&&<div style={{ fontSize:10, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:4 }} title={w.topProduct}>{w.topProduct}</div>}
            </>}
            {w.refundCount===0&&<div style={{ fontSize:11, color:'#10B981', fontWeight:600 }}>All clear ✓</div>}
          </div>
        )})}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AnalyticsContent() {
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
  const [demoMode,setDemoMode]=useState(false)
  const tokenRef=useRef(null)

  function loadDemo() {
    setKpis(DEMO_KPIS)
    setPrevKpis({ totalOrders:24, cancelledOrders:1, totalRefunds:6, refundRate:'25.0', refundAmount:'489' })
    setRefunds(DEMO_REFUNDS.filter(r=>new Date(r.refundedAt)>=new Date('2026-04-01')))
    setAllRefunds(DEMO_REFUNDS)
    setTrend(DEMO_TREND)
    setInsights(DEMO_INSIGHTS)
    setLoaded({ kpis:true, prevKpis:true, refunds:true, allRefunds:true, trend:true, insights:true })
    setDemoMode(true)
  }

  function exitDemo() {
    setDemoMode(false)
    setKpis({}); setPrevKpis({}); setRefunds([]); setAllRefunds([]); setTrend([]); setInsights([])
    setLoaded({ kpis:false, prevKpis:false, refunds:false, allRefunds:false, trend:false, insights:false })
    if(tokenRef.current){ fetchAll(tokenRef.current,'month'); fetchAllTimeRefunds(tokenRef.current) }
  }

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
  const patternActions=loaded.allRefunds?[...generatePatternActions(allRefunds),...generateRepeatRefunderActions(allRefunds)]:[]
  const actionLoaded=loaded.insights&&loaded.allRefunds

  return (
    <div className="an-root" style={{ display:'flex', minHeight:'100vh', background:'var(--bg-page)' }}>
      <style>{CSS}</style>
      <Sidebar/>
      <main className="an-scroll" style={{ flex:1, overflowY:'auto', padding:'24px', background:'#F9F8FF', position:'relative', scrollbarWidth:'thin' }}>
        <PageBackground/>
        <div style={{ position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom:24, animation:'fadeIn .5s ease-out 0s both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h1 className="animate-fade-in" style={{ fontSize:20, fontWeight:700, color:'#0F0F10', lineHeight:1.2, marginBottom:4, letterSpacing:'-0.02em' }}>Refund Intelligence</h1>
                <p style={{ fontSize:13, color:'#6B7280' }}>Where money is lost · {rangeLabel}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {demoMode&&(
                  <span style={{ fontSize:10, fontWeight:700, background:'#F5F5F5', color:'#555555', border:'1px solid rgba(0,0,0,0.08)', borderRadius:4, padding:'2px 7px', letterSpacing:'.05em', textTransform:'uppercase' }}>DEMO</span>
                )}
                {demoMode
                  ? <button onClick={exitDemo} style={{ padding:'5px 12px', borderRadius:7, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.09)', color:'#555555', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Exit Demo</button>
                  : <button onClick={loadDemo} style={{ padding:'5px 12px', borderRadius:7, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.09)', color:'#555555', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Preview Demo</button>
                }
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:7, background:allLoaded&&!demoMode?'#F0FDF4':'#F5F5F5', border:allLoaded&&!demoMode?'1px solid rgba(22,163,74,0.15)':'1px solid rgba(0,0,0,0.08)' }}>
                  {!allLoaded?<Spinner size={12}/>:<div style={{ width:6, height:6, borderRadius:'50%', background:demoMode?'#F59E0B':'#10B981', flexShrink:0 }}/>}
                  <span style={{ fontSize:11, fontWeight:600, color:allLoaded&&!demoMode?'#15803D':'#555555' }}>{!allLoaded?'Loading…':demoMode?'Demo':'Live'}</span>
                </div>
              </div>
            </div>
            <div style={{ height:'1px', background:'rgba(0,0,0,0.06)', margin:'16px 0 12px' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div className="filter-pill-bar">
                {RANGES.map(r=>(
                  <button key={r.id} onClick={()=>selectRange(r.id)} className={`filter-pill${dateRange===r.id?' active':''}`}>{r.label}</button>
                ))}
              </div>
              {dateRange==='custom'&&(
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input type="date" className="date-inp" value={customFrom} max={customTo||undefined} onChange={e=>{ const v=e.target.value; setCustomFrom(v); applyCustomRange(v,customTo) }}/>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>→</span>
                  <input type="date" className="date-inp" value={customTo} min={customFrom||undefined} max={new Date().toISOString().slice(0,10)} onChange={e=>{ const v=e.target.value; setCustomTo(v); applyCustomRange(customFrom,v) }}/>
                </div>
              )}
            </div>
          </div>

          {/* Sync / Demo banner */}
          {demoMode&&(
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#FAFAFA', border:'1px solid rgba(0,0,0,0.07)', borderRadius:6, padding:'8px 14px', marginBottom:16, animation:'fadeIn .4s ease-out both' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, color:'#888888' }}>Demo mode — connect your Shopify store in Settings to see real insights.</span></div>
              <button onClick={exitDemo} style={{ fontSize:12, fontWeight:600, color:'#555555', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Exit →</button>
            </div>
          )}
          {!demoMode&&loaded.kpis&&kpis.needsSync&&(
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#FAFAFA', border:'1px solid rgba(0,0,0,0.07)', borderRadius:6, padding:'8px 14px', marginBottom:16, animation:'fadeIn .4s ease-out both' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              <div style={{ flex:1 }}><span style={{ fontSize:12, color:'#888888' }}>No order data found. Go to Settings → Shopify to sync your orders.</span></div>
              <button onClick={loadDemo} style={{ fontSize:12, fontWeight:600, color:'#555555', background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Preview demo</button>
            </div>
          )}

          <AlertBanner rate={kpis.refundRate} loaded={loaded.kpis}/>
          <KpiRow kpis={kpis} prevKpis={prevKpis} refunds={refunds} loaded={loaded}/>
          <RevenueTrendChart trend={trend} loaded={loaded.trend} rangeLabel={rangeLabel}/>

          {/* Donut + Monthly side by side */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
            <DonutReasonChart refunds={refunds} loaded={loaded.refunds}/>
            <MonthlyTrendChart allRefunds={allRefunds} loaded={loaded.allRefunds}/>
          </div>

          <ActionBoard patternActions={patternActions} aiInsights={insights} noRefunds={noRefunds} loaded={actionLoaded} onStatusChange={handleStatusChange} statuses={actionStatuses} usingFallback={usingFallback}/>
          <RefundTable refunds={refunds} loaded={loaded.refunds}/>
          <ProductMatrix allRefunds={allRefunds} loaded={loaded.allRefunds}/>

          {!noRefunds&&(
            <div style={{ marginBottom:24, animation:'fadeIn .3s ease-out both' }}>
              <RefundReasons refunds={refunds} loaded={loaded.refunds}/>
            </div>
          )}

          <WeeklyReport allRefunds={allRefunds} loaded={loaded.allRefunds}/>

          <div style={{ marginTop:16, textAlign:'center', fontSize:10.5, color:'var(--text-3)', letterSpacing:'.04em' }}>
            Lynq Analytics · Shopify data · AI by Claude · Refreshed on load
          </div>
        </div>
      </main>
    </div>
  )
}


// ─── Wrapper: gate Analytics behind Shopify-connected check ─────────────
// Per ONBOARDING_SPEC v1.1 §4.2: /analytics zonder Shopify renders the
// "No analytics data yet" empty state. AnalyticsContent (the existing
// page implementation) only loads when integrations.shopify_domain
// is populated for the current workspace.
export default function AnalyticsPage() {
  const [shopifyConnected, setShopifyConnected] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = "/login"; return }
      try {
        const res = await fetch("/api/settings/integrations", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache:   "no-store",
        })
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setShopifyConnected(Boolean(data?.shopify))
      } catch {
        if (!cancelled) setShopifyConnected(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (shopifyConnected === null) return null

  if (!shopifyConnected) {
    return (
      <EmptyState
        icon="📊"
        title="No analytics data yet"
        description="Connect your Shopify store to see revenue, order metrics, and customer insights."
        actions={[
          { label: "Connect Shopify", href: "/settings", variant: "primary" },
        ]}
      />
    )
  }

  return <AnalyticsContent />
}
