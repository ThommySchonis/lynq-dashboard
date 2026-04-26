'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fmt(n) {
  return Number(n || 0).toLocaleString('nl-NL')
}

function fmtEur(n) {
  return `€${Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getISODay(dateStr) {
  // ISO weekday: 1=Mon … 7=Sun
  const d = new Date(dateStr)
  return ((d.getDay() + 6) % 7) // 0=Mon … 6=Sun
}

function groupByDay(orders) {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  orders.forEach(o => {
    const d = new Date(o.created_at)
    const idx = (d.getDay() + 6) % 7
    counts[idx]++
  })
  return counts
}

function groupRefundsByProduct(refunds) {
  const map = {}
  refunds.forEach(r => {
    const lines = r.refund_line_items || []
    lines.forEach(li => {
      const name = li.line_item?.title || li.line_item?.name || 'Unknown Product'
      const amount = parseFloat(li.subtotal || 0)
      if (!map[name]) map[name] = { name, count: 0, total: 0 }
      map[name].count++
      map[name].total += amount
    })
  })
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5)
}

function getOrderStatus(o) {
  const fin = (o.financial_status || '').toLowerCase()
  const ful = (o.fulfillment_status || '').toLowerCase()
  if (fin === 'refunded' || fin === 'partially_refunded') return 'refunded'
  if (fin === 'pending') return 'pending'
  if (ful === 'fulfilled') return 'fulfilled'
  return fin || 'pending'
}

function statusColor(s) {
  switch (s) {
    case 'paid':      return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', label: 'Paid' }
    case 'fulfilled': return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', label: 'Fulfilled' }
    case 'pending':   return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', label: 'Pending' }
    case 'refunded':  return { bg: 'rgba(255,107,53,0.12)', color: '#FF6B35', label: 'Refunded' }
    case 'cancelled': return { bg: 'rgba(248,113,113,0.12)', color: '#f87171', label: 'Cancelled' }
    default:          return { bg: 'rgba(255,255,255,0.06)', color: 'rgba(248,250,252,0.45)', label: s }
  }
}

function fmtDate(str) {
  return new Date(str).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes aurora1 {
    0%,100% { transform:translate(0,0) scale(1); opacity:.45; }
    33%      { transform:translate(60px,-80px) scale(1.15); opacity:.65; }
    66%      { transform:translate(-40px,40px) scale(.9); opacity:.35; }
  }
  @keyframes aurora2 {
    0%,100% { transform:translate(0,0) scale(1); opacity:.3; }
    40%      { transform:translate(-80px,60px) scale(1.2); opacity:.5; }
    70%      { transform:translate(50px,-30px) scale(.85); opacity:.25; }
  }
  @keyframes aurora3 {
    0%,100% { transform:translate(0,0) scale(1); opacity:.2; }
    50%      { transform:translate(40px,80px) scale(1.1); opacity:.4; }
  }
  @keyframes revealUp {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes shimmer {
    from { background-position:-400% 0; }
    to   { background-position:400% 0; }
  }
  @keyframes barGrow {
    from { transform:scaleY(0); }
    to   { transform:scaleY(1); }
  }
  @keyframes spin {
    to { transform:rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }

  .analytics-root * { box-sizing:border-box; margin:0; padding:0; }

  .analytics-root {
    font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;
    -webkit-font-smoothing:antialiased;
  }

  /* Scrollbar */
  .analytics-scroll::-webkit-scrollbar { width:3px; }
  .analytics-scroll::-webkit-scrollbar-track { background:transparent; }
  .analytics-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }

  /* KPI cards */
  .kpi-card {
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:14px;
    padding:20px 22px;
    position:relative;
    overflow:hidden;
    transition:all 0.22s ease;
    cursor:default;
  }
  .kpi-card::before {
    content:'';
    position:absolute;
    top:0; left:0; right:0;
    height:2px;
    background:linear-gradient(90deg,#3088FF,#FF6B35);
    opacity:0;
    transition:opacity 0.22s ease;
  }
  .kpi-card::after {
    content:'';
    position:absolute;
    inset:0;
    background:linear-gradient(135deg,rgba(48,136,255,0.06),transparent 60%);
    opacity:0;
    transition:opacity 0.22s ease;
  }
  .kpi-card:hover { transform:translateY(-2px); border-color:rgba(48,136,255,0.2); box-shadow:0 8px 32px rgba(48,136,255,0.08); }
  .kpi-card:hover::before { opacity:1; }
  .kpi-card:hover::after  { opacity:1; }

  /* Chart card */
  .chart-card {
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:14px;
    padding:24px;
    transition:all 0.22s ease;
  }
  .chart-card:hover { border-color:rgba(48,136,255,0.15); box-shadow:0 8px 32px rgba(48,136,255,0.06); }

  /* Bar chart bars */
  .bar-wrap {
    flex:1;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:6px;
    position:relative;
  }
  .bar-inner {
    width:100%;
    max-width:32px;
    border-radius:4px 4px 0 0;
    background:linear-gradient(180deg,#3088FF,rgba(48,136,255,0.4));
    transform-origin:bottom;
    animation:barGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
    cursor:pointer;
    transition:filter 0.15s ease, transform 0.15s ease;
    position:relative;
  }
  .bar-inner:hover { filter:brightness(1.25); }

  /* Tooltip */
  .bar-tooltip {
    position:absolute;
    top:-34px;
    left:50%;
    transform:translateX(-50%);
    background:rgba(15,20,45,0.95);
    border:1px solid rgba(48,136,255,0.25);
    border-radius:7px;
    padding:4px 10px;
    font-size:11px;
    font-weight:600;
    color:#F8FAFC;
    white-space:nowrap;
    pointer-events:none;
    opacity:0;
    transition:opacity 0.15s ease;
    z-index:10;
  }
  .bar-inner:hover .bar-tooltip { opacity:1; }

  /* Table rows */
  .tbl-row {
    transition:background 0.15s ease;
    cursor:default;
  }
  .tbl-row:hover { background:rgba(255,255,255,0.03); }

  /* Skeleton shimmer */
  .skeleton {
    background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);
    background-size:400% 100%;
    animation:shimmer 1.8s ease-in-out infinite;
    border-radius:8px;
  }
`

// ─── Aurora background ───────────────────────────────────────────────────────

function AuroraBackground() {
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      <div style={{
        position:'absolute', top:'-10%', right:'15%',
        width:'700px', height:'600px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(48,136,255,0.10) 0%,transparent 70%)',
        animation:'aurora1 20s ease-in-out infinite',
        filter:'blur(50px)',
      }}/>
      <div style={{
        position:'absolute', bottom:'5%', left:'5%',
        width:'500px', height:'500px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(255,107,53,0.07) 0%,transparent 70%)',
        animation:'aurora2 25s ease-in-out infinite',
        filter:'blur(45px)',
      }}/>
      <div style={{
        position:'absolute', top:'45%', right:'-5%',
        width:'400px', height:'400px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(139,92,246,0.05) 0%,transparent 70%)',
        animation:'aurora3 30s ease-in-out infinite',
        filter:'blur(45px)',
      }}/>
    </div>
  )
}

