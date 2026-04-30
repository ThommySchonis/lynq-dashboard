'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  PENDING:          { label: 'Pending',          color: '#888888', bg: 'rgba(0,0,0,0.04)',      border: 'rgba(0,0,0,0.08)'      },
  INFO_RECEIVED:    { label: 'Info Received',     color: '#555555', bg: 'rgba(0,0,0,0.04)',      border: 'rgba(0,0,0,0.08)'      },
  IN_TRANSIT:       { label: 'In Transit',        color: '#2563EB', bg: 'rgba(37,99,235,0.07)',  border: 'rgba(37,99,235,0.15)'  },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',  color: '#D97706', bg: 'rgba(217,119,6,0.07)',  border: 'rgba(217,119,6,0.15)'  },
  DELIVERED:        { label: 'Delivered',         color: '#16A34A', bg: 'rgba(22,163,74,0.07)',  border: 'rgba(22,163,74,0.15)'  },
  EXCEPTION:        { label: 'Exception',         color: '#DC2626', bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.15)'  },
  FAILED_ATTEMPT:   { label: 'Failed Attempt',    color: '#D97706', bg: 'rgba(217,119,6,0.07)',  border: 'rgba(217,119,6,0.15)'  },
  EXPIRED:          { label: 'Expired',           color: '#888888', bg: 'rgba(0,0,0,0.04)',      border: 'rgba(0,0,0,0.08)'      },
}
function getStatus(key) { return STATUS[key] || STATUS.PENDING }

// ── Attention types ───────────────────────────────────────────────────────────
const ATTENTION = {
  FAILED_ATTEMPT: {
    label: 'Failed Delivery',
    desc: 'Carrier attempted delivery but failed. Customer needs to reschedule or arrange pickup.',
    color: '#DC2626', bg: 'rgba(220,38,38,0.05)', border: 'rgba(220,38,38,0.12)',
    priority: 1,
    message: (name, num) =>
      `Hi ${name}, we noticed that the delivery of your order ${num} could not be completed. Please contact the carrier to reschedule delivery or collect the parcel at your nearest pickup point. Let us know if you need any help! 🙏`,
  },
  PICKUP_REQUIRED: {
    label: 'Pickup Required',
    desc: 'Package is waiting at a pickup point. Customer must collect it before it expires.',
    color: '#D97706', bg: 'rgba(217,119,6,0.05)', border: 'rgba(217,119,6,0.12)',
    priority: 1,
    message: (name, num) =>
      `Hi ${name}, your order ${num} is ready for pickup at your local pickup point or parcel locker. Please collect it as soon as possible — packages are usually held for 7–10 days before being returned. Let us know if you need help finding the location! 📦`,
  },
  EXCEPTION: {
    label: 'Shipping Exception',
    desc: 'An unexpected issue has occurred during shipping. Requires investigation.',
    color: '#D97706', bg: 'rgba(217,119,6,0.05)', border: 'rgba(217,119,6,0.12)',
    priority: 2,
    message: (name, num) =>
      `Hi ${name}, we've been notified of a shipping issue with your order ${num}. We are actively investigating and working to resolve this as quickly as possible. We'll keep you updated — thank you for your patience! 🙏`,
  },
  OVERDUE: {
    label: 'Overdue in Transit',
    desc: 'Shipment has been in transit for 7+ days with no tracking updates.',
    color: '#555555', bg: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.1)',
    priority: 3,
    message: (name, num) =>
      `Hi ${name}, we want to give you an update on your order ${num}. Your package is taking a little longer than expected to arrive. We are monitoring this closely and will let you know as soon as there's an update. Thank you for your patience! 🙏`,
  },
  EXPIRED: {
    label: 'Tracking Expired',
    desc: 'Tracking information has expired. Package may be lost or returned to sender.',
    color: '#888888', bg: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.10)',
    priority: 2,
    message: (name, num) =>
      `Hi ${name}, the tracking for your order ${num} has unfortunately expired. We are contacting the carrier to find out what happened and will update you as soon as we have news. We sincerely apologize for the inconvenience! 🙏`,
  },
}

const PICKUP_PATTERN = /pickup|collect|afhaalpunt|ophaallocatie|parcel\s*shop|service\s*point|locker|pakketpunt|inleverpunt|pakket.*punt|vous\s*pouvez.*retirer|abholung|abholen/i

