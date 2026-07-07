/**
 * Deterministically selects a user's primary workspace membership when they
 * belong to more than one workspace.
 *
 * This MUST stay in sync with:
 *   - `lib/pick-membership.ts` (Next.js mirror)
 *   - `get_user_workspace_id()` and `provision_workspace()` SQL (same ORDER BY)
 *
 * Rule: prefer an owned workspace, then the earliest `joined_at`, then `id`.
 * A user's own workspace (created at signup) predates any later invite or any
 * accidentally re-provisioned workspace, so this lands multi-workspace users on
 * their real "home" workspace consistently across every resolution path.
 *
 * Returns null only when the user has no memberships at all.
 */
export interface MembershipLike {
  id: string
  role: string
  joined_at: string
}

export function pickPrimaryMembership<T extends MembershipLike>(rows: T[]): T | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => {
    const aOwner = a.role === 'owner' ? 0 : 1
    const bOwner = b.role === 'owner' ? 0 : 1
    if (aOwner !== bOwner) return aOwner - bOwner
    if (a.joined_at !== b.joined_at) return a.joined_at < b.joined_at ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]
}
