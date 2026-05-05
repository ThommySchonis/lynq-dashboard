// Pure helpers voor trial countdown / day 6 banner / blocked state.
// Geen DB calls — workspace object wordt door caller meegegeven.
//
// Workspace shape:
//   {
//     subscription_status: 'trial' | 'paying' | 'expired',
//     trial_ends_at:       'iso string' | null,
//     ...
//   }

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Aantal dagen tot trial_ends_at, ceil()'d.
 *   1.4 dagen → 2
 *   0.5 dag  → 1
 *   -0.2 dag → 0  (expired vandaag)
 *   -1.5 dag → -1 (gisteren expired)
 *
 * Returns null als geen trial_ends_at, of als status !== 'trial'.
 */
export function getTrialDaysRemaining(workspace) {
  if (!workspace) return null
  if (workspace.subscription_status !== 'trial') return null
  if (!workspace.trial_ends_at) return null
  const ms = new Date(workspace.trial_ends_at).getTime() - Date.now()
  return Math.ceil(ms / DAY_MS)
}

/**
 * True als status === 'trial' en trial_ends_at < now().
 * Gebruikt door BlockedStateGuard + proxy.js.
 */
export function isTrialExpired(workspace) {
  if (!workspace) return false
  if (workspace.subscription_status !== 'trial') return false
  if (!workspace.trial_ends_at) return false
  return new Date(workspace.trial_ends_at).getTime() < Date.now()
}

/**
 * True wanneer er nog tijd op het trial zit, maar binnen het laatste
 * 24-uurs venster. Drijft de Day 6 soft-warning banner aan.
 */
export function isTrialEndingSoon(workspace) {
  if (!workspace) return false
  if (workspace.subscription_status !== 'trial') return false
  if (!workspace.trial_ends_at) return false
  const msRemaining = new Date(workspace.trial_ends_at).getTime() - Date.now()
  return msRemaining > 0 && msRemaining <= DAY_MS
}
