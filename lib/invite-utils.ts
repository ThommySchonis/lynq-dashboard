/**
 * Shared utilities and constants for invite pages.
 */

import { ROLE_LABELS } from './settings-constants'
import type { MemberRole } from '@/types/settings'

// Re-export the canonical map for consumers that need the full Record.
export { ROLE_LABELS }

/**
 * Returns the display label for a role string coming from API data (typed as
 * `string`, not `MemberRole`). Falls back to the raw value when unrecognised.
 */
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return ''
  return ROLE_LABELS[role as MemberRole] ?? role
}

/** Human-readable expiry label for an invite's `expires_at` timestamp. */
export function expiryText(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

export const ERROR_COPY: Record<string, { title: string; msg: string }> = {
  not_found:        { title: 'Invite not found',    msg: "We couldn't find this invitation. The link may be incorrect." },
  expired:          { title: 'Invite expired',       msg: 'This invitation has expired. Ask the workspace owner to send you a new one.' },
  already_accepted: { title: 'Already accepted',     msg: 'This invitation has already been accepted. Sign in to access your workspace.' },
  lookup_failed:    { title: 'Something went wrong', msg: 'Please try again in a moment.' },
}
