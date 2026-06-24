// Formatting helpers for the billing surface (shared by current-plan card and
// billing-history table). Keep display logic here, not inline in components.

/** "July 6, 2026" (long) or "Jun 6, 2026" (short). Returns "—" for null. */
export function formatBillingDate(iso: string | null, month: 'long' | 'short' = 'long'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month, day: 'numeric' })
}

/** "$39.00" — formats an amount in its currency (defaults to USD). */
export function formatMoney(amount: number, currency = 'USD'): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: currency || 'USD' })
}
