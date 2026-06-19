export function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

/** Inclusive {from,to} ISO date range (YYYY-MM-DD) for the trailing 30 days. */
export function last30DaysRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 86_400_000)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/** Coerce a possibly-string numeric value to a finite number (or null). */
function toNumber(value: number | string | undefined | null): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

/** Seconds → "X.XX hrs" (helpdesk KPI display). */
export function formatDurationHours(seconds: number | string | undefined): string {
  const n = toNumber(seconds)
  if (n == null || n <= 0) return '—'
  return `${(n / 3600).toFixed(2)} hrs`
}

/** Number → euro currency string. */
export function formatEur(value: number | string | undefined): string {
  const n = toNumber(value)
  if (n == null) return '—'
  return `€${n.toFixed(2)}`
}

/** Number → "X.X%". */
export function formatPercent(value: number | string | undefined): string {
  const n = toNumber(value)
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}
