import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

/**
 * The backend returns `{ error: 'Unauthorized' }` (HTTP 401) from every
 * authenticated route when the caller's access token is missing/expired/invalid
 * — see `authMiddleware` (Hono) and `getAuthContext` (Next.js). Fetch helpers
 * surface that body as `Error('Unauthorized')`, so this is our global signal
 * that the session is no longer usable. Permission failures are 403 with
 * different messages, so they are correctly excluded.
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Unauthorized'
}

// Dedupe concurrent recoveries (many queries 401 at once) into one attempt.
let inFlight: Promise<boolean> | null = null
// Timestamp of the last successful refresh, to detect a refresh-doesn't-help loop.
let lastRefreshAt = 0
// Exposed for tests so state doesn't leak between cases.
export function __resetAuthRecovery(): void {
  inFlight = null
  lastRefreshAt = 0
}

/**
 * Recover from an auth (401) failure.
 *
 * A Supabase access token is short-lived; normally supabase-js refreshes it
 * silently. But after the tab is suspended for a long time (or a refresh
 * fails) the client can hold an expired token inside a still-truthy `session`,
 * so `AuthGuard` neither redirects to /login nor recovers — every request
 * loops on 401 (the "billing subscription" white screen).
 *
 * On a 401 we:
 *  1. Force one `refreshSession()`. If the refresh token is still valid this
 *     mints a fresh access token and callers can retry — returns `true`.
 *  2. If refresh fails (or returns no session), clear the store. `AuthGuard`
 *     sees a falsy session and redirects to /login — returns `false`.
 *  3. If we already refreshed moments ago and are still getting 401s, the new
 *     token is being rejected server-side; stop looping and force re-login.
 *
 * @returns `true` if the session was refreshed (retry queries), `false` if the
 *          user was signed out.
 */
export async function recoverAuth(): Promise<boolean> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    if (Date.now() - lastRefreshAt < 10_000) {
      useAuthStore.getState().clearSession()
      return false
    }

    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) {
      useAuthStore.getState().clearSession()
      return false
    }

    lastRefreshAt = Date.now()
    return true
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}
