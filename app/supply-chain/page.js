'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS = {
  PENDING:          { label: 'Pending',           color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.2)' },
  INFO_RECEIVED:    { label: 'Info Received',      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.2)'  },
  IN_TRANSIT:       { label: 'In Transit',         color: '#A175FC', bg: 'rgba(161,117,252,0.12)', border: 'rgba(161,117,252,0.22)'},
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.2)'  },
  DELIVERED:        { label: 'Delivered',          color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.2)'  },
  EXCEPTION:        { label: 'Exception',          color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.2)' },
  FAILED_ATTEMPT:   { label: 'Failed Attempt',     color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.2)'  },
  EXPIRED:          { label: 'Expired',            color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.2)' },
}

function getStatus(key) { return STATUS[key] || STATUS.PENDING }

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }

  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

  .sc-root * { box-sizing:border-box;margin:0;padding:0 }
  .sc-root { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased }
  .sc-scroll::-webkit-scrollbar       { width:3px }
  .sc-scroll::-webkit-scrollbar-track { background:transparent }
  .sc-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1);border-radius:2px }

  .sc-card {
    background:linear-gradient(148deg,#271555 0%,#1e1042 55%,#190d38 100%);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:16px; padding:22px 24px;
    transition:border-color .2s,box-shadow .2s;
  }

  .sc-row {
    background:linear-gradient(148deg,#221248 0%,#1b0e3a 100%);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:14px;
    transition:border-color .2s,box-shadow .2s;
    overflow:hidden;
  }
  .sc-row:hover { border-color:rgba(255,255,255,0.14); box-shadow:0 6px 24px rgba(0,0,0,0.3) }

  .sc-search {
    width:100%; padding:10px 14px 10px 38px;
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.09);
    border-radius:10px; color:#F8FAFC;
    font-size:13.5px; font-family:inherit;
    outline:none; transition:border-color .15s;
  }
  .sc-search::placeholder { color:rgba(255,255,255,0.25) }
  .sc-search:focus { border-color:rgba(161,117,252,0.4) }

  .sc-filter-btn {
    padding:6px 14px; border-radius:8px; border:1px solid transparent;
    font-size:12px; font-weight:600; cursor:pointer;
    font-family:inherit; transition:all .15s; white-space:nowrap;
  }

  .sc-spinner {
    width:18px; height:18px; border-radius:50%;
    border:2px solid rgba(161,117,252,0.2);
    border-top-color:#A175FC;
    animation:spin .7s linear infinite;
  }

  .sc-skeleton {
    background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.04) 75%);
    background-size:200% 100%;
    animation:pulse 1.5s ease-in-out infinite;
    border-radius:6px;
  }

  .cp-dot {
    width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:3px;
  }
  .cp-line {
    width:1px; flex:1; min-height:18px;
    background:rgba(255,255,255,0.08); margin:3px 0 3px 4.5px;
  }