// ─── Skeleton loaders ────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px' }}>
      {[0,1,2,3].map(i => (
        <div key={i} className="kpi-card" style={{ animation:`revealUp 0.5s ease-out ${0.1+i*0.07}s both` }}>
          <div className="skeleton" style={{ height:32, width:'60%', marginBottom:10 }}/>
          <div className="skeleton" style={{ height:12, width:'80%' }}/>
        </div>
      ))}
    </div>
  )
}

// ─── KPI Row ─────────────────────────────────────────────────────────────────

function KpiRow({ kpis, loaded }) {
  if (!loaded) return <KpiSkeleton/>

  const cards = [
    {
      label: 'TOTAL ORDERS',
      value: fmt(kpis.totalOrders),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      ),
    },
    {
      label: 'NET REVENUE',
      value: fmtEur(kpis.netRevenue),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/>
        </svg>
      ),
    },
    {
      label: 'REFUND RATE',
      value: `${kpis.refundRate || 0}%`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
        </svg>
      ),
    },
    {
      label: 'CANCELLED ORDERS',
      value: fmt(kpis.cancelledOrders ?? kpis.totalCancelled),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      ),
    },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px' }}>
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="kpi-card"
          style={{ animation:`revealUp 0.5s ease-out ${0.1+i*0.07}s both` }}
        >
          {/* Icon row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
            <div style={{
              width:36, height:36, borderRadius:9,
              background:'rgba(48,136,255,0.1)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#3088FF', flexShrink:0,
            }}>
              {c.icon}
            </div>
          </div>
          {/* Value */}
          <div style={{
            fontSize:28, fontWeight:700, letterSpacing:'-0.03em',
            color:'#F8FAFC', lineHeight:1, marginBottom:6,
          }}>
            {c.value}
          </div>
          {/* Label */}
          <div style={{
            fontSize:10, fontWeight:600, letterSpacing:'.1em',
            color:'rgba(248,250,252,0.38)', textTransform:'uppercase',
          }}>
            {c.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Revenue Bar Chart ────────────────────────────────────────────────────────

function RevenueBarChart({ orders }) {
  const counts = groupByDay(orders)
  const max = Math.max(...counts, 1)

  return (
    <div className="chart-card" style={{ flex:'0 0 60%' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'#F8FAFC', marginBottom:4 }}>Orders by Day</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.38)', letterSpacing:'.03em' }}>This week · volume breakdown</div>
        </div>
        <div style={{
          padding:'4px 12px', borderRadius:100,
          background:'rgba(48,136,255,0.1)',
          border:'1px solid rgba(48,136,255,0.2)',
          fontSize:11, fontWeight:600, color:'#3088FF', letterSpacing:'.04em',
        }}>
          {orders.length} total
        </div>
      </div>

      {/* Bars */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:160, paddingBottom:0 }}>
        {DAYS.map((day, i) => {
          const val = counts[i]
          const pct = max === 0 ? 0 : (val / max) * 100
          const barH = Math.max(pct * 1.4, val > 0 ? 6 : 0)

          return (
            <div key={day} className="bar-wrap" style={{ animationDelay:`${i*0.06}s` }}>
              {/* Bar */}
              <div style={{ flex:1, display:'flex', alignItems:'flex-end', width:'100%', justifyContent:'center' }}>
                {val > 0 ? (
                  <div
                    className="bar-inner"
                    style={{ height:`${barH}px`, animationDelay:`${0.3+i*0.07}s`, width:'26px' }}
                  >
                    <div className="bar-tooltip">{val} order{val !== 1 ? 's' : ''}</div>
                  </div>
                ) : (
                  <div style={{
                    width:'26px', height:'4px', borderRadius:'2px',
                    background:'rgba(255,255,255,0.06)',
                  }}/>
                )}
              </div>
              {/* Day label */}
              <span style={{
                fontSize:10, fontWeight:500, letterSpacing:'.04em',
                color: val > 0 ? 'rgba(248,250,252,0.5)' : 'rgba(248,250,252,0.2)',
                textTransform:'uppercase',
              }}>
                {day}
              </span>
            </div>
          )
        })}
      </div>

      {/* Y-axis legend */}
      <div style={{
        display:'flex', justifyContent:'space-between', marginTop:12,
        paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize:10, color:'rgba(248,250,252,0.25)' }}>0</span>
        <span style={{ fontSize:10, color:'rgba(248,250,252,0.25)' }}>{Math.ceil(max / 2)}</span>
        <span style={{ fontSize:10, color:'rgba(248,250,252,0.25)' }}>{max}</span>
      </div>
    </div>
  )
}

