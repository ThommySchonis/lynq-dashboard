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

/** Up to two uppercase initials for an avatar badge ("Maria K." → "MK", "Emma" → "E"). */
export function getAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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

/**
 * Format a duration in seconds as a compact human string:
 * `45s`, `2m 30s`, `1h 2m`, `1d 1h`.
 */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.round((seconds % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(seconds / 86400)
  const h = Math.round((seconds % 86400) / 3600)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}
