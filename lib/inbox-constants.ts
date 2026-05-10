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
    bg: 'var(--bg-input)',
    color: 'var(--text-3)',
    border: 'var(--bg-surface-2)',
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
}

export const URGENCY_SCORE: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}
