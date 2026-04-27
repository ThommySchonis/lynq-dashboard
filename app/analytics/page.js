'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Date helpers ─────────────────────────────────────────────────────────────

const RANGES = [
  { id: 'month',     label: 'This month'   },
  { id: '7d',        label: 'Last 7 days'  },
  { id: '30d',       label: 'Last 30 days' },
  { id: 'lastMonth', label: 'Last month'   },
  { id: 'custom',    label: 'Custom'       },
]

function getDateRange(id) {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)
  if (id === '7d')        return { from: new Date(now - 7  * 86400000).toISOString().slice(0, 10), to: today }
  if (id === '30d')       return { from: new Date(now - 30 * 86400000).toISOString().slice(0, 10), to: today }
  if (id === 'lastMonth') {
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const l = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: f.toISOString().slice(0, 10), to: l.toISOString().slice(0, 10) }
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: today }
}

function fmtEur(n) {
  return `€${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateShort(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

// ─── Reason categorization ────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Sizing', 'Damaged', 'Quality', 'Not as described', 'Changed mind', 'Other']

const CAT_COLORS = {
  Sizing:             { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)'  },
  Damaged:            { color: '#F97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)'  },
  Quality:            { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'   },
  'Not as described': { color: '#A175FC', bg: 'rgba(161,117,252,0.1)', border: 'rgba(161,117,252,0.25)' },
  'Changed mind':     { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)'  },
  Other:              { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
}

function categorizeReason(raw) {
  if (!raw) return 'Other'
  const r = raw.toLowerCase()
  if (/size|maat|small|large|fit|klein|groot|te groot|te klein|fits|sizing|sized/.test(r)) return 'Sizing'
  if (/damage|damaged|broken|kapot|beschadigd|transit|arrived|packaging|cracked|defect/.test(r)) return 'Damaged'
  if (/quality|kwaliteit|expect|verwacht|stitching|fabric|material|poor|fell apart|low quality/.test(r)) return 'Quality'
  if (/described|color|colour|kleur|photo|picture|different|anders|not as|mislead|inaccurat/.test(r)) return 'Not as described'
  if (/changed mind|no longer|changed my|besloten|don.t want|don.t need|no longer need|ordered by mistake/.test(r)) return 'Changed mind'
  return 'Other'
}

// ─── Pattern action generation ────────────────────────────────────────────────

const PROACTIVE_INSIGHTS = [
  { priority:'medium', category:'Product Pages',     title:'Add a size guide to every clothing product', action:'"Wrong size" accounts for 22% of all e-commerce refunds globally. Adding a detailed size chart with chest, waist and hip measurements in cm is the single highest-impact preventive step for fashion stores.' },
  { priority:'medium', category:'Product Photography', title:'Show texture, true color and scale in photos', action:'"Not as described" is the second most common refund reason. Add texture close-ups, lifestyle photos in natural light, and a note like "Colors may vary slightly on different screens" to reduce expectation mismatch.' },
  { priority:'medium', category:'Operations',        title:'Review packaging for all fragile products', action:'"Arrived damaged" causes 14% of e-commerce refunds. Audit packaging for delicate items — use double-walled boxes, sufficient fill material, and mark parcels with fragile labels.' },
  { priority:'low',    category:'Customer Service',  title:'Offer an exchange before processing any refund', action:'Set up a refund-request email that offers a free size exchange within 48 hours. Studies show 30–40% of size-related refund requests can be converted to exchanges, retaining the revenue.' },
]

function getPatternActionCopy(productName, category, count, totalAmount) {
  const amt = fmtEur(totalAmount)
  const n   = count
  switch (category) {
    case 'Sizing': return {
      title:  `Fix size guide for ${productName}`,
      action: `${n} customers returned "${productName}" for size issues (${amt} lost). Add chest, waist and hip measurements in cm to the product page. Contact your supplier to ship 1 size up when customers flag sizing concerns in order notes.`,
    }
    case 'Damaged': return {
      title:  `Improve packaging for ${productName}`,
      action: `${n} items of "${productName}" arrived damaged (${amt} lost). Switch to double-walled boxes, add "Fragile" labels, and photograph items before dispatch. Compare carrier damage rates and file claims where applicable.`,
    }
    case 'Quality': return {
      title:  `Quality review: ${productName} with supplier`,
      action: `${n} refunds for quality issues on "${productName}" (${amt} lost). Contact your supplier for a formal quality review. Inspect your next shipment before shipping and update the product description to set accurate material expectations.`,
    }
    case 'Not as described': return {
      title:  `Update photos and description: ${productName}`,
      action: `${n} customers said "${productName}" looked different in person (${amt} lost). Add natural-light lifestyle photos, a color accuracy disclaimer, and a fabric close-up to reduce expectation mismatch.`,
    }
    case 'Changed mind': return {
      title:  `Offer exchanges before refunds on ${productName}`,
      action: `${n} changed-mind returns on "${productName}" (${amt} lost). Auto-email customers before processing their refund to offer a free exchange or store credit — this converts ~30% of returns and retains revenue.`,
    }
    default: return {
      title:  `Investigate refund pattern: ${productName}`,
      action: `${n} refunds on "${productName}" (${amt} lost) without a consistent reason. Review individual order notes to identify the root cause and take targeted action.`,
    }
  }
}

function generatePatternActions(allRefunds) {
  const productMap = {}
  allRefunds.forEach(r => {
    const cat = categorizeReason(r.reason)
    ;(r.products || []).forEach(p => {
      if (!productMap[p]) productMap[p] = { name: p, refunds: [], catCounts: {} }
      productMap[p].refunds.push(r)
      productMap[p].catCounts[cat] = (productMap[p].catCounts[cat] || 0) + 1
    })
  })

  const actions = []
  Object.values(productMap).forEach(prod => {
    if (prod.refunds.length < 2) return
    const dominantCat  = Object.entries(prod.catCounts).sort((a, b) => b[1] - a[1])[0][0]
    const totalAmount  = prod.refunds.reduce((s, r) => s + parseFloat(r.refundAmount || 0), 0)
    const { title, action } = getPatternActionCopy(prod.name, dominantCat, prod.refunds.length, totalAmount)
    actions.push({
      id:          `pattern-${prod.name.replace(/\s+/g, '-').toLowerCase()}`,
      type:        'pattern',
      priority:    prod.refunds.length >= 3 ? 'high' : 'medium',
      category:    dominantCat,
      product:     prod.name,
      refundCount: prod.refunds.length,
      totalAmount,
      title,
      action,
    })
  })

  return actions.sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 }
    return (o[a.priority] || 2) - (o[b.priority] || 2)
  })
}

// ─── Weekly report builder ────────────────────────────────────────────────────

function buildWeeklyReport(allRefunds) {
  const today = new Date()
  const dayOfWeek = today.getDay()
  let weekStart = new Date(today)
  weekStart.setDate(today.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)

  return Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(weekStart)
    wStart.setDate(weekStart.getDate() - i * 7)
    const wEnd = new Date(wStart)
    wEnd.setDate(wStart.getDate() + 6)
    wEnd.setHours(23, 59, 59, 999)

    const wRefunds = allRefunds.filter(r => {
      const d = new Date(r.refundedAt)
      return d >= wStart && d <= wEnd
    })

    const totalAmount = wRefunds.reduce((s, r) => s + parseFloat(r.refundAmount || 0), 0)

    const catCounts = {}
    wRefunds.forEach(r => {
      const cat = categorizeReason(r.reason)
      catCounts[cat] = (catCounts[cat] || 0) + 1
    })
    const topReason = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    const prodCounts = {}
    wRefunds.forEach(r => { (r.products || []).forEach(p => { prodCounts[p] = (prodCounts[p] || 0) + 1 }) })
    const topProduct = Object.entries(prodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    return {
      label:       i === 0 ? 'This week' : i === 1 ? 'Last week' : `${fmtDateShort(wStart.toISOString())} – ${fmtDateShort(wEnd.toISOString())}`,
      refundCount: wRefunds.length,
      totalAmount,
      topReason,
      topProduct,
      isCurrentWeek: i === 0,
    }
  })
}

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target, loaded) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (!loaded) { setVal(0); return }
    const num = parseFloat(target) || 0
    if (num === 0) { setVal(0); return }
    const start = performance.now()
    const dur = 900
    function tick(now) {
      const p    = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(num * ease)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, loaded])
  return val
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes aurora1 {
    0%,100%{transform:translate(0,0) scale(1);opacity:.4;}
    33%{transform:translate(60px,-80px) scale(1.15);opacity:.6;}
    66%{transform:translate(-40px,40px) scale(.9);opacity:.3;}
  }
  @keyframes aurora2 {
    0%,100%{transform:translate(0,0) scale(1);opacity:.25;}
    40%{transform:translate(-80px,60px) scale(1.2);opacity:.45;}
    70%{transform:translate(50px,-30px) scale(.85);opacity:.2;}
  }
  @keyframes aurora3 {
    0%,100%{transform:translate(0,0) scale(1);opacity:.18;}
    50%{transform:translate(40px,80px) scale(1.1);opacity:.35;}
  }
  @keyframes revealUp {
    from{opacity:0;transform:translateY(18px);}
    to{opacity:1;transform:translateY(0);}
  }
  @keyframes shimmer {
    from{background-position:-400% 0;}
    to{background-position:400% 0;}
  }
  @keyframes spin {
    to{transform:rotate(360deg);}
  }
  @keyframes growX {
    from{transform:scaleX(0);}
    to{transform:scaleX(1);}
  }
  @keyframes pulse-red {
    0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.3);}
    50%{box-shadow:0 0 0 6px rgba(239,68,68,0);}
  }
  @keyframes fadeIn {
    from{opacity:0;} to{opacity:1;}
  }

  .an-root * { box-sizing:border-box; margin:0; padding:0; }
  .an-root {
    font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .an-scroll::-webkit-scrollbar{width:3px;}
  .an-scroll::-webkit-scrollbar-track{background:transparent;}
  .an-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}

  .date-inp {
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.12);
    border-radius:8px; color:#F8FAFC;
    padding:4px 10px; font-size:11.5px;
    font-family:inherit; cursor:pointer;
    outline:none; color-scheme:dark;
    transition:border-color .15s,box-shadow .15s;
  }
  .date-inp:focus{border-color:rgba(161,117,252,0.5);box-shadow:0 0 0 2px rgba(161,117,252,0.12);}
  .date-inp::-webkit-calendar-picker-indicator{filter:invert(0.6);cursor:pointer;}

  .kpi-card {
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:16px; padding:22px 24px;
    position:relative; overflow:hidden;
    transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;
    cursor:default;
  }
  .kpi-card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,0.25);}
  .kpi-card .top-bar {
    position:absolute; top:0; left:0; right:0; height:2px;
    opacity:0; transition:opacity .2s ease;
  }
  .kpi-card:hover .top-bar{opacity:1;}

  .panel {
    background:rgba(255,255,255,0.035);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:16px; padding:24px;
    transition:border-color .2s ease;
  }
  .panel:hover{border-color:rgba(255,255,255,0.12);}

  .action-card {
    border-radius:12px;
    background:rgba(255,255,255,0.025);
    border:1px solid rgba(255,255,255,0.07);
    padding:18px 20px;
    transition:background .2s ease,border-color .2s ease;
    cursor:default;
  }
  .action-card:hover{background:rgba(255,255,255,0.045);border-color:rgba(255,255,255,0.12);}
  .action-card.done-card{opacity:0.5;}

  .tab-btn {
    padding:6px 16px; border-radius:100px; font-size:11.5px;
    font-weight:700; cursor:pointer; border:none;
    font-family:inherit; letter-spacing:.02em;
    transition:all .15s ease;
  }

  .range-pill {
    padding:5px 14px; border-radius:100px; font-size:11.5px;
    font-weight:600; cursor:pointer; border:none;
    font-family:inherit; letter-spacing:.01em;
    transition:all .15s ease;
  }

  .filter-pill {
    padding:4px 12px; border-radius:100px; font-size:11px;
    font-weight:600; cursor:pointer; border:1px solid transparent;
    font-family:inherit; transition:all .15s ease;
    white-space:nowrap;
  }

  .tbl-row{transition:background .15s ease;cursor:default;}
  .tbl-row:hover{background:rgba(255,255,255,0.03);}

  .sk {
    background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);
    background-size:400% 100%;
    animation:shimmer 1.8s ease-in-out infinite;
    border-radius:8px;
  }

  .bar-fill {
    transform-origin:left;
    animation:growX .6s cubic-bezier(.34,1.56,.64,1) both;
  }

  .btn-pickup {
    padding:5px 13px; border-radius:8px; font-size:11px; font-weight:700;
    cursor:pointer; border:none; font-family:inherit;
    background:rgba(161,117,252,0.15); color:#C3A3FF;
    border:1px solid rgba(161,117,252,0.3);
    transition:all .15s ease;
  }
  .btn-pickup:hover{background:rgba(161,117,252,0.25);}

  .btn-done {
    padding:5px 13px; border-radius:8px; font-size:11px; font-weight:700;
    cursor:pointer; border:none; font-family:inherit;
    background:rgba(74,222,128,0.12); color:#4ade80;
    border:1px solid rgba(74,222,128,0.28);
    transition:all .15s ease;
  }
  .btn-done:hover{background:rgba(74,222,128,0.22);}

  .btn-reopen {
    padding:4px 11px; border-radius:8px; font-size:10.5px; font-weight:600;
    cursor:pointer; border:none; font-family:inherit;
    background:transparent; color:rgba(248,250,252,0.28);
    border:1px solid rgba(255,255,255,0.08);
    transition:all .15s ease;
  }
  .btn-reopen:hover{border-color:rgba(255,255,255,0.18);color:rgba(248,250,252,0.55);}

  .name-inp {
    background:rgba(255,255,255,0.06);
    border:1px solid rgba(255,255,255,0.12);
    border-radius:7px; color:#F8FAFC;
    padding:4px 10px; font-size:11.5px;
    font-family:inherit; outline:none;
    transition:border-color .15s;
    width:140px;
  }
  .name-inp:focus{border-color:rgba(161,117,252,0.45);}
  .name-inp::placeholder{color:rgba(248,250,252,0.3);}
`

// ─── Aurora ───────────────────────────────────────────────────────────────────

function AuroraBackground() {
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      <div style={{ position:'absolute', top:'-10%', right:'15%', width:'700px', height:'600px', borderRadius:'50%', background:'radial-gradient(ellipse,rgba(255,107,53,0.09) 0%,transparent 70%)', animation:'aurora1 20s ease-in-out infinite', filter:'blur(50px)' }}/>
      <div style={{ position:'absolute', bottom:'5%', left:'5%', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(ellipse,rgba(161,117,252,0.07) 0%,transparent 70%)', animation:'aurora2 25s ease-in-out infinite', filter:'blur(45px)' }}/>
      <div style={{ position:'absolute', top:'40%', right:'-5%', width:'400px', height:'400px', borderRadius:'50%', background:'radial-gradient(ellipse,rgba(239,68,68,0.05) 0%,transparent 70%)', animation:'aurora3 30s ease-in-out infinite', filter:'blur(45px)' }}/>
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 18 }) {
  return <div style={{ width:size, height:size, border:`2px solid rgba(255,255,255,0.1)`, borderTop:`2px solid #A175FC`, borderRadius:'50%', animation:'spin .7s linear infinite', flexShrink:0 }}/>
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

function AlertBanner({ rate, loaded }) {
  if (!loaded) return null
  const r = parseFloat(rate || 0)
  if (r < 5) return null
  const isCritical = r >= 20
  const isHigh     = r >= 10
  const bg     = isCritical ? 'rgba(239,68,68,0.1)'  : isHigh ? 'rgba(249,115,22,0.08)' : 'rgba(251,191,36,0.08)'
  const border = isCritical ? 'rgba(239,68,68,0.25)' : isHigh ? 'rgba(249,115,22,0.2)'  : 'rgba(251,191,36,0.2)'
  const color  = isCritical ? '#f87171'               : isHigh ? '#fb923c'                : '#fbbf24'
  const label  = isCritical ? 'Critical'              : isHigh ? 'High'                   : 'Warning'
  const msg    = isCritical
    ? `Your refund rate is ${r}% — industry average for e-commerce is 2–5%. Immediate action required.`
    : isHigh
    ? `Your refund rate of ${r}% is significantly above the 2–5% e-commerce average. Review the action plan below.`
    : `Your refund rate of ${r}% is above the recommended 2–5% benchmark. See recommended actions below.`

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, background:bg, border:`1px solid ${border}`, borderRadius:12, padding:'12px 18px', marginBottom:24, animation:'revealUp .4s ease-out both' }}>
      <div style={{ animation:'pulse-red 2s ease-in-out infinite', borderRadius:'50%', flexShrink:0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div style={{ flex:1 }}>
        <span style={{ fontSize:12, fontWeight:700, color, marginRight:8, textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</span>
        <span style={{ fontSize:12, color:'rgba(248,250,252,0.65)', lineHeight:1.5 }}>{msg}</span>
      </div>
    </div>
  )
}

// ─── KPI Row ──────────────────────────────────────────────────────────────────

function KpiRow({ kpis, refunds, loaded }) {
  const totalRefunded = refunds.reduce((s, r) => s + parseFloat(r.refundAmount || 0), 0)
  const count  = refunds.length
  const avg    = count > 0 ? totalRefunded / count : 0
  const rate   = parseFloat(kpis.refundRate || 0)

  const animTotal = useCountUp(totalRefunded, loaded.refunds)
  const animCount = useCountUp(count, loaded.refunds)
  const animRate  = useCountUp(rate, loaded.kpis)
  const animAvg   = useCountUp(avg, loaded.refunds)

  if (!loaded.kpis && !loaded.refunds) {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="kpi-card" style={{ animation:`revealUp .5s ease-out ${.1+i*.07}s both` }}>
            <div className="sk" style={{ height:11, width:'55%', marginBottom:14 }}/>
            <div className="sk" style={{ height:30, width:'70%', marginBottom:8 }}/>
            <div className="sk" style={{ height:9, width:'85%' }}/>
          </div>
        ))}
      </div>
    )
  }

  const isHealthy = rate === 0 && loaded.kpis && loaded.refunds
  const cards = [
    { label:'MONEY LOST TO REFUNDS', value:fmtEur(animTotal), sub:`${count} refunded order${count !== 1?'s':''} this period`, accent:'#EF4444', grad:'linear-gradient(90deg,#EF4444,#FF6B35)', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg> },
    { label:'TOTAL REFUNDS', value:Math.floor(animCount), sub:'orders fully or partially refunded', accent:'#F97316', grad:'linear-gradient(90deg,#F97316,#fbbf24)', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg> },
    { label:'REFUND RATE', value: isHealthy ? '0.0% ✓' : `${animRate.toFixed(1)}%`, sub: isHealthy ? 'Excellent — below industry average' : rate > 5 ? `${(rate/2.5).toFixed(1)}× above industry average` : 'Industry avg: 2–5%', accent: isHealthy ? '#22C55E' : rate > 10 ? '#EF4444' : rate > 5 ? '#F97316' : '#22C55E', grad: isHealthy ? 'linear-gradient(90deg,#22C55E,#86efac)' : rate > 10 ? 'linear-gradient(90deg,#EF4444,#f87171)' : rate > 5 ? 'linear-gradient(90deg,#F97316,#fbbf24)' : 'linear-gradient(90deg,#22C55E,#86efac)', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { label:'AVG REFUND AMOUNT', value:fmtEur(animAvg), sub:'average per refunded order', accent:'#A175FC', grad:'linear-gradient(90deg,#A175FC,#C3A3FF)', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {cards.map((c, i) => (
        <div key={c.label} className="kpi-card" style={{ animation:`revealUp .5s ease-out ${.1+i*.07}s both` }}>
          <div className="top-bar" style={{ background:c.grad }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${c.accent}18`, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent }}>{c.icon}</div>
            <div style={{ width:6, height:6, borderRadius:'50%', background:c.accent, opacity:.6 }}/>
          </div>
          <div style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.035em', color:'#F8FAFC', lineHeight:1, marginBottom:6, fontVariantNumeric:'tabular-nums' }}>{c.value}</div>
          <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.1em', color:'rgba(248,250,252,0.35)', textTransform:'uppercase', marginBottom:4 }}>{c.label}</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.28)', lineHeight:1.4 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Revenue Trend ────────────────────────────────────────────────────────────

function RevenueTrendChart({ trend, loaded, rangeLabel }) {
  if (!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div className="sk" style={{ height:13, width:'30%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'20%', marginBottom:20 }}/>
      <div className="sk" style={{ height:120, borderRadius:8 }}/>
    </div>
  )
  if (!trend.length) return null
  if (trend.every(d => d.revenue === 0)) return null

  const W = 800, H = 130, padL = 48, padR = 12, padT = 10, padB = 24
  const maxRev   = Math.max(...trend.map(d => d.revenue), 1)
  const totalRev = trend.reduce((s, d) => s + d.revenue, 0)
  const pts      = trend.map((d, i) => ({ x: padL + (i / Math.max(trend.length-1, 1)) * (W-padL-padR), y: padT + (1 - d.revenue / maxRev) * (H-padT-padB), ...d }))
  const line     = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area     = `${pts[0].x.toFixed(1)},${(H-padB).toFixed(1)} ${line} ${pts[pts.length-1].x.toFixed(1)},${(H-padB).toFixed(1)}`
  const step     = Math.ceil(trend.length / 6)
  const xlbls    = pts.filter((_, i) => i === 0 || i % step === 0 || i === pts.length-1)
  const fmt      = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })

  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .28s both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Revenue Trend</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)', letterSpacing:'.02em' }}>{rangeLabel} · daily net revenue</div>
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'#A175FC', letterSpacing:'-0.02em' }}>{fmtEur(totalRev)}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', overflow:'visible' }} aria-hidden>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A175FC" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#A175FC" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0,.5,1].map((s,i) => { const y = padT + s*(H-padT-padB); return <line key={i} x1={padL} y1={y} x2={W-padR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/> })}
        <polygon points={area} fill="url(#tg)"/>
        <polyline points={line} fill="none" stroke="#A175FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.filter(p => p.revenue > 0).map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#A175FC"/>)}
        {xlbls.map((p,i) => <text key={i} x={p.x} y={H} textAnchor="middle" fontSize="9" fill="rgba(248,250,252,0.28)" fontFamily="sans-serif">{fmt(p.date)}</text>)}
        {[0,maxRev/2,maxRev].map((v,i) => { const y = padT + (1-v/maxRev)*(H-padT-padB); const lbl = v>=1000 ? `€${(v/1000).toFixed(1)}k` : `€${Math.round(v)}`; return <text key={i} x={padL-6} y={y+3} textAnchor="end" fontSize="9" fill="rgba(248,250,252,0.25)" fontFamily="sans-serif">{lbl}</text> })}
      </svg>
    </div>
  )
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CatBadge({ cat, small }) {
  const c = CAT_COLORS[cat] || CAT_COLORS.Other
  return (
    <span style={{
      display:'inline-block',
      fontSize: small ? 9.5 : 10.5,
      fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase',
      color:c.color, background:c.bg, border:`1px solid ${c.border}`,
      borderRadius:100, padding: small ? '1px 7px' : '2px 9px',
      whiteSpace:'nowrap',
    }}>
      {cat}
    </span>
  )
}

// ─── Action Board ─────────────────────────────────────────────────────────────

const PRIO_LABEL = { high:'HIGH', medium:'MEDIUM', low:'LOW' }
const PRIO_COLOR = { high:'#EF4444', medium:'#F97316', low:'#A175FC' }
const PRIO_BG    = { high:'rgba(239,68,68,0.1)', medium:'rgba(249,115,22,0.08)', low:'rgba(161,117,252,0.08)' }

function ActionBoard({ patternActions, aiInsights, noRefunds, loaded, onStatusChange, statuses, usingFallback }) {
  const [activeTab,  setActiveTab]  = useState('open')
  const [nameInputs, setNameInputs] = useState({})
  const [noteInputs, setNoteInputs] = useState({})

  const aiItems = (aiInsights || []).map((ins, i) => ({
    ...ins,
    id:   `ai-${ins.category?.replace(/\s+/g,'-').toLowerCase() ?? i}`,
    type: 'ai',
  }))

  // Dedup: skip AI items whose category is already covered by a pattern action
  const patternCats = new Set(patternActions.map(a => a.category))
  const filteredAi  = noRefunds ? PROACTIVE_INSIGHTS.map((ins, i) => ({ ...ins, id:`best-${i}`, type:'best' }))
                                : aiItems.filter(ai => !patternCats.has(ai.category))

  const allItems = [...patternActions, ...filteredAi]

  const getStatus = id => statuses[id]?.status || 'open'

  const openItems     = allItems.filter(a => getStatus(a.id) === 'open')
  const pickupItems   = allItems.filter(a => getStatus(a.id) === 'picked_up')
  const doneItems     = allItems.filter(a => getStatus(a.id) === 'done')

  const tabItems  = activeTab === 'open' ? openItems : activeTab === 'picked_up' ? pickupItems : doneItems
  const totalOpen = openItems.length

  if (!loaded) {
    return (
      <div className="panel" style={{ marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <Spinner size={16}/>
          <div style={{ fontSize:14, fontWeight:700, color:'rgba(248,250,252,0.6)' }}>Analysing refund patterns…</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[0,1,2,3].map(i => <div key={i} className="sk" style={{ height:80, borderRadius:12 }}/>)}
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .35s both' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            {noRefunds ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            )}
            <span style={{ fontSize:15, fontWeight:700, color:'#F8FAFC' }}>
              {noRefunds ? 'No refunds — stay ahead' : 'Action Board'}
            </span>
            {!noRefunds && (
              <span style={{ fontSize:11, color:'rgba(248,250,252,0.3)' }}>
                — {allItems.length} action{allItems.length !== 1 ? 's' : ''}
                {patternActions.length > 0 && ` · ${patternActions.length} pattern-detected`}
              </span>
            )}
          </div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>
            {noRefunds
              ? 'Proactive best practices to keep your refund rate at 0%'
              : 'Pattern-detected issues + AI recommendations — assign to your team'}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {usingFallback && (
            <div style={{ fontSize:10, color:'rgba(248,250,252,0.25)', padding:'3px 9px', borderRadius:100, border:'1px solid rgba(255,255,255,0.07)', marginRight:4 }}>
              Local only
            </div>
          )}
          {!noRefunds && (
            <>
              {(['open','picked_up','done']).map(tab => {
                const count = tab === 'open' ? openItems.length : tab === 'picked_up' ? pickupItems.length : doneItems.length
                const isActive = activeTab === tab
                const label = tab === 'open' ? 'Open' : tab === 'picked_up' ? 'Picked Up' : 'Done'
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="tab-btn"
                    style={{
                      background: isActive ? 'rgba(161,117,252,0.18)' : 'rgba(255,255,255,0.05)',
                      color:      isActive ? '#C3A3FF' : 'rgba(248,250,252,0.38)',
                      boxShadow:  isActive ? 'inset 0 0 0 1px rgba(161,117,252,0.38)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                    }}
                  >
                    {label} {count > 0 && <span style={{ marginLeft:4, fontSize:10, opacity:.7 }}>{count}</span>}
                  </button>
                )
              })}
            </>
          )}
          {noRefunds && totalOpen > 0 && (
            <div style={{ padding:'4px 12px', borderRadius:100, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', fontSize:11, fontWeight:700, color:'#22C55E', letterSpacing:'.05em' }}>
              STORE HEALTHY
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!noRefunds && allItems.length > 0 && (
        <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:100, marginBottom:16, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:100, width:`${(doneItems.length / allItems.length) * 100}%`, background:'linear-gradient(90deg,#22C55E,#86efac)', transition:'width .4s ease' }}/>
        </div>
      )}

      {/* Empty tab state */}
      {tabItems.length === 0 && !noRefunds && (
        <div style={{ textAlign:'center', padding:'36px 0' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>
            {activeTab === 'done' ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'block', margin:'0 auto' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'block', margin:'0 auto' }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
          </div>
          <div style={{ fontSize:13, color:'rgba(248,250,252,0.35)', marginTop:10 }}>
            {activeTab === 'open' ? 'All actions picked up or done' : activeTab === 'picked_up' ? 'No actions currently in progress' : 'No completed actions yet'}
          </div>
        </div>
      )}

      {/* Action cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {tabItems.map(item => {
          const status    = getStatus(item.id)
          const st        = statuses[item.id] || {}
          const pColor    = PRIO_COLOR[item.priority] || '#94A3B8'
          const pBg       = PRIO_BG[item.priority]   || 'rgba(148,163,184,0.08)'
          const catColors = CAT_COLORS[item.category] || CAT_COLORS.Other
          const isDone    = status === 'done'
          const isPickup  = status === 'picked_up'

          return (
            <div key={item.id} className={`action-card${isDone ? ' done-card' : ''}`}>
              {/* Card header row */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                {/* Priority dot */}
                <div style={{ width:8, height:8, borderRadius:'50%', background:pColor, marginTop:6, flexShrink:0 }}/>

                <div style={{ flex:1, minWidth:0 }}>
                  {/* Badges row */}
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                    {item.type === 'pattern' && (
                      <span style={{ fontSize:9, fontWeight:800, letterSpacing:'.08em', color:'rgba(248,250,252,0.4)', background:'rgba(255,255,255,0.06)', borderRadius:100, padding:'2px 8px', textTransform:'uppercase', border:'1px solid rgba(255,255,255,0.08)' }}>
                        PATTERN DETECTED
                      </span>
                    )}
                    {item.type === 'best' && (
                      <span style={{ fontSize:9, fontWeight:800, letterSpacing:'.08em', color:'#22C55E', background:'rgba(34,197,94,0.08)', borderRadius:100, padding:'2px 8px', textTransform:'uppercase', border:'1px solid rgba(34,197,94,0.2)' }}>
                        BEST PRACTICE
                      </span>
                    )}
                    <CatBadge cat={item.category} small/>
                    <span style={{ fontSize:9.5, fontWeight:700, color:pColor, background:pBg, borderRadius:100, padding:'1px 7px', textTransform:'uppercase', letterSpacing:'.06em' }}>
                      {PRIO_LABEL[item.priority] || 'LOW'}
                    </span>
                    {item.type === 'pattern' && (
                      <span style={{ fontSize:10, color:'rgba(248,250,252,0.35)' }}>
                        {item.refundCount}× refunded · {fmtEur(item.totalAmount)} lost
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div style={{ fontSize:13.5, fontWeight:700, color: isDone ? 'rgba(248,250,252,0.4)' : '#F8FAFC', marginBottom:6, lineHeight:1.35, textDecoration: isDone ? 'line-through' : 'none' }}>
                    {item.title}
                  </div>

                  {/* Action text */}
                  <div style={{ fontSize:12, color:'rgba(248,250,252,0.5)', lineHeight:1.65, marginBottom: (status !== 'open') ? 12 : 0 }}>
                    {item.action}
                  </div>

                  {/* Picked up info */}
                  {isPickup && st.pickedUpBy && (
                    <div style={{ fontSize:11, color:'rgba(161,117,252,0.7)', marginBottom:12 }}>
                      Picked up by <strong style={{ color:'#C3A3FF' }}>{st.pickedUpBy}</strong>
                    </div>
                  )}
                  {isDone && (
                    <div style={{ fontSize:11, color:'rgba(74,222,128,0.7)', marginBottom:12 }}>
                      {st.pickedUpBy && <>Completed by <strong style={{ color:'#4ade80' }}>{st.pickedUpBy}</strong>{st.resultNote ? ' — ' : ''}</>}
                      {st.resultNote && <span style={{ color:'rgba(248,250,252,0.45)' }}>{st.resultNote}</span>}
                    </div>
                  )}
                </div>

                {/* Status controls */}
                <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0 }}>
                  {status === 'open' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end' }}>
                      <input
                        className="name-inp"
                        placeholder="Your name (optional)"
                        value={nameInputs[item.id] || ''}
                        onChange={e => setNameInputs(p => ({ ...p, [item.id]: e.target.value }))}
                      />
                      <button className="btn-pickup" onClick={() => onStatusChange(item.id, 'picked_up', nameInputs[item.id], '')}>
                        Pick Up
                      </button>
                    </div>
                  )}
                  {status === 'picked_up' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end' }}>
                      <input
                        className="name-inp"
                        placeholder="Result note (optional)"
                        value={noteInputs[item.id] || ''}
                        onChange={e => setNoteInputs(p => ({ ...p, [item.id]: e.target.value }))}
                      />
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn-reopen" onClick={() => onStatusChange(item.id, 'open', '', '')}>Re-open</button>
                        <button className="btn-done" onClick={() => onStatusChange(item.id, 'done', st.pickedUpBy, noteInputs[item.id] || '')}>
                          Mark Done
                        </button>
                      </div>
                    </div>
                  )}
                  {status === 'done' && (
                    <button className="btn-reopen" onClick={() => onStatusChange(item.id, 'open', '', '')}>Re-open</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Refund History Table ─────────────────────────────────────────────────────

function RefundTable({ refunds, loaded }) {
  const [showAll,    setShowAll]    = useState(false)
  const [catFilter,  setCatFilter]  = useState('All')
  const [sortCol,    setSortCol]    = useState('refundedAt')
  const [sortDir,    setSortDir]    = useState('desc')

  const enriched = (loaded ? refunds : []).map(r => ({ ...r, category: categorizeReason(r.reason) }))

  const filtered = catFilter === 'All' ? enriched : enriched.filter(r => r.category === catFilter)

  const sorted = [...filtered].sort((a, b) => {
    let av, bv
    if (sortCol === 'refundedAt') { av = new Date(a.refundedAt); bv = new Date(b.refundedAt) }
    else if (sortCol === 'refundAmount') { av = parseFloat(a.refundAmount); bv = parseFloat(b.refundAmount) }
    else if (sortCol === 'refundPct') { av = parseFloat(a.refundPct); bv = parseFloat(b.refundPct) }
    else { av = a[sortCol] || ''; bv = b[sortCol] || '' }
    return sortDir === 'desc' ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1)
  })

  const display = showAll ? sorted : sorted.slice(0, 20)

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"/></svg>
    return sortDir === 'desc'
      ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(248,250,252,0.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(248,250,252,0.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
  }

  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .52s both' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Refund History</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>
            {loaded ? `${filtered.length} of ${enriched.length} refund${enriched.length !== 1 ? 's' : ''} · ${catFilter === 'All' ? 'all categories' : catFilter}` : 'Loading…'}
          </div>
        </div>
        {loaded && enriched.length > 0 && (
          <div style={{ padding:'3px 12px', borderRadius:100, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', fontSize:11, fontWeight:700, color:'#EF4444' }}>
            {enriched.length} refunds
          </div>
        )}
      </div>

      {/* Category filter */}
      {loaded && enriched.length > 0 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:16 }}>
          {CATEGORIES.map(cat => {
            const isActive = catFilter === cat
            const cc       = cat === 'All' ? null : CAT_COLORS[cat]
            const count    = cat === 'All' ? enriched.length : enriched.filter(r => r.category === cat).length
            if (count === 0 && cat !== 'All') return null
            return (
              <button
                key={cat}
                onClick={() => { setCatFilter(cat); setShowAll(false) }}
                className="filter-pill"
                style={{
                  background: isActive ? (cc ? cc.bg : 'rgba(255,255,255,0.08)') : 'transparent',
                  color:      isActive ? (cc ? cc.color : '#F8FAFC') : 'rgba(248,250,252,0.38)',
                  borderColor: isActive ? (cc ? cc.border : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.08)',
                }}
              >
                {cat} <span style={{ opacity:.6, fontSize:10 }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Skeleton */}
      {!loaded && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ display:'flex', gap:16 }}>
              <div className="sk" style={{ height:13, width:55 }}/>
              <div className="sk" style={{ height:13, flex:1 }}/>
              <div className="sk" style={{ height:13, flex:2 }}/>
              <div className="sk" style={{ height:13, width:80 }}/>
              <div className="sk" style={{ height:13, width:65 }}/>
              <div className="sk" style={{ height:13, flex:1 }}/>
              <div className="sk" style={{ height:13, width:65 }}/>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {loaded && enriched.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 0', gap:12 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'rgba(74,222,128,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'rgba(248,250,252,0.7)', marginBottom:4 }}>No refunds this period</div>
            <div style={{ fontSize:12, color:'rgba(248,250,252,0.28)' }}>Keep it up — no refunded orders found</div>
          </div>
        </div>
      )}

      {/* Table */}
      {loaded && filtered.length === 0 && enriched.length > 0 && (
        <div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:'rgba(248,250,252,0.3)' }}>
          No refunds in category "{catFilter}"
        </div>
      )}

      {loaded && display.length > 0 && (
        <>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:780 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    { label:'Date',          col:'refundedAt',   align:'left'  },
                    { label:'Order',         col:'orderId',      align:'left'  },
                    { label:'Customer',      col:'customer',     align:'left'  },
                    { label:'Product(s)',    col:null,           align:'left'  },
                    { label:'Category',      col:'category',     align:'left'  },
                    { label:'% of Order',    col:'refundPct',    align:'right' },
                    { label:'Refund Amount', col:'refundAmount', align:'right' },
                  ].map(h => (
                    <th
                      key={h.label}
                      onClick={() => h.col && toggleSort(h.col)}
                      style={{
                        textAlign:h.align, fontSize:9.5, fontWeight:700,
                        letterSpacing:'.08em', color:'rgba(248,250,252,0.28)',
                        textTransform:'uppercase', padding:'0 0 12px',
                        paddingLeft: h.align === 'right' ? 14 : 0,
                        paddingRight: h.align === 'right' ? 0 : 0,
                        whiteSpace:'nowrap', cursor: h.col ? 'pointer' : 'default',
                        userSelect:'none',
                      }}
                    >
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                        {h.label}
                        {h.col && <SortIcon col={h.col}/>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((r, ri) => {
                  const pct      = parseFloat(r.refundPct || 0)
                  const pctColor = pct >= 80 ? '#EF4444' : pct >= 40 ? '#F97316' : 'rgba(248,250,252,0.45)'
                  const pctBg    = pct >= 80 ? 'rgba(239,68,68,0.1)' : pct >= 40 ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.05)'
                  return (
                    <tr key={`${r.orderId}-${ri}`} className="tbl-row" style={{ borderBottom: ri < display.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding:'11px 14px 11px 0', fontSize:11.5, color:'rgba(248,250,252,0.4)', whiteSpace:'nowrap' }}>{fmtDate(r.refundedAt)}</td>
                      <td style={{ padding:'11px 14px', fontSize:12, fontWeight:700, color:'rgba(248,250,252,0.55)', whiteSpace:'nowrap' }}>{r.orderId}</td>
                      <td style={{ padding:'11px 14px', maxWidth:130 }}>
                        <div style={{ fontSize:12.5, color:'#F8FAFC', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.customer}>{r.customer}</div>
                        {r.customerEmail && <div style={{ fontSize:10, color:'rgba(248,250,252,0.28)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.customerEmail}</div>}
                      </td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:'rgba(248,250,252,0.5)', maxWidth:160 }}>
                        <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={(r.products||[]).join(', ')}>
                          {(r.products||[]).join(', ') || '—'}
                        </div>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <CatBadge cat={r.category} small/>
                      </td>
                      <td style={{ padding:'11px 14px', textAlign:'right', whiteSpace:'nowrap' }}>
                        <span style={{ fontSize:11, fontWeight:700, color:pctColor, background:pctBg, borderRadius:5, padding:'2px 8px', display:'inline-block' }}>{r.refundPct}%</span>
                      </td>
                      <td style={{ padding:'11px 0 11px 14px', textAlign:'right', fontSize:13, fontWeight:800, color:'#EF4444', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{fmtEur(r.refundAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > 20 && !showAll && (
            <div style={{ marginTop:16, textAlign:'center' }}>
              <button
                onClick={() => setShowAll(true)}
                style={{ padding:'7px 20px', borderRadius:100, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(248,250,252,0.5)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#F8FAFC' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(248,250,252,0.5)' }}
              >
                Show all {sorted.length} refunds
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Breakdown: Why refunds + Top products ────────────────────────────────────

function RefundReasons({ refunds, loaded }) {
  const map = {}
  refunds.forEach(r => {
    const key = categorizeReason(r.reason)
    if (!map[key]) map[key] = { cat: key, count: 0, amount: 0 }
    map[key].count++
    map[key].amount += parseFloat(r.refundAmount || 0)
  })
  const reasons = Object.values(map).sort((a, b) => b.amount - a.amount)
  const max = Math.max(...reasons.map(r => r.amount), 1)

  return (
    <div className="panel" style={{ flex:'1 1 0' }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Why refunds happen</div>
        <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>Sorted by total amount lost</div>
      </div>

      {!loaded ? (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[0,1,2,3,4].map(i => <div key={i} style={{ display:'flex', flexDirection:'column', gap:6 }}><div className="sk" style={{ height:11, width:`${50+i*9}%` }}/><div className="sk" style={{ height:5, borderRadius:100 }}/></div>)}
        </div>
      ) : reasons.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:'rgba(248,250,252,0.2)' }}>No data this period</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {reasons.map((r, i) => {
            const cc = CAT_COLORS[r.cat] || CAT_COLORS.Other
            return (
              <div key={r.cat}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:cc.color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:'rgba(248,250,252,0.72)', fontWeight:500 }}>{r.cat}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:11, color:'rgba(248,250,252,0.38)', fontVariantNumeric:'tabular-nums' }}>{fmtEur(r.amount)}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:cc.color, background:cc.bg, borderRadius:5, padding:'1px 7px', minWidth:24, textAlign:'center', border:`1px solid ${cc.border}` }}>
                      {r.count}×
                    </span>
                  </div>
                </div>
                <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:100, overflow:'hidden' }}>
                  <div className="bar-fill" style={{ height:'100%', width:`${(r.amount/max)*100}%`, borderRadius:100, background:`linear-gradient(90deg,${cc.color},${cc.color}88)`, animationDelay:`${.08*i}s` }}/>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TopProducts({ refunds, loaded }) {
  const map = {}
  refunds.forEach(r => {
    ;(r.products || []).forEach(p => {
      if (!map[p]) map[p] = { name: p, count: 0, amount: 0 }
      map[p].count++
      map[p].amount += parseFloat(r.refundAmount || 0)
    })
  })
  const products = Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 6)
  const maxAmt   = Math.max(...products.map(p => p.amount), 1)

  return (
    <div className="panel" style={{ flex:'1 1 0' }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Most refunded products</div>
        <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>By total value refunded</div>
      </div>

      {!loaded ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div className="sk" style={{ width:30, height:30, borderRadius:8, flexShrink:0 }}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                <div className="sk" style={{ height:11, width:'75%' }}/>
                <div className="sk" style={{ height:4, borderRadius:100 }}/>
              </div>
              <div className="sk" style={{ height:11, width:45, flexShrink:0 }}/>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:'rgba(248,250,252,0.2)' }}>No data this period</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {products.map((p, i) => (
            <div key={p.name} className="tbl-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#EF4444', flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:12.5, color:'#F8FAFC', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:5 }} title={p.name}>{p.name}</div>
                <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:100, overflow:'hidden' }}>
                  <div className="bar-fill" style={{ height:'100%', width:`${(p.amount/maxAmt)*100}%`, background:'linear-gradient(90deg,#EF4444,rgba(161,117,252,0.7))', borderRadius:100, animationDelay:`${.06*i}s` }}/>
                </div>
              </div>
              <div style={{ flexShrink:0, textAlign:'right' }}>
                <div style={{ fontSize:12.5, fontWeight:700, color:'#EF4444', fontVariantNumeric:'tabular-nums' }}>{fmtEur(p.amount)}</div>
                <div style={{ fontSize:10, color:'rgba(248,250,252,0.35)', marginTop:1 }}>{p.count}× refunded</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Weekly Report ────────────────────────────────────────────────────────────

function WeeklyReport({ allRefunds, loaded }) {
  if (!loaded) return (
    <div className="panel" style={{ marginBottom:24 }}>
      <div className="sk" style={{ height:13, width:'25%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'18%', marginBottom:20 }}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[0,1,2,3].map(i => <div key={i} className="sk" style={{ height:90, borderRadius:10 }}/>)}
      </div>
    </div>
  )

  const weeks = buildWeeklyReport(allRefunds)

  return (
    <div className="panel" style={{ marginBottom:24, animation:'revealUp .5s ease-out .62s both' }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#F8FAFC', marginBottom:3 }}>Weekly Overview</div>
        <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>Last 4 weeks (Sun–Sat) · all refunds</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {weeks.map((w, i) => {
          const catColor = w.topReason ? (CAT_COLORS[w.topReason] || CAT_COLORS.Other) : null
          return (
            <div key={i} style={{
              borderRadius:12, padding:'14px 16px',
              background: w.isCurrentWeek ? 'rgba(161,117,252,0.07)' : 'rgba(255,255,255,0.025)',
              border: `1px solid ${w.isCurrentWeek ? 'rgba(161,117,252,0.2)' : 'rgba(255,255,255,0.07)'}`,
            }}>
              <div style={{ fontSize:10.5, fontWeight:700, color: w.isCurrentWeek ? '#C3A3FF' : 'rgba(248,250,252,0.4)', letterSpacing:'.04em', marginBottom:10, textTransform:'uppercase' }}>
                {w.label}
              </div>
              <div style={{ fontSize:22, fontWeight:800, color: w.refundCount === 0 ? '#4ade80' : '#EF4444', letterSpacing:'-0.03em', marginBottom:2, fontVariantNumeric:'tabular-nums' }}>
                {w.refundCount}
              </div>
              <div style={{ fontSize:10, color:'rgba(248,250,252,0.32)', marginBottom:10 }}>refund{w.refundCount !== 1 ? 's' : ''}</div>
              {w.refundCount > 0 && (
                <>
                  <div style={{ fontSize:12.5, fontWeight:700, color:'rgba(248,250,252,0.7)', fontVariantNumeric:'tabular-nums', marginBottom:8 }}>
                    {fmtEur(w.totalAmount)} lost
                  </div>
                  {w.topReason && (
                    <div style={{ marginBottom:4 }}>
                      <CatBadge cat={w.topReason} small/>
                    </div>
                  )}
                  {w.topProduct && (
                    <div style={{ fontSize:10, color:'rgba(248,250,252,0.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:4 }} title={w.topProduct}>
                      {w.topProduct}
                    </div>
                  )}
                </>
              )}
              {w.refundCount === 0 && (
                <div style={{ fontSize:10.5, color:'rgba(74,222,128,0.6)' }}>No refunds</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [kpis,         setKpis]         = useState({})
  const [refunds,      setRefunds]      = useState([])
  const [allRefunds,   setAllRefunds]   = useState([])
  const [trend,        setTrend]        = useState([])
  const [insights,     setInsights]     = useState([])
  const [actionStatuses, setActionStatuses] = useState({})
  const [usingFallback,  setUsingFallback]  = useState(false)
  const [dateRange,    setDateRange]    = useState('month')
  const [customFrom,   setCustomFrom]   = useState('')
  const [customTo,     setCustomTo]     = useState('')
  const [loaded,       setLoaded]       = useState({ kpis:false, refunds:false, allRefunds:false, trend:false, insights:false })
  const [mounted,      setMounted]      = useState(false)
  const tokenRef = useRef(null)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      tokenRef.current = session.access_token
      fetchAll(session.access_token, 'month')
      fetchAllTimeRefunds(session.access_token)
      fetchActionStatuses(session.access_token)
    })
  }, [])

  async function fetchActionStatuses(token) {
    try {
      const res = await fetch('/api/analytics/actions', { headers: { Authorization:`Bearer ${token}` } })
      if (!res.ok) { setUsingFallback(true); loadFromLocalStorage(); return }
      const d = await res.json()
      if (d.fallback) { setUsingFallback(true); loadFromLocalStorage() }
      else setActionStatuses(d.actions || {})
    } catch {
      setUsingFallback(true); loadFromLocalStorage()
    }
  }

  function loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('lynq-action-statuses')
      if (saved) setActionStatuses(JSON.parse(saved))
    } catch {}
  }

  async function handleStatusChange(id, status, pickedUpBy, resultNote) {
    const next = {
      ...actionStatuses,
      [id]: { status, pickedUpBy: pickedUpBy || null, pickedUpAt: status === 'picked_up' ? new Date().toISOString() : null, resultNote: resultNote || null },
    }
    setActionStatuses(next)

    if (usingFallback) {
      try { localStorage.setItem('lynq-action-statuses', JSON.stringify(next)) } catch {}
      return
    }

    try {
      await fetch('/api/analytics/actions', {
        method: 'PATCH',
        headers: { Authorization:`Bearer ${tokenRef.current}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ id, status, pickedUpBy, resultNote }),
      })
    } catch {}
  }

  async function fetchAllTimeRefunds(token) {
    const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const to   = new Date().toISOString().slice(0, 10)
    try {
      const res = await fetch(`/api/shopify/refunds?from=${from}&to=${to}`, { headers: { Authorization:`Bearer ${token}` } })
      if (res.ok) {
        const d = await res.json()
        setAllRefunds(d.refunds || [])
      }
    } catch {}
    setLoaded(p => ({ ...p, allRefunds:true }))
  }

  async function fetchInsights(token, refundsData) {
    if (refundsData.length === 0) { setLoaded(p => ({ ...p, insights:true })); return }
    try {
      const res = await fetch('/api/analytics/refund-insights', {
        method: 'POST',
        headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ refunds: refundsData }),
      })
      if (res.ok) { const d = await res.json(); setInsights(d.insights || []) }
    } catch {}
    setLoaded(p => ({ ...p, insights:true }))
  }

  function fetchAll(token, rangeId, explicitFrom, explicitTo) {
    const { from, to } = (explicitFrom && explicitTo)
      ? { from:explicitFrom, to:explicitTo }
      : getDateRange(rangeId)
    const headers = { Authorization:`Bearer ${token}` }
    const q = `from=${from}&to=${to}`

    setLoaded(p => ({ ...p, kpis:false, refunds:false, trend:false, insights:false }))
    setInsights([])

    fetch(`/api/shopify/kpis?${q}`, { headers })
      .then(r => r.ok ? r.json() : {})
      .then(d => { setKpis(d); setLoaded(p => ({ ...p, kpis:true })) })
      .catch(() => setLoaded(p => ({ ...p, kpis:true })))

    fetch(`/api/shopify/refunds?${q}`, { headers })
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        const data = d.refunds || []
        setRefunds(data); setLoaded(p => ({ ...p, refunds:true }))
        fetchInsights(token, data)
      })
      .catch(() => setLoaded(p => ({ ...p, refunds:true, insights:true })))

    fetch(`/api/shopify/revenue-trend?${q}`, { headers })
      .then(r => r.ok ? r.json() : { trend:[] })
      .then(d => { setTrend(d.trend || []); setLoaded(p => ({ ...p, trend:true })) })
      .catch(() => setLoaded(p => ({ ...p, trend:true })))
  }

  function selectRange(id) {
    setDateRange(id)
    if (id !== 'custom' && tokenRef.current) fetchAll(tokenRef.current, id)
  }

  function applyCustomRange(from, to) {
    if (from && to && from <= to && tokenRef.current) fetchAll(tokenRef.current, 'custom', from, to)
  }

  if (!mounted) return null

  const allLoaded  = loaded.kpis && loaded.refunds && loaded.trend
  const rangeLabel = dateRange === 'custom' && customFrom && customTo
    ? `${customFrom} → ${customTo}`
    : RANGES.find(r => r.id === dateRange)?.label || 'This month'
  const noRefunds      = loaded.refunds && refunds.length === 0
  const patternActions = loaded.allRefunds ? generatePatternActions(allRefunds) : []
  const actionLoaded   = loaded.insights && loaded.allRefunds

  return (
    <div className="an-root" style={{ display:'flex', minHeight:'100vh', background:'#1C0F36' }}>
      <style>{CSS}</style>
      <Sidebar/>

      <main className="an-scroll" style={{ flex:1, overflowY:'auto', padding:'36px 44px', position:'relative' }}>
        <AuroraBackground/>

        <div style={{ position:'relative', zIndex:1, maxWidth:1180, margin:'0 auto' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom:28, animation:'revealUp .5s ease-out 0s both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h1 style={{ fontSize:26, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.03em', lineHeight:1.2, marginBottom:4 }}>
                  Refund Intelligence
                </h1>
                <p style={{ fontSize:12.5, color:'rgba(248,250,252,0.38)' }}>
                  Where money is lost · {rangeLabel}
                </p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:100, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                {!allLoaded ? <Spinner size={14}/> : (
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 7px rgba(74,222,128,0.7)' }}/>
                )}
                <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.09em', color:'rgba(248,250,252,0.4)', textTransform:'uppercase' }}>
                  {allLoaded ? 'Live' : 'Loading…'}
                </span>
              </div>
            </div>

            <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'20px 0 16px' }}/>

            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              {RANGES.map(r => (
                <button
                  key={r.id}
                  onClick={() => selectRange(r.id)}
                  className="range-pill"
                  style={{
                    background: dateRange === r.id ? 'rgba(161,117,252,0.18)' : 'rgba(255,255,255,0.05)',
                    color:      dateRange === r.id ? '#C3A3FF' : 'rgba(248,250,252,0.42)',
                    boxShadow:  dateRange === r.id ? 'inset 0 0 0 1px rgba(161,117,252,0.4)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  }}
                >
                  {r.label}
                </button>
              ))}
              {dateRange === 'custom' && (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:4 }}>
                  <input type="date" className="date-inp" value={customFrom} max={customTo||undefined}
                    onChange={e => { const v=e.target.value; setCustomFrom(v); applyCustomRange(v,customTo) }}/>
                  <span style={{ fontSize:11, color:'rgba(248,250,252,0.28)' }}>→</span>
                  <input type="date" className="date-inp" value={customTo} min={customFrom||undefined} max={new Date().toISOString().slice(0,10)}
                    onChange={e => { const v=e.target.value; setCustomTo(v); applyCustomRange(customFrom,v) }}/>
                </div>
              )}
            </div>
          </div>

          {/* ── Needs-sync banner ── */}
          {loaded.kpis && kpis.needsSync && (
            <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(161,117,252,0.08)', border:'1px solid rgba(161,117,252,0.2)', borderRadius:12, padding:'12px 18px', marginBottom:24, animation:'revealUp .4s ease-out both' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A175FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#A175FC', marginRight:8 }}>Sync required</span>
                <span style={{ fontSize:12, color:'rgba(248,250,252,0.55)' }}>No order data found. Go to Settings → Shopify to sync your orders.</span>
              </div>
            </div>
          )}

          {/* ── Alert Banner ── */}
          <AlertBanner rate={kpis.refundRate} loaded={loaded.kpis}/>

          {/* ── KPI Row ── */}
          <KpiRow kpis={kpis} refunds={refunds} loaded={loaded}/>

          {/* ── Revenue Trend ── */}
          <RevenueTrendChart trend={trend} loaded={loaded.trend} rangeLabel={rangeLabel}/>

          {/* ── Action Board ── */}
          <ActionBoard
            patternActions={patternActions}
            aiInsights={insights}
            noRefunds={noRefunds}
            loaded={actionLoaded}
            onStatusChange={handleStatusChange}
            statuses={actionStatuses}
            usingFallback={usingFallback}
          />

          {/* ── Refund Table — always shown ── */}
          <RefundTable refunds={refunds} loaded={loaded.refunds}/>

          {/* ── Breakdown row ── */}
          {!noRefunds && (
            <div style={{ display:'flex', gap:16, marginBottom:24, animation:'revealUp .5s ease-out .58s both' }}>
              <RefundReasons refunds={refunds} loaded={loaded.refunds}/>
              <TopProducts   refunds={refunds} loaded={loaded.refunds}/>
            </div>
          )}

          {/* ── Skeleton breakdown during load ── */}
          {!loaded.refunds && (
            <div style={{ display:'flex', gap:16, marginBottom:24 }}>
              <div className="panel" style={{ flex:'1 1 0' }}>
                <div className="sk" style={{ height:13, width:'45%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'30%', marginBottom:20 }}/>
                {[0,1,2,3,4].map(i => <div key={i} style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}><div className="sk" style={{ height:11, width:`${60+i*7}%` }}/><div className="sk" style={{ height:5, borderRadius:100 }}/></div>)}
              </div>
              <div className="panel" style={{ flex:'1 1 0' }}>
                <div className="sk" style={{ height:13, width:'50%', marginBottom:6 }}/><div className="sk" style={{ height:10, width:'35%', marginBottom:20 }}/>
                {[0,1,2,3,4].map(i => <div key={i} style={{ display:'flex', gap:10, marginBottom:12 }}><div className="sk" style={{ width:30, height:30, borderRadius:8, flexShrink:0 }}/><div style={{ flex:1 }}><div className="sk" style={{ height:11, width:'75%', marginBottom:5 }}/><div className="sk" style={{ height:4, borderRadius:100 }}/></div></div>)}
              </div>
            </div>
          )}

          {/* ── Weekly Report ── */}
          <WeeklyReport allRefunds={allRefunds} loaded={loaded.allRefunds}/>

          <div style={{ marginTop:16, textAlign:'center', fontSize:10.5, color:'rgba(248,250,252,0.15)', letterSpacing:'.03em' }}>
            Lynq Analytics · Shopify data · AI by Claude · Refreshed on load
          </div>
        </div>
      </main>
    </div>
  )
}
