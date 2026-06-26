// Helpers for the Performance (support analytics) page.

import type { SupportAnalyticsDateRange } from '@/types/support-analytics'

const MS_PER_DAY = 86_400_000

/**
 * Returns the previous date range of equal length, immediately preceding the
 * given range. Used to compute KPI deltas ("vs last period") on the client.
 */
export function computePrevRange(range: SupportAnalyticsDateRange): SupportAnalyticsDateRange {
  const from = new Date(`${range.from}T00:00:00`)
  const to = new Date(`${range.to}T00:00:00`)
  const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1

  const prevTo = new Date(from)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))

  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  }
}

/**
 * Formats a support-analytics date range into the Figma subtitle label,
 * e.g. "May 25 – Jun 1, 2026". The year is shown once, on the end date.
 */
export function formatDateRangeLabel(from: string, to: string): string {
  if (!from || !to) return ''
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}
