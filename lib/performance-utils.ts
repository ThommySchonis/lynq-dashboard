// Helpers for the Performance (support analytics) page.

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
