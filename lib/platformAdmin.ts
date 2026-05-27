// Platform-level admin identities for Lynq Agency super-admins.
//
// These accounts bypass workspace subscription gating because they are
// internal operators, not paying customers. Array format allows adding
// future admin emails without changing call sites.
//
// NOTE: do NOT refactor the local `ADMIN_EMAIL` constants scattered across
// /api/admin/* and academy pages to use this — that is intentional scope
// isolation. Only the subscription gate (proxy.ts + onboarding/status)
// imports from here.

export const PLATFORM_ADMIN_EMAILS: readonly string[] = ['info@lynqagency.com']

/**
 * Returns true when the given user is a Lynq platform admin.
 * Safe to call with null/undefined — returns false.
 */
export function isPlatformAdmin(user: { email?: string | null } | null | undefined): boolean {
  return typeof user?.email === 'string' && PLATFORM_ADMIN_EMAILS.includes(user.email)
}