function getAttentionItems(orders, dismissed) {
  const items = []
  const now = Date.now()
  for (const order of orders) {
    const shipment = order.shipments?.[0]
    if (!shipment) continue
    const key = order.order_number || order.id
    if (dismissed.has(key)) continue

    const lastCp = shipment.checkpoints?.[0]
    const daysSince = lastCp?.checkpoint_time
      ? Math.round((now - new Date(lastCp.checkpoint_time)) / 86400000)
      : null

    const add = (type) => items.push({ key, order, shipment, type, daysSince, lastDetail: lastCp?.detail || '', cfg: ATTENTION[type] })

    if (shipment.status === 'FAILED_ATTEMPT') { add('FAILED_ATTEMPT'); continue }
    if (shipment.status === 'EXCEPTION')       { add('EXCEPTION');       continue }
    if (shipment.status === 'EXPIRED')         { add('EXPIRED');         continue }

    if (shipment.status !== 'DELIVERED') {
      const hasPickup = shipment.checkpoints?.some(cp => PICKUP_PATTERN.test(cp.detail || ''))
      if (hasPickup) { add('PICKUP_REQUIRED'); continue }
    }

    if (shipment.status === 'IN_TRANSIT' && daysSince !== null && daysSince >= 7) {
      add('OVERDUE')
    }
  }
  return items.sort((a, b) => a.cfg.priority - b.cfg.priority)
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes skWave { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

  .sc-root * { box-sizing:border-box;margin:0;padding:0 }
  .sc-root { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased }
  .sc-scroll::-webkit-scrollbar       { width:3px }
  .sc-scroll::-webkit-scrollbar-track { background:transparent }
  .sc-scroll::-webkit-scrollbar-thumb { background:var(--scrollbar);border-radius:2px }

  .sc-card {
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:16px; padding:20px 22px;
    box-shadow:var(--shadow-card);
    transition:border-color .2s,box-shadow .2s;
  }
  .sc-card:hover { border-color:var(--border-hover);box-shadow:var(--shadow-card-hover) }

  .sc-row {
    background:var(--bg-row);
    border:1px solid var(--border);
    border-radius:14px; overflow:hidden;
    box-shadow:var(--shadow-row);
    transition:border-color .2s,box-shadow .2s;
  }
  .sc-row:hover { border-color:var(--border-hover);box-shadow:var(--shadow-row-hover) }

  .sc-attn {
    border-radius:14px; overflow:hidden;
    transition:box-shadow .2s,transform .2s;
  }
  .sc-attn:hover { transform:translateY(-1px);box-shadow:var(--shadow-card-hover) }

  .sc-search {
    width:100%; padding:10px 14px 10px 38px;
    background:var(--bg-input); border:1px solid var(--border);
    border-radius:10px; color:var(--text-1); font-size:13.5px; font-family:inherit;
    outline:none; transition:border-color .15s;
  }
  .sc-search::placeholder { color:var(--text-3) }
  .sc-search:focus { border-color:var(--border-hover) }

  .sc-tab {
    padding:6px 13px; border-radius:8px; border:1px solid rgba(0,0,0,0.08);
    font-size:12px; font-weight:600; cursor:pointer; font-family:inherit;
    transition:all .15s; white-space:nowrap; background:#FAFAFA;
    color:#888888;
  }
  .sc-tab:hover:not(.sc-tab-active) { color:var(--text-2);background:var(--bg-surface-2) }
  .sc-tab-active { background:#111111;border-color:transparent;color:#FFFFFF }

  .sc-btn {
    display:inline-flex; align-items:center; gap:5px;
    padding:6px 12px; border-radius:8px; border:1px solid transparent;
    font-size:12px; font-weight:600; cursor:pointer; font-family:inherit;
    transition:all .15s; text-decoration:none; white-space:nowrap;
  }

  .sc-spinner {
    width:16px;height:16px;border-radius:50%;
    border:2px solid var(--accent-border);border-top-color:var(--accent);
    animation:spin .7s linear infinite;
  }

  .sc-skeleton {
    background:linear-gradient(90deg,var(--skeleton-from) 25%,var(--skeleton-to) 50%,var(--skeleton-from) 75%);
    background-size:200% 100%;
    animation:skWave 1.5s ease-in-out infinite;
    border-radius:6px;
  }

  .cp-dot  { width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:3px }
  .cp-line { width:1px;flex:1;min-height:18px;background:var(--border);margin:3px 0 3px 4.5px }

  .sc-setup-input {
    width:100%; padding:12px 16px;
    background:var(--bg-input); border:1px solid var(--border);
    border-radius:10px; color:var(--text-1); font-size:14px; font-family:inherit;
    outline:none; transition:border-color .15s;
  }
  .sc-setup-input:focus { border-color:var(--border-hover);background:var(--bg-surface-2) }
  .sc-setup-input::placeholder { color:var(--text-3) }
`

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function daysDiff(a, b = new Date()) {
  if (!a) return null
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = getStatus(status)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function CarrierBadge({ name, logoUrl }) {
  if (!name) return <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 8, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
      {logoUrl && <img src={logoUrl} alt={name} style={{ height: 13, objectFit: 'contain', opacity: .55 }} />}
      {name}
    </span>
  )
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className="sc-btn" onClick={copy} style={{ background: 'var(--bg-surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
      {copied
        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
        : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy message</>}
    </button>
  )
}

function CheckpointTimeline({ checkpoints }) {
  if (!checkpoints?.length) return <p style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '12px 0' }}>No tracking events yet.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {checkpoints.map((cp, i) => {
        const s = getStatus(cp.status)
        return (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 10 }}>
              <div className="cp-dot" style={{ background: i === 0 ? s.color : 'var(--bg-surface-2)', boxShadow: i === 0 ? `0 0 8px ${s.color}80` : 'none' }} />
              {i < checkpoints.length - 1 && <div className="cp-line" />}
            </div>
            <div style={{ paddingBottom: 16, flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: i === 0 ? 'var(--text-1)' : 'var(--text-2)', lineHeight: 1.45, marginBottom: 3 }}>{cp.detail}</p>
              {cp.location && <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{cp.location}</p>}
              <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{fmtTime(cp.checkpoint_time)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AttentionCard({ item, onDismiss }) {
  const { order, shipment, type, daysSince, lastDetail, cfg } = item
  const firstName = order.customer?.name?.split(' ')[0] || 'there'
  const orderNum  = order.order_number || '—'
  const carrier   = shipment.last_mile?.carrier_name || shipment.carrier?.name
  const phone     = order.customer?.phone
  const msg       = cfg.message(firstName, orderNum)

  return (
    <div className="sc-attn" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div style={{ padding: '16px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{orderNum}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, padding: '2px 8px', borderRadius: 100 }}>{cfg.label}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {order.customer?.name || 'Unknown customer'}
              {carrier && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>· {carrier}</span>}
            </p>
          </div>
          {daysSince !== null && (
            <span style={{ fontSize: 11, fontWeight: 600, color: daysSince >= 10 ? '#DC2626' : 'var(--text-3)', flexShrink: 0 }}>
              {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
            </span>
          )}
        </div>

        {/* Last event or description */}
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.55 }}>
          {lastDetail || cfg.desc}
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <CopyBtn text={msg} />
          {phone && (
            <a className="sc-btn" href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              style={{ background: 'rgba(37,211,102,0.08)', color: '#25d366', border: '1px solid rgba(37,211,102,0.2)', textDecoration: 'none' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              WhatsApp
            </a>
          )}
          <button className="sc-btn" onClick={() => onDismiss(item.key)}
            style={{ background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Mark resolved
          </button>
        </div>
      </div>
    </div>
  )
}

function ShipmentRow({ order, i, attentionKey }) {
  const [expanded, setExpanded] = useState(false)
  const shipment = order.shipments?.[0]
  if (!shipment) return null

  const isIssue    = attentionKey
  const carrierName = shipment.last_mile?.carrier_name || shipment.carrier?.name
  const carrierLogo = shipment.last_mile?.carrier_logo_url || shipment.carrier?.logo_url
  const products    = shipment.products?.map(p => p.title).join(', ') || '—'

  return (
    <div className="sc-row" style={{ animation: `fadeUp .4s ease ${i * 35}ms both`, borderColor: isIssue ? 'rgba(248,113,113,0.18)' : undefined }}>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 16, alignItems: 'center', padding: '15px 20px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{order.order_number}</span>
            <StatusBadge status={shipment.status} />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {order.customer?.name || '—'}
          </p>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{products}</p>

        <CarrierBadge name={carrierName} logoUrl={carrierLogo} />

        <div style={{ textAlign: 'right', minWidth: 90 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>
            {shipment.status === 'DELIVERED' ? 'Delivered' : shipment.estimated_delivery_date ? 'Est. delivery' : 'Shipped'}
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>
            {shipment.status === 'DELIVERED'
              ? fmt(shipment.delivery_date)
              : shipment.estimated_delivery_date
                ? fmt(shipment.estimated_delivery_date)
                : fmt(shipment.fulfillment_date)}
          </p>
        </div>

        <div style={{ color: 'var(--text-3)', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none', display: 'flex' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--divider)', padding: '20px 20px 22px 24px', animation: 'fadeIn .2s ease both' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>Tracking Details</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Tracking #',        shipment.tracking_number],
                  ['Carrier',           shipment.carrier?.name],
                  ['Last-mile carrier', shipment.last_mile?.carrier_name],
                  ['Transit time',      shipment.transit_time ? `${shipment.transit_time} days` : null],
                  ['Fulfillment date',  fmt(shipment.fulfillment_date)],
                  ['Delivery date',     fmt(shipment.delivery_date)],
                ].filter(([, v]) => v && v !== '—').map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 130, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-2)', wordBreak: 'break-all' }}>{val}</span>
                  </div>
                ))}
              </div>
              {order.shipping_address && (
                <div style={{ marginTop: 18 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Ship to</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
                    {order.shipping_address.name}<br />
                    {order.shipping_address.city}{order.shipping_address.province_code ? `, ${order.shipping_address.province_code}` : ''} {order.shipping_address.zip}<br />
                    {order.shipping_address.country}
                  </p>
                </div>
              )}
              {order.tracking_link && (
                <a href={order.tracking_link} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '8px 14px', borderRadius: 8, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Track on carrier site
                </a>
              )}
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>Tracking Events</p>
              <CheckpointTimeline checkpoints={shipment.checkpoints} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Setup screen ──────────────────────────────────────────────────────────────
function SetupScreen({ token, onConnected }) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const connect = async () => {
    if (!apiKey.trim()) return
    setSaving(true); setErr('')
    const endpoint = '/api/parcel-panel/connect'
    console.log('API key ingevoerd:', apiKey.trim().slice(0, 8) + '…')
    console.log('Versturen naar:', endpoint)
    try {
      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      console.log('Response:', res.status, data)
      if (!res.ok) throw new Error(data.error || 'Failed to connect')
      onConnected()
    } catch (e) {
      console.error('Connect error:', e)
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 0', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: '#F5F5F5', border: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-1)', marginBottom: 10 }}>Connect Parcel Panel</h2>
      <p style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 420, lineHeight: 1.7, marginBottom: 36 }}>
        Link your Parcel Panel account to track all shipments, detect delivery issues automatically, and get proactive alerts — all in one place.
      </p>

      <div style={{ width: '100%', maxWidth: 420, textAlign: 'left' }}>
        {/* Steps */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>How to find your API key</p>
          {['Open the Parcel Panel app in your Shopify admin', 'Go to Integration', 'Scroll to the bottom — your API key is listed there'].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 2 ? 10 : 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: '#F5F5F5', border: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#888888', flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, paddingTop: 2 }}>{step}</p>
            </div>
          ))}
        </div>

        <input
          className="sc-setup-input"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && connect()}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          type="password"
          style={{ marginBottom: 10 }}
        />
        {err && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, padding: '10px 12px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.14)', borderRadius: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style={{ fontSize: 12.5, color: '#DC2626', lineHeight: 1.5 }}>{err}</p>
          </div>
        )}
        <button
          onClick={connect}
          disabled={saving || !apiKey.trim()}
          style={{ width: '100%', padding: '12px', borderRadius: 10, background: saving || !apiKey.trim() ? '#F5F5F5' : '#111111', color: saving || !apiKey.trim() ? '#BDBDBD' : '#FFFFFF', border: '1px solid', borderColor: saving || !apiKey.trim() ? 'rgba(0,0,0,0.08)' : 'transparent', fontSize: 14, fontWeight: 700, cursor: saving || !apiKey.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
          {saving ? 'Connecting…' : 'Connect Parcel Panel'}
        </button>
      </div>
    </div>
  )
}

// ── Filters ───────────────────────────────────────────────────────────────────
const FILTER_STATUS = {
  'In Transit':       ['IN_TRANSIT'],
  'Out for Delivery': ['OUT_FOR_DELIVERY'],
  'Exception':        ['EXCEPTION', 'FAILED_ATTEMPT'],
  'Delivered':        ['DELIVERED'],
  'Pending':          ['PENDING', 'INFO_RECEIVED', 'EXPIRED'],
}
const ALL_FILTERS = ['All', 'Needs Attention', 'In Transit', 'Out for Delivery', 'Exception', 'Delivered', 'Pending']

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SupplyChainPage() {
  const [orders, setOrders]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [search, setSearch]             = useState('')
  const [filter, setFilter]             = useState('All')
  const [token, setToken]               = useState('')
  const [dismissed, setDismissed]       = useState(new Set())
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [showAllAttention, setShowAllAttention] = useState(false)

  const loadData = useCallback(async (sessionToken) => {
    setLoading(true); setError(''); setNotConfigured(false)
    try {
      const res  = await fetch('/api/parcel-panel/tracking', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      const data = await res.json()
      if (res.status === 404) { setNotConfigured(true); return }
      if (!res.ok) throw new Error(data.error || 'Could not load shipments')
      setOrders(data.orders || [])
      setLastUpdated(new Date())
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

  const dismiss = useCallback((key) => setDismissed(prev => new Set([...prev, key])), [])

  // ── Derived ──
  const allShipments = useMemo(() =>
    orders.flatMap(o => (o.shipments || []).map(s => ({ ...s, _order: o }))),
    [orders]
  )

  const attentionItems = useMemo(() => getAttentionItems(orders, dismissed), [orders, dismissed])
  const attentionKeys  = useMemo(() => new Set(attentionItems.map(i => i.key)), [attentionItems])

  const counts = useMemo(() => {
    const delivered = allShipments.filter(s => s.status === 'DELIVERED')
    const withTransit = delivered.filter(s => s.delivery_date && s.fulfillment_date)
    const withEst     = delivered.filter(s => s.estimated_delivery_date && s.delivery_date)
    return {
      inTransit:  allShipments.filter(s => s.status === 'IN_TRANSIT').length,
      outForDel:  allShipments.filter(s => s.status === 'OUT_FOR_DELIVERY').length,
      delivered:  delivered.length,
      avgDays: withTransit.length
        ? Math.round(withTransit.reduce((sum, s) => sum + daysDiff(s.fulfillment_date, s.delivery_date), 0) / withTransit.length)
        : null,
      onTimeRate: withEst.length
        ? Math.round(withEst.filter(s => new Date(s.delivery_date) <= new Date(s.estimated_delivery_date)).length / withEst.length * 100)
        : null,
    }
  }, [allShipments])

  const filtered = useMemo(() => orders.filter(o => {
    const s = o.shipments?.[0]
    if (!s) return false
    if (filter === 'Needs Attention') {
      if (!attentionKeys.has(o.order_number || o.id)) return false
    } else if (filter !== 'All') {
      if (!FILTER_STATUS[filter]?.includes(s.status)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        o.order_number?.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        s.tracking_number?.toLowerCase().includes(q) ||
        (s.carrier?.name || '').toLowerCase().includes(q)
      )
    }
    return true
  }), [orders, filter, search, attentionKeys])

  const visibleAttention = showAllAttention ? attentionItems : attentionItems.slice(0, 3)

  // ── KPI config ──
  const attnColor = attentionItems.length > 0 ? '#DC2626' : '#16A34A'
  const KPIS = [
    { label: 'In Transit',       value: counts.inTransit,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg> },
    { label: 'Out for Delivery', value: counts.outForDel,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: 'Needs Attention',  value: attentionItems.length, accentColor: attnColor,
      sub: attentionItems.length > 0 ? 'action required' : 'all good',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
    { label: 'Avg Delivery',     value: counts.avgDays ? `${counts.avgDays}d` : '—',
      sub: counts.onTimeRate !== null ? `${counts.onTimeRate}% on time` : null,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
    { label: 'Delivered',        value: counts.delivered,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
  ]

  return (
    <div className="sc-root" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-1)' }}>
      <style>{CSS}</style>
      <Sidebar />

      <main className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '40px 44px', position: 'relative' }}>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 980, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ animation: 'fadeUp .4s ease both', marginBottom: notConfigured ? 0 : 30 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Supply Chain</span>
                </div>
                <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, marginBottom: 8, color: 'var(--text-1)' }}>
                  Shipment Tracker
                </h1>
                <p style={{ fontSize: 14, color: 'var(--text-3)' }}>
                  {lastUpdated
                    ? `Last updated at ${lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Live tracking powered by Parcel Panel'}
                </p>
              </div>

              {!notConfigured && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
                  <button
                    onClick={() => loadData(token)} disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={loading ? { animation: 'spin .8s linear infinite' } : {}}>
                      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    Refresh
                  </button>
                </div>
              )}
            </div>
            {!notConfigured && <div style={{ height: 1, background: 'var(--bg-surface-2)', marginTop: 22 }} />}
          </div>

          {/* ── Setup ── */}
          {notConfigured && <SetupScreen token={token} onConnected={() => { setNotConfigured(false); loadData(token) }} />}

          {/* ── Skeleton ── */}
          {loading && !notConfigured && (
            <div style={{ animation: 'fadeIn .3s ease both' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 28 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="sc-card" style={{ height: 84 }}>
                    <div className="sc-skeleton" style={{ height: 11, width: '55%', marginBottom: 10 }} />
                    <div className="sc-skeleton" style={{ height: 26, width: '40%' }} />
                  </div>
                ))}
              </div>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="sc-row" style={{ padding: '15px 20px', marginBottom: 10, height: 68 }}>
                  <div className="sc-skeleton" style={{ height: 13, width: '28%', marginBottom: 8 }} />
                  <div className="sc-skeleton" style={{ height: 11, width: '18%' }} />
                </div>
              ))}
            </div>
          )}

          {/* ── Error ── */}
          {error && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>Could not load shipments</p>
              <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 20 }}>{error}</p>
              <button onClick={() => loadData(token)} style={{ padding: '9px 20px', borderRadius: 9, background: '#111111', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Try again
              </button>
            </div>
          )}

          {/* ── Main content ── */}
          {!loading && !error && !notConfigured && (
            <>
              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 30, animation: 'fadeUp .4s ease .05s both' }}>
                {KPIS.map(({ label, value, accentColor, sub, icon }) => (
                  <div key={label} className="sc-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#BDBDBD', letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: '#F5F5F5', border: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor || '#555555' }}>{icon}</div>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: accentColor || 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
                    {sub && <p style={{ fontSize: 10.5, color: accentColor ? accentColor : 'var(--text-3)', marginTop: 5 }}>{sub}</p>}
                  </div>
                ))}
              </div>

              {/* ── Action Required section ── */}
              {attentionItems.length > 0 && (
                <div style={{ marginBottom: 32, animation: 'fadeUp .4s ease .1s both' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Action Required</span>
                      <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626', padding: '2px 8px', borderRadius: 100 }}>{attentionItems.length}</span>
                    </div>
                    {attentionItems.length > 3 && (
                      <button onClick={() => setShowAllAttention(a => !a)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                        {showAllAttention ? 'Show less' : `Show all ${attentionItems.length}`}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 12 }}>
                    {visibleAttention.map(item => (
                      <AttentionCard key={item.key} item={item} onDismiss={dismiss} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Shipment list ── */}
              <div style={{ animation: 'fadeUp .4s ease .15s both' }}>
                {/* Search + filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 170 }}>
                    <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="sc-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, customer, tracking #…" />
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {ALL_FILTERS.map(f => {
                      const isAttn   = f === 'Needs Attention'
                      const isActive = filter === f
                      const hasIssue = isAttn && attentionItems.length > 0
                      return (
                        <button key={f} onClick={() => setFilter(f)}
                          className={`sc-tab${isActive ? ' sc-tab-active' : ''}`}
                          style={hasIssue && !isActive ? { color: '#DC2626', background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.14)' } : hasIssue && isActive ? { background: '#DC2626', borderColor: 'transparent', color: '#FFFFFF' } : {}}>
                          {f}
                          {isAttn && attentionItems.length > 0 && (
                            <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 800, background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(220,38,38,0.12)', color: isActive ? '#FFFFFF' : '#DC2626', padding: '1px 5px', borderRadius: 100, border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(220,38,38,0.2)' }}>{attentionItems.length}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                  {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}{filter !== 'All' ? ` · ${filter}` : ''}
                </p>

                {filtered.length === 0 ? (
                  <div className="sc-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', fontSize: 13.5 }}>
                    {orders.length === 0
                      ? 'No shipments found. Orders will appear here once tracking is active in Parcel Panel.'
                      : 'No shipments match this filter.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map((order, i) => (
                      <ShipmentRow
                        key={order.order_number || i}
                        order={order}
                        i={i}
                        attentionKey={attentionKeys.has(order.order_number || order.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
