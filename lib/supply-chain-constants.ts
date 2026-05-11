/**
 * Shared constants for the Supply Chain / Shipment Tracking module.
 * Extracted from app/supply-chain/page.js.
 */

import type {
  ShipmentStatusKey,
  StatusConfig,
  AttentionType,
  AttentionConfig,
  Order,
  AttentionItem,
  SupplyChainFilter,
} from '@/types/supply-chain'

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Difference in whole days between two dates. */
export function daysDiff(a: string | undefined, b: Date | string = new Date()): number {
  if (!a) return 0
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

/** Format ISO string to e.g. "May 11, 2026" */
export function fmtDate(iso: string | undefined): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Format ISO string to e.g. "May 11 · 02:30 PM" */
export function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' \u00b7 ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// ── Shipment status config ───────────────────────────────────────────────────

export const STATUS: Record<ShipmentStatusKey, StatusConfig> = {
  PENDING: { label: 'Pending', color: '#6B7280', bg: '#F5F5F5', border: '#F5F5F5' },
  INFO_RECEIVED: { label: 'Info Received', color: '#6B7280', bg: '#F5F5F5', border: '#F5F5F5' },
  IN_TRANSIT: { label: 'In Transit', color: '#2563EB', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: '#D97706', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
  DELIVERED: { label: 'Delivered', color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
  EXCEPTION: { label: 'Exception', color: '#DC2626', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)' },
  FAILED_ATTEMPT: { label: 'Failed Attempt', color: '#DC2626', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)' },
  EXPIRED: { label: 'Expired', color: '#6B7280', bg: '#F5F5F5', border: '#F5F5F5' },
}

export function getStatus(key: string): StatusConfig {
  return STATUS[key as ShipmentStatusKey] || STATUS.PENDING
}

// ── Attention types ──────────────────────────────────────────────────────────

export const ATTENTION: Record<AttentionType, AttentionConfig> = {
  FAILED_ATTEMPT: {
    label: 'Failed Delivery',
    desc: 'Carrier attempted delivery but failed. Customer needs to reschedule or arrange pickup.',
    color: '#DC2626', bg: 'rgba(220,38,38,0.05)', border: 'rgba(220,38,38,0.12)',
    priority: 1,
    message: (name: string, num: string) =>
      `Hi ${name}, we noticed that the delivery of your order ${num} could not be completed. Please contact the carrier to reschedule delivery or collect the parcel at your nearest pickup point. Let us know if you need any help! \uD83D\uDE4F`,
  },
  PICKUP_REQUIRED: {
    label: 'Pickup Required',
    desc: 'Package is waiting at a pickup point. Customer must collect it before it expires.',
    color: '#D97706', bg: 'rgba(217,119,6,0.05)', border: 'rgba(217,119,6,0.12)',
    priority: 1,
    message: (name: string, num: string) =>
      `Hi ${name}, your order ${num} is ready for pickup at your local pickup point or parcel locker. Please collect it as soon as possible \u2014 packages are usually held for 7\u201310 days before being returned. Let us know if you need help finding the location! \uD83D\uDCE6`,
  },
  EXCEPTION: {
    label: 'Shipping Exception',
    desc: 'An unexpected issue has occurred during shipping. Requires investigation.',
    color: '#D97706', bg: 'rgba(217,119,6,0.05)', border: 'rgba(217,119,6,0.12)',
    priority: 2,
    message: (name: string, num: string) =>
      `Hi ${name}, we've been notified of a shipping issue with your order ${num}. We are actively investigating and working to resolve this as quickly as possible. We'll keep you updated \u2014 thank you for your patience! \uD83D\uDE4F`,
  },
  OVERDUE: {
    label: 'Overdue in Transit',
    desc: 'Shipment has been in transit for 7+ days with no tracking updates.',
    color: '#555555', bg: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.1)',
    priority: 3,
    message: (name: string, num: string) =>
      `Hi ${name}, we want to give you an update on your order ${num}. Your package is taking a little longer than expected to arrive. We are monitoring this closely and will let you know as soon as there's an update. Thank you for your patience! \uD83D\uDE4F`,
  },
  EXPIRED: {
    label: 'Tracking Expired',
    desc: 'Tracking information has expired. Package may be lost or returned to sender.',
    color: '#888888', bg: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.10)',
    priority: 2,
    message: (name: string, num: string) =>
      `Hi ${name}, the tracking for your order ${num} has unfortunately expired. We are contacting the carrier to find out what happened and will update you as soon as we have news. We sincerely apologize for the inconvenience! \uD83D\uDE4F`,
  },
}

// ── Pickup pattern ───────────────────────────────────────────────────────────

export const PICKUP_PATTERN: RegExp = /pickup|collect|afhaalpunt|ophaallocatie|parcel\s*shop|service\s*point|locker|pakketpunt|inleverpunt|pakket.*punt|vous\s*pouvez.*retirer|abholung|abholen/i

// ── Filter list ──────────────────────────────────────────────────────────────

export const ALL_FILTERS: SupplyChainFilter[] = ['All', 'Needs Attention', 'In Transit', 'Out for Delivery', 'Exception', 'Delivered', 'Pending']

export const FILTER_STATUS: Record<string, string[]> = {
  'In Transit':       ['IN_TRANSIT'],
  'Out for Delivery': ['OUT_FOR_DELIVERY'],
  'Exception':        ['EXCEPTION', 'FAILED_ATTEMPT'],
  'Delivered':        ['DELIVERED'],
  'Pending':          ['PENDING', 'INFO_RECEIVED', 'EXPIRED'],
}

// ── Attention item builder ───────────────────────────────────────────────────

export function getAttentionItems(orders: Order[], dismissed: Set<string>): AttentionItem[] {
  const items: AttentionItem[] = []
  const now = Date.now()
  for (const order of orders) {
    const shipment = order.shipments?.[0]
    if (!shipment) continue
    const key = order.order_number || order.id
    if (dismissed.has(key)) continue

    const lastCp = shipment.checkpoints?.[0]
    const daysSince = lastCp?.checkpoint_time
      ? Math.round((now - new Date(lastCp.checkpoint_time).getTime()) / 86400000)
      : null

    const add = (type: AttentionType) => items.push({ key, order, shipment, type, daysSince, lastDetail: lastCp?.detail || '', cfg: ATTENTION[type] })

    if (shipment.status === 'FAILED_ATTEMPT') { add('FAILED_ATTEMPT'); continue }
    if (shipment.status === 'EXCEPTION') { add('EXCEPTION'); continue }
    if (shipment.status === 'EXPIRED') { add('EXPIRED'); continue }

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
