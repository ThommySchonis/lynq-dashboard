const SUPABASE_API_BASE =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/functions/v1/api'
const NEXT_API_BASE = '/api'

/**
 * Paths routed to Hono Edge Function.
 * Each entry is matched as a prefix against the incoming path.
 * Order: longest prefix first for correct matching.
 */
const honoRoutes: string[] = [
  // Fully ported route groups
  'health',
  'profile',
  'onboarding/',
  'settings/brand',
  'settings/integrations/email',
  'settings/integrations',
  'workspaces/logo',
  'workspaces/repair-membership',
  'inbox/counts',
  'inbox/accounts',
  'inbox/conversations',
  'auth/impersonation-status',
  'auth/consent-sync',
  'auth/mfa/cleanup',
  'auth/recovery-codes',
  'email/dns',
  'marketplace/',
  'exams/questions',
  'exams/result',
  'lynq-admin/',
  'admin/',
  'invites/',
  'shopify/',
]

/**
 * Resolves the full URL for an API path.
 *
 * @param path - API path without leading slash (e.g., 'health', 'shopify/orders/123')
 * @returns Full URL pointing to the correct backend
 */
export function apiUrl(path: string): string {
  const isHono = honoRoutes.some(
    (prefix) => path === prefix || path.startsWith(prefix)
  )
  const base = isHono ? SUPABASE_API_BASE : NEXT_API_BASE
  return `${base}/${path}`
}
