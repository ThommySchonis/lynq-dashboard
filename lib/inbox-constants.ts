// ─── Inbox status configs ─────────────────────────────────────
export const STATUS = {
  open: {
    label: 'Open',
    bg: 'rgba(37,99,235,0.08)',
    color: '#2563eb',
    border: 'rgba(37,99,235,0.2)',
  },
  pending: {
    label: 'Pending',
    bg: 'rgba(251,191,36,0.14)',
    color: '#fbbf24',
    border: 'rgba(251,191,36,0.3)',
  },
  resolved: {
    label: 'Resolved',
    bg: 'rgba(74,222,128,0.14)',
    color: '#4ade80',
    border: 'rgba(74,222,128,0.3)',
  },
  closed: {
    label: 'Closed',
    bg: 'var(--input)',
    color: 'var(--foreground-3)',
    border: 'var(--secondary)',
  },
} as const

export const ORDER_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  paid:        { bg: 'rgba(74,222,128,0.14)',  color: '#4ade80', label: 'Paid' },
  unpaid:      { bg: 'rgba(251,146,60,0.14)',  color: '#fb923c', label: 'Unpaid' },
  fulfilled:   { bg: 'rgba(74,222,128,0.14)',  color: '#4ade80', label: 'Fulfilled' },
  unfulfilled: { bg: 'rgba(251,146,60,0.14)',  color: '#fb923c', label: 'Unfulfilled' },
  partial:     { bg: 'rgba(251,191,36,0.14)',  color: '#fbbf24', label: 'Partial' },
  refunded:    { bg: 'rgba(248,113,133,0.14)', color: '#fb7185', label: 'Refunded' },
  cancelled:   { bg: 'rgba(248,113,133,0.14)', color: '#fb7185', label: 'Cancelled' },
  voided:      { bg: 'rgba(248,113,133,0.14)', color: '#fb7185', label: 'Voided' },
  pending:     { bg: 'rgba(251,191,36,0.14)',  color: '#fbbf24', label: 'Pending' },
  authorized:  { bg: 'rgba(99,179,237,0.14)',  color: '#63b3ed', label: 'Authorized' },
  draft:       { bg: 'rgba(161,117,252,0.14)', color: '#a175fc', label: 'Draft' },
}

export const URGENCY_SCORE: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

// ─── Inbox folders ────────────────────────────────────────────
/** Single source of truth for the inbox folder tabs (thread-list-panel) and
 *  the sidebar Inbox submenu. Keys match useInboxCounts() fields; counts are
 *  applied at render time. Rendered as a horizontally-scrolling pill row in the
 *  thread list (Figma 782-21374), leading with Open / Pending / Resolved /
 *  Unlink. */
export interface InboxFolder {
  key: string
  label: string
}

export const INBOX_FOLDERS: InboxFolder[] = [
  { key: 'open',     label: 'Open'     },
  { key: 'pending',  label: 'Pending'  },
  { key: 'resolved', label: 'Resolved' },
  { key: 'unlinked', label: 'Unlink'   },
  { key: 'snoozed',  label: 'Snoozed'  },
  { key: 'spam',     label: 'Spam'     },
  { key: 'trash',    label: 'Trash'    },
]

// ─── Bulk-actions menu styling ────────────────────────────────
// Shared row/header recipes for the bulk-actions dropdown and its sub-panels
// (Figma 1310-59297 etc.) so a spacing/radius tweak lives in one place.
export const BULK_MENU_ROW_CLASS = 'gap-3 rounded-[9px] px-2.5 py-2'
export const BULK_MENU_HEADER_CLASS = 'px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-4'

// ─── Snooze presets ───────────────────────────────────────────
// Shared by the bulk-actions menu and the conversation top bar. Hours are
// resolved to an ISO "until" timestamp at click time via isoFromNow().
export const SNOOZE_OPTIONS: { label: string; hours: number }[] = [
  { label: 'Later today', hours: 4 },
  { label: 'Tomorrow', hours: 24 },
  { label: 'Next week', hours: 24 * 7 },
]
