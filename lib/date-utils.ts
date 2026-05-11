/** Relative time: "just now", "3m ago", "2h ago", "5d ago", "2mo ago", "1y ago" */
export function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, Date.now() - then)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  const y = Math.floor(mo / 12)
  return `${y}y ago`
}

/** Format date: "Jan 15, 2026"
 * Note: Similar fmtDate functions exist in lib/inbox-utils.ts and other files.
 * Consolidating those to use this shared version is deferred. */
export function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Time remaining until a future date */
export function timeUntil(dateStr: string): string | null {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return null
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days === 0 && hours < 2) return 'Starting soon'
  if (days === 0) return `Today in ${hours}h`
  if (days === 1) return 'Tomorrow'
  if (days < 7)  return `In ${days} days`
  if (days < 30) return `In ${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''}`
  return `In ${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''}`
}
