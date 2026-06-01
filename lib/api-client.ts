const SUPABASE_API_BASE =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/functions/v1/api'
const NEXT_API_BASE = '/api'

/**
 * Route group → backend mapping.
 * Flip a group from NEXT_API_BASE to SUPABASE_API_BASE as each phase migrates.
 * At migration end, replace this entire map with a single SUPABASE_API_BASE.
 */
const routeBackend: Record<string, string> = {
  // Phase 0: only health is on Supabase
  health: SUPABASE_API_BASE,

  // Everything else stays on Next.js until migrated
  // Phase 1 will flip: tags, macros, profile, tasks, etc.
  // Phase 2 will flip: shopify
  // Phase 3 will flip: inbox, auth/gmail, auth/outlook, auth/forwarding-email
  // Phase 4 will flip: billing, webhooks, workspace, account, uploads
  // Phase 5 will flip: admin, cron
}

/**
 * Resolves the full URL for an API path.
 *
 * @param path - API path without leading slash (e.g., 'tags', 'shopify/orders/123/cancel')
 * @returns Full URL pointing to the correct backend
 *
 * @example
 *   apiUrl('health')              → 'https://xxx.supabase.co/functions/v1/api/health'
 *   apiUrl('tags')                → '/api/tags'  (not yet migrated)
 *   apiUrl('shopify/orders/123')  → '/api/shopify/orders/123'  (not yet migrated)
 */
export function apiUrl(path: string): string {
  const group = path.split('/')[0]
  const base = routeBackend[group] ?? NEXT_API_BASE
  return `${base}/${path}`
}