`

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}
function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })
}

function StatusBadge({ status }) {
  const s = getStatus(status)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:700, color:s.color, background:s.bg, border:`1px solid ${s.border}`, whiteSpace:'nowrap' }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:s.color, flexShrink:0 }} />
      {s.label}
    </span>
  )
}

function CarrierBadge({ carrier }) {
  if (!carrier) return <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>—</span>
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:500 }}>
      {carrier.logo_url && <img src={carrier.logo_url} alt={carrier.name} style={{ height:13, objectFit:'contain', filter:'brightness(0) invert(1)', opacity:.7 }} />}
      {carrier.name}
    </span>
  )
}

function CheckpointTimeline({ checkpoints }) {
  if (!checkpoints?.length) return <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.3)', padding:'12px 0' }}>No tracking events yet.</p>
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {checkpoints.map((cp, i) => {
        const s = getStatus(cp.status)
        return (
          <div key={i} style={{ display:'flex', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:10 }}>
              <div className="cp-dot" style={{ background: i === 0 ? s.color : 'rgba(255,255,255,0.15)', boxShadow: i === 0 ? `0 0 8px ${s.color}80` : 'none' }} />
              {i < checkpoints.length - 1 && <div className="cp-line" />}
            </div>
            <div style={{ paddingBottom:16, flex:1, minWidth:0 }}>
              <p style={{ fontSize:13, color: i === 0 ? '#F8FAFC' : 'rgba(255,255,255,0.6)', lineHeight:1.45, marginBottom:3 }}>{cp.detail}</p>
              <p style={{ fontSize:11.5, color:'rgba(255,255,255,0.3)' }}>{fmtTime(cp.checkpoint_time)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ShipmentRow({ order, i }) {
  const [expanded, setExpanded] = useState(false)
  const shipment = order.shipments?.[0]
  if (!shipment) return null

  const s = getStatus(shipment.status)
  const isException = shipment.status === 'EXCEPTION' || shipment.status === 'FAILED_ATTEMPT'
  const products = shipment.products?.map(p => p.title).join(', ') || '—'

  return (
    <div className="sc-row" style={{ animation:`fadeUp .4s ease ${i * 40}ms both`, borderColor: isException ? 'rgba(248,113,113,0.2)' : undefined }}>
      {/* Main row */}
      <div
        style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto auto auto', gap:16, alignItems:'center', padding:'16px 20px', cursor:'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Order + customer */}
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <span style={{ fontSize:14, fontWeight:700, color:'#F8FAFC' }}>{order.order_number}</span>
            <StatusBadge status={shipment.status} />
          </div>
          <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.5)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {order.customer?.name || '—'}
          </p>
        </div>

        {/* Product */}
        <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {products}
        </p>

        {/* Carrier */}
        <CarrierBadge carrier={shipment.last_mile?.carrier_name ? { name: shipment.last_mile.carrier_name, logo_url: shipment.last_mile.carrier_logo_url } : shipment.carrier} />

        {/* Dates */}
        <div style={{ textAlign:'right', minWidth:90 }}>
          <p style={{ fontSize:11.5, color:'rgba(255,255,255,0.35)', marginBottom:2 }}>
            {shipment.status === 'DELIVERED' ? 'Delivered' : shipment.estimated_delivery_date ? 'Est. delivery' : 'Shipped'}
          </p>
          <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.72)', fontWeight:600 }}>
            {shipment.status === 'DELIVERED' ? fmt(shipment.delivery_date) : shipment.estimated_delivery_date ? fmt(shipment.estimated_delivery_date) : fmt(shipment.fulfillment_date)}
          </p>
        </div>

        {/* Expand chevron */}
        <div style={{ color:'rgba(255,255,255,0.25)', transition:'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display:'flex' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* Expanded: tracking details */}
      {expanded && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', padding:'20px 20px 20px 24px', animation:'fadeIn .2s ease both' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            {/* Left: tracking info */}
            <div>
              <p style={{ fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>Tracking Details</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  ['Tracking #', shipment.tracking_number],
                  ['Carrier', shipment.carrier?.name],
                  ['Last-mile carrier', shipment.last_mile?.carrier_name],
                  ['Last-mile tracking #', shipment.last_mile?.tracking_number],
                  ['Transit time', shipment.transit_time ? `${shipment.transit_time} days` : null],
                  ['Order date', fmt(shipment.order_date)],
                  ['Fulfillment date', fmt(shipment.fulfillment_date)],
                  ['Pickup date', fmt(shipment.pickup_date)],
                  ['Delivery date', fmt(shipment.delivery_date)],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                    <span style={{ fontSize:12, color:'rgba(255,255,255,0.35)', minWidth:130, flexShrink:0 }}>{label}</span>
                    <span style={{ fontSize:12.5, color:'rgba(255,255,255,0.75)', wordBreak:'break-all' }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Destination */}
              {order.shipping_address && (
                <div style={{ marginTop:18 }}>
                  <p style={{ fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Ship to</p>
                  <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.65)', lineHeight:1.6 }}>
                    {order.shipping_address.name}<br/>
                    {order.shipping_address.city}, {order.shipping_address.province_code} {order.shipping_address.zip}<br/>
                    {order.shipping_address.country}
                  </p>
                </div>
              )}

              {/* Tracking link */}
              {order.tracking_link && (
                <a href={order.tracking_link} target="_blank" rel="noopener noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:16, padding:'8px 14px', borderRadius:8, background:'rgba(161,117,252,0.1)', border:'1px solid rgba(161,117,252,0.2)', color:'#A175FC', fontSize:12.5, fontWeight:600, textDecoration:'none', transition:'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(161,117,252,0.18)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(161,117,252,0.1)'}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Track on carrier site
                </a>
              )}
            </div>

            {/* Right: checkpoint timeline */}
            <div>
              <p style={{ fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>Tracking Events</p>
              <CheckpointTimeline checkpoints={shipment.checkpoints} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTERS = ['All', 'In Transit', 'Out for Delivery', 'Exception', 'Delivered', 'Pending']
const FILTER_STATUS = {
  'In Transit':       ['IN_TRANSIT'],
  'Out for Delivery': ['OUT_FOR_DELIVERY'],
  'Exception':        ['EXCEPTION', 'FAILED_ATTEMPT'],
  'Delivered':        ['DELIVERED'],
  'Pending':          ['PENDING', 'INFO_RECEIVED', 'EXPIRED'],
}

export default function SupplyChainPage() {
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('All')
  const [token, setToken]           = useState('')

  const loadData = useCallback(async (sessionToken) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/parcel-panel/tracking', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load shipments')
      setOrders(data.orders || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setToken(session.access_token)
      loadData(session.access_token)
    })
  }, [loadData])

  // ── Derived state ──
  const allShipments = orders.flatMap(o =>
    (o.shipments || []).map(s => ({ ...s, _order: o }))
  )

  const counts = {
    inTransit:  allShipments.filter(s => s.status === 'IN_TRANSIT').length,
    outForDel:  allShipments.filter(s => s.status === 'OUT_FOR_DELIVERY').length,
    exceptions: allShipments.filter(s => ['EXCEPTION','FAILED_ATTEMPT'].includes(s.status)).length,
    delivered:  allShipments.filter(s => s.status === 'DELIVERED').length,
    avgTransit: (() => {
      const times = allShipments.filter(s => s.transit_time).map(s => s.transit_time)
      return times.length ? Math.round(times.reduce((a,b) => a+b, 0) / times.length) : null
    })(),
  }

  const filtered = orders.filter(o => {
    const shipment = o.shipments?.[0]
    if (!shipment) return false
    if (filter !== 'All' && !FILTER_STATUS[filter]?.includes(shipment.status)) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        o.order_number?.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        shipment.tracking_number?.toLowerCase().includes(q) ||
        shipment.carrier?.name?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const KPI_CARDS = [
    { label:'In Transit',      value: counts.inTransit,  color:'#A175FC', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg> },
    { label:'Out for Delivery', value: counts.outForDel,  color:'#f59e0b', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'Exceptions',       value: counts.exceptions, color:'#f87171', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
    { label:'Delivered',        value: counts.delivered,  color:'#4ade80', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
  ]

  return (
    <div className="sc-root" style={{ display:'flex', minHeight:'100vh', background:'#1C0F36', color:'#F8FAFC' }}>
      <style>{CSS}</style>
      <Sidebar />

      <main className="sc-scroll" style={{ flex:1, overflowY:'auto', padding:'40px 44px', position:'relative' }}>
        {/* Ambient glow */}
        <div style={{ position:'fixed', top:'-5%', right:'5%', width:'55%', height:'55%', background:'radial-gradient(ellipse,rgba(161,117,252,0.07) 0%,transparent 65%)', filter:'blur(50px)', pointerEvents:'none', zIndex:0 }} />

        <div style={{ position:'relative', zIndex:1, maxWidth:960, margin:'0 auto' }}>

          {/* ── Header ── */}
          <div style={{ animation:'fadeUp .4s ease both', marginBottom:36 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'rgba(161,117,252,0.1)', border:'1px solid rgba(161,117,252,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#A175FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <span style={{ fontSize:11.5, fontWeight:700, color:'rgba(255,255,255,0.52)', textTransform:'uppercase', letterSpacing:'.08em' }}>Supply Chain</span>
            </div>
            <h1 style={{ fontSize:34, fontWeight:800, letterSpacing:'-0.045em', lineHeight:1.1, marginBottom:10, background:'linear-gradient(135deg,#F8FAFC 0%,#c4a8ff 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              Shipment Tracker
            </h1>
            <p style={{ fontSize:14.5, color:'rgba(255,255,255,0.55)', lineHeight:1.65 }}>
              Live tracking powered by Parcel Panel — all your shipments in one view.
            </p>
            <div style={{ height:1, background:'rgba(255,255,255,0.07)', marginTop:24 }} />
          </div>

          {loading ? (
            /* ── Skeleton ── */
            <div style={{ animation:'fadeIn .3s ease both' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
                {[...Array(4)].map((_,i) => (
                  <div key={i} className="sc-card" style={{ height:88 }}>
                    <div className="sc-skeleton" style={{ height:14, width:'50%', marginBottom:10 }} />
                    <div className="sc-skeleton" style={{ height:28, width:'35%' }} />
                  </div>
                ))}
              </div>
              {[...Array(5)].map((_,i) => (
                <div key={i} className="sc-row" style={{ padding:'16px 20px', marginBottom:10, height:72 }}>
                  <div className="sc-skeleton" style={{ height:14, width:'30%', marginBottom:8 }} />
                  <div className="sc-skeleton" style={{ height:12, width:'20%' }} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p style={{ fontSize:15, fontWeight:700, color:'#F8FAFC', marginBottom:6 }}>Could not load shipments</p>
              <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.45)', marginBottom:20 }}>{error}</p>
              <button onClick={() => loadData(token)} style={{ padding:'9px 20px', borderRadius:9, background:'#A175FC', color:'#fff', border:'none', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* ── KPI cards ── */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28, animation:'fadeUp .4s ease .05s both' }}>
                {KPI_CARDS.map(({ label, value, color, icon }) => (
                  <div key={label} className="sc-card">
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                      <span style={{ fontSize:11.5, fontWeight:600, color:'rgba(255,255,255,0.45)', letterSpacing:'.02em' }}>{label}</span>
                      <div style={{ width:28, height:28, borderRadius:8, background:`${color}18`, border:`1px solid ${color}33`, display:'flex', alignItems:'center', justifyContent:'center', color }}>
                        {icon}
                      </div>
                    </div>
                    <div style={{ fontSize:28, fontWeight:800, color, letterSpacing:'-0.04em', lineHeight:1 }}>{value}</div>
                    {label === 'In Transit' && counts.avgTransit && (
                      <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:6 }}>avg {counts.avgTransit}d transit</p>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Search + Filters ── */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap', animation:'fadeUp .4s ease .1s both' }}>
                {/* Search */}
                <div style={{ position:'relative', flex:'1 1 220px', minWidth:180 }}>
                  <svg style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'rgba(255,255,255,0.28)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input className="sc-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, customer, tracking #…" />
                </div>

                {/* Filter buttons */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {FILTERS.map(f => {
                    const active = filter === f
                    const exc = f === 'Exception' && counts.exceptions > 0
                    return (
                      <button key={f} className="sc-filter-btn" onClick={() => setFilter(f)}
                        style={{
                          background: active ? 'rgba(161,117,252,0.15)' : exc ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.04)',
                          borderColor: active ? 'rgba(161,117,252,0.35)' : exc ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)',
                          color: active ? '#C4A0FF' : exc ? '#f87171' : 'rgba(255,255,255,0.55)',
                        }}>
                        {f}
                        {f === 'Exception' && counts.exceptions > 0 && (
                          <span style={{ marginLeft:5, background:'rgba(248,113,113,0.2)', border:'1px solid rgba(248,113,113,0.3)', color:'#f87171', fontSize:10, fontWeight:800, padding:'1px 5px', borderRadius:100 }}>{counts.exceptions}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Shipment list ── */}
              {filtered.length === 0 ? (
                <div className="sc-card" style={{ textAlign:'center', padding:'40px 20px', color:'rgba(255,255,255,0.3)', fontSize:13.5 }}>
                  {search || filter !== 'All' ? 'No shipments match this filter.' : 'No tracked shipments found.'}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10, animation:'fadeUp .4s ease .15s both' }}>
                  {filtered.map((order, i) => (
                    <ShipmentRow key={order.order_number || i} order={order} i={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