// ─── Order Status Donut ───────────────────────────────────────────────────────

function StatusDonut({ orders }) {
  const fulfilled  = orders.filter(o => (o.fulfillment_status || '').toLowerCase() === 'fulfilled').length
  const cancelled  = orders.filter(o => (o.cancel_reason || o.cancelled_at)).length
  const refunded   = orders.filter(o => ['refunded','partially_refunded'].includes((o.financial_status || '').toLowerCase())).length
  const unfulfilled = Math.max(0, orders.length - fulfilled - cancelled - refunded)
  const total = orders.length || 1

  const segments = [
    { label:'Fulfilled',   count:fulfilled,   color:'#3088FF',  pct: (fulfilled/total)*100 },
    { label:'Unfulfilled', count:unfulfilled, color:'#fbbf24',  pct: (unfulfilled/total)*100 },
    { label:'Cancelled',   count:cancelled,   color:'#f87171',  pct: (cancelled/total)*100 },
    { label:'Refunded',    count:refunded,    color:'#FF6B35',  pct: (refunded/total)*100 },
  ].filter(s => s.count > 0)

  // Build conic-gradient
  let gradient = ''
  let acc = 0
  segments.forEach((s, i) => {
    gradient += `${s.color} ${acc.toFixed(1)}% ${(acc + s.pct).toFixed(1)}%`
    acc += s.pct
    if (i < segments.length - 1) gradient += ', '
  })
  if (!gradient) gradient = 'rgba(255,255,255,0.06) 0% 100%'

  return (
    <div className="chart-card" style={{ flex:'0 0 calc(40% - 16px)' }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:14, fontWeight:600, color:'#F8FAFC', marginBottom:4 }}>Order Status</div>
        <div style={{ fontSize:11, color:'rgba(248,250,252,0.38)', letterSpacing:'.03em' }}>Distribution breakdown</div>
      </div>

      {/* Donut */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}>
        <div style={{ position:'relative', width:140, height:140 }}>
          {/* Outer ring */}
          <div style={{
            width:140, height:140, borderRadius:'50%',
            background:`conic-gradient(${gradient})`,
            boxShadow:'0 0 0 1px rgba(255,255,255,0.06)',
          }}/>
          {/* Hole */}
          <div style={{
            position:'absolute', top:'50%', left:'50%',
            transform:'translate(-50%,-50%)',
            width:88, height:88, borderRadius:'50%',
            background:'#06091A',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            gap:2,
          }}>
            <span style={{ fontSize:20, fontWeight:700, color:'#F8FAFC', letterSpacing:'-0.02em', lineHeight:1 }}>
              {orders.length}
            </span>
            <span style={{ fontSize:9, color:'rgba(248,250,252,0.35)', letterSpacing:'.06em', textTransform:'uppercase', fontWeight:600 }}>
              orders
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }}/>
              <span style={{ fontSize:12, color:'rgba(248,250,252,0.6)' }}>{s.label}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, fontWeight:600, color:'#F8FAFC' }}>{s.count}</span>
              <span style={{
                fontSize:10, color:s.color, fontWeight:600,
                background:`${s.color}18`, borderRadius:4, padding:'1px 6px',
                minWidth:36, textAlign:'center',
              }}>
                {s.pct.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
        {segments.length === 0 && (
          <div style={{ fontSize:12, color:'rgba(248,250,252,0.3)', textAlign:'center', padding:'8px 0' }}>
            No order data available
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Top Refunded Products Table ─────────────────────────────────────────────

function RefundsTable({ refunds, loaded }) {
  const products = loaded ? groupRefundsByProduct(refunds) : []

  return (
    <div className="chart-card" style={{ marginBottom:28, animation:'revealUp 0.5s ease-out 0.55s both' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'#F8FAFC', marginBottom:4 }}>Top Refunded Products</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.38)', letterSpacing:'.03em' }}>Ranked by refund count</div>
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'4px 12px', borderRadius:100,
          background:'rgba(255,107,53,0.08)', border:'1px solid rgba(255,107,53,0.2)',
          fontSize:11, fontWeight:600, color:'#FF6B35', letterSpacing:'.04em',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
          </svg>
          Top 5
        </div>
      </div>

      {/* Table */}
      {!loaded ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ display:'flex', gap:16, alignItems:'center' }}>
              <div className="skeleton" style={{ height:14, flex:1 }}/>
              <div className="skeleton" style={{ height:14, width:60 }}/>
              <div className="skeleton" style={{ height:14, width:80 }}/>
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              {['Product Name', 'Times Refunded', 'Total Amount'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Product Name' ? 'left' : 'right',
                  fontSize:10, fontWeight:600, letterSpacing:'.08em',
                  color:'rgba(248,250,252,0.3)', textTransform:'uppercase',
                  padding:'0 0 12px',
                  paddingLeft: h === 'Product Name' ? 0 : 16,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding:'20px 0', textAlign:'center', fontSize:13, color:'rgba(248,250,252,0.25)' }}>
                  No refund data available
                </td>
              </tr>
            ) : products.map((p, i) => (
              <tr key={p.name} className="tbl-row">
                <td style={{ padding:'13px 0', fontSize:13, color:'#F8FAFC', fontWeight:500, maxWidth:320 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:24, height:24, borderRadius:6,
                      background:'rgba(255,107,53,0.1)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontWeight:700, color:'#FF6B35', flexShrink:0,
                    }}>
                      {i+1}
                    </div>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  </div>
                </td>
                <td style={{ padding:'13px 0 13px 16px', textAlign:'right', fontSize:13, color:'rgba(248,250,252,0.7)', fontWeight:500 }}>
                  {p.count}×
                </td>
                <td style={{ padding:'13px 0 13px 16px', textAlign:'right', fontSize:13, fontWeight:600, color:'#FF6B35' }}>
                  {fmtEur(p.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Recent Orders Table ──────────────────────────────────────────────────────

function OrdersTable({ orders, loaded }) {
  const recent = loaded ? [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10) : []

  return (
    <div className="chart-card" style={{ animation:'revealUp 0.5s ease-out 0.65s both' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'#F8FAFC', marginBottom:4 }}>Recent Orders</div>
          <div style={{ fontSize:11, color:'rgba(248,250,252,0.38)', letterSpacing:'.03em' }}>Last 10 transactions</div>
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'4px 12px', borderRadius:100,
          background:'rgba(48,136,255,0.08)', border:'1px solid rgba(48,136,255,0.2)',
          fontSize:11, fontWeight:600, color:'#3088FF', letterSpacing:'.04em',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Live
        </div>
      </div>

      {/* Table */}
      {!loaded ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[0,1,2,3,4,5,6,7,8,9].map(i => (
            <div key={i} style={{ display:'flex', gap:16, alignItems:'center' }}>
              <div className="skeleton" style={{ height:14, width:70 }}/>
              <div className="skeleton" style={{ height:14, flex:1 }}/>
              <div className="skeleton" style={{ height:14, width:80 }}/>
              <div className="skeleton" style={{ height:20, width:72, borderRadius:100 }}/>
              <div className="skeleton" style={{ height:14, width:55 }}/>
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              {['Order', 'Customer', 'Amount', 'Status', 'Date'].map((h, hi) => (
                <th key={h} style={{
                  textAlign: hi >= 2 ? 'right' : 'left',
                  fontSize:10, fontWeight:600, letterSpacing:'.08em',
                  color:'rgba(248,250,252,0.3)', textTransform:'uppercase',
                  padding:'0 0 12px',
                  paddingLeft: hi > 0 ? 16 : 0,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding:'20px 0', textAlign:'center', fontSize:13, color:'rgba(248,250,252,0.25)' }}>
                  No orders found
                </td>
              </tr>
            ) : recent.map(o => {
              const status = getOrderStatus(o)
              const badge  = statusColor(status)
              const customer = o.customer
                ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() || o.email || '—'
                : o.email || '—'
              const amount = fmtEur(parseFloat(o.total_price || 0))
              const orderNum = `#${o.order_number || o.name || o.id}`

              return (
                <tr key={o.id} className="tbl-row">
                  <td style={{ padding:'12px 0', fontSize:12, fontWeight:600, color:'rgba(248,250,252,0.7)', fontVariantNumeric:'tabular-nums' }}>
                    {orderNum}
                  </td>
                  <td style={{ padding:'12px 0 12px 16px', fontSize:13, color:'#F8FAFC', maxWidth:180 }}>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                      {customer}
                    </span>
                  </td>
                  <td style={{ padding:'12px 0 12px 16px', textAlign:'right', fontSize:13, fontWeight:600, color:'#F8FAFC', fontVariantNumeric:'tabular-nums' }}>
                    {amount}
                  </td>
                  <td style={{ padding:'12px 0 12px 16px', textAlign:'right' }}>
                    <span style={{
                      display:'inline-block',
                      padding:'3px 10px', borderRadius:100,
                      background:badge.bg, color:badge.color,
                      fontSize:11, fontWeight:600, letterSpacing:'.03em',
                      textTransform:'capitalize', whiteSpace:'nowrap',
                    }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding:'12px 0 12px 16px', textAlign:'right', fontSize:12, color:'rgba(248,250,252,0.4)', whiteSpace:'nowrap' }}>
                    {fmtDate(o.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Loading spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width:18, height:18,
      border:'2px solid rgba(255,255,255,0.1)',
      borderTop:'2px solid #3088FF',
      borderRadius:'50%',
      animation:'spin 0.7s linear infinite',
      flexShrink:0,
    }}/>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [session,  setSession]  = useState(null)
  const [kpis,     setKpis]     = useState({})
  const [orders,   setOrders]   = useState([])
  const [refunds,  setRefunds]  = useState([])
  const [loaded,   setLoaded]   = useState({ kpis:false, orders:false, refunds:false })
  const [error,    setError]    = useState(null)
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setSession(session)
      fetchAll(session.access_token)
    })
  }, [])

  async function fetchAll(token) {
    const headers = { Authorization: `Bearer ${token}` }

    // Fetch KPIs
    fetch('/api/shopify/kpis', { headers })
      .then(r => r.ok ? r.json() : {})
      .then(data => { setKpis(data); setLoaded(p => ({ ...p, kpis: true })) })
      .catch(() => setLoaded(p => ({ ...p, kpis: true })))

    // Fetch Orders
    fetch('/api/shopify/orders', { headers })
      .then(r => r.ok ? r.json() : {})
      .then(data => { setOrders(data.orders || []); setLoaded(p => ({ ...p, orders: true })) })
      .catch(() => setLoaded(p => ({ ...p, orders: true })))

    // Fetch Refunds
    fetch('/api/shopify/refunds', { headers })
      .then(r => r.ok ? r.json() : {})
      .then(data => { setRefunds(data.refunds || []); setLoaded(p => ({ ...p, refunds: true })) })
      .catch(() => setLoaded(p => ({ ...p, refunds: true })))
  }

  if (!mounted) return null

  const chartsLoaded = loaded.orders

  return (
    <div className="analytics-root" style={{ display:'flex', minHeight:'100vh', background:'#06091A' }}>
      <style>{CSS}</style>
      <Sidebar/>

      <main
        className="analytics-scroll"
        style={{ flex:1, overflowY:'auto', padding:'40px 48px', position:'relative' }}
      >
        <AuroraBackground/>

        <div style={{ position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto' }}>

          {/* ── Page Header ── */}
          <div style={{ marginBottom:32, animation:'revealUp 0.5s ease-out 0s both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h1 style={{
                  fontSize:28, fontWeight:700, color:'#F8FAFC',
                  letterSpacing:'-0.025em', lineHeight:1.2, marginBottom:6,
                }}>
                  Analytics
                </h1>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:13, color:'rgba(248,250,252,0.38)' }}>
                    Store performance
                  </span>
                  <span style={{ color:'rgba(255,255,255,0.15)', fontSize:13 }}>·</span>
                  <span style={{ fontSize:13, color:'rgba(248,250,252,0.38)' }}>
                    This month
                  </span>
                </div>
              </div>

              {/* Live badge */}
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'8px 16px', borderRadius:100,
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
              }}>
                {!loaded.kpis ? (
                  <Spinner/>
                ) : (
                  <div style={{
                    width:7, height:7, borderRadius:'50%',
                    background:'#4ade80',
                    boxShadow:'0 0 8px rgba(74,222,128,0.6)',
                  }}/>
                )}
                <span style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:'rgba(248,250,252,0.45)', textTransform:'uppercase' }}>
                  {loaded.kpis ? 'Live' : 'Loading…'}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height:1, background:'rgba(255,255,255,0.06)', marginTop:24 }}/>
          </div>

          {/* ── KPI Row ── */}
          <KpiRow kpis={kpis} loaded={loaded.kpis}/>

          {/* ── Charts Row ── */}
          <div style={{
            display:'flex', gap:16, marginBottom:28,
            animation:'revealUp 0.5s ease-out 0.4s both',
          }}>
            {chartsLoaded ? (
              <>
                <RevenueBarChart orders={orders}/>
                <StatusDonut orders={orders}/>
              </>
            ) : (
              <>
                {/* Bar chart skeleton */}
                <div className="chart-card" style={{ flex:'0 0 60%' }}>
                  <div className="skeleton" style={{ height:14, width:'40%', marginBottom:6 }}/>
                  <div className="skeleton" style={{ height:10, width:'25%', marginBottom:24 }}/>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:160 }}>
                    {DAYS.map((d, i) => (
                      <div key={d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                        <div className="skeleton" style={{ width:'80%', height:`${30+Math.random()*80}px`, borderRadius:'4px 4px 0 0' }}/>
                        <div className="skeleton" style={{ height:10, width:'100%' }}/>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Donut skeleton */}
                <div className="chart-card" style={{ flex:'0 0 calc(40% - 16px)', display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div className="skeleton" style={{ height:14, width:'50%', marginBottom:6, alignSelf:'flex-start' }}/>
                  <div className="skeleton" style={{ height:10, width:'35%', marginBottom:24, alignSelf:'flex-start' }}/>
                  <div className="skeleton" style={{ width:140, height:140, borderRadius:'50%', marginBottom:24 }}/>
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
                    {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:14, width:'100%' }}/>)}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Top Refunded Products ── */}
          <RefundsTable refunds={refunds} loaded={loaded.refunds}/>

          {/* ── Recent Orders ── */}
          <OrdersTable orders={orders} loaded={loaded.orders}/>

          {/* Footer note */}
          <div style={{
            marginTop:24, textAlign:'center',
            fontSize:11, color:'rgba(248,250,252,0.18)', letterSpacing:'.03em',
          }}>
            Lynq Analytics · Data sourced from Shopify · Refreshed on page load
          </div>
        </div>
      </main>
    </div>
  )
}
