const SUPABASE_API_BASE =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/functions/v1/api'
const NEXT_API_BASE = '/api'

/**
 * Route group → backend mapping.
 * Flip a group from NEXT_API_BASE to SUPABASE_API_BASE as each phase migrates.
 * At migration end, replace this entire map with a single SUPABASE_API_BASE.
 */
const routeBackend: Record<string, string> = {
  // Phase 0
  health: SUPABASE_API_BASE,

  // Phase 1: profile routes on Hono
  profile: SUPABASE_API_BASE,
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
