// lib/services/workspace-members.ts
//
// Single source of truth for "who is in a workspace". Replaces the
// legacy team_members table (still in DB, dropped in a follow-up PR).
//
// EnrichedMember.id intentionally aliases workspace_members.user_id
// (= auth.users.id) so existing consumers — including
// time_sessions.agent_id and the useDeleteTeamMember mutation —
// keep working with the same id semantics they had with team_members.

import { supabaseAdmin } from '../supabaseAdmin'

export interface EnrichedMember {
  /** auth.users.id — matches time_sessions.agent_id. */
  id:           string
  workspace_id: string
  email:        string
  name:         string
  role:         string
  joined_at:    string
}

interface UserProfileRow {
  user_id:      string
  display_name: string | null
}

interface AuthUserMetadata {
  name?: string
  full_name?: string
}

// Pick the first present, non-empty name source.
function deriveName(
  profile: UserProfileRow | undefined,
  metadata: AuthUserMetadata | null | undefined,
  email: string,
): string {
  const candidates = [
    profile?.display_name,
    metadata?.name,
    metadata?.full_name,
    email ? email.split('@')[0] : null,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return 'Unknown'
}

/**
 * Returns workspace_members for the given workspace, enriched with
 * email + display_name from auth.users + user_profiles.
 *
 * Pass workspaceId=undefined to return ALL members across ALL workspaces
 * (Lynq super-admin view — only call from already-admin-gated routes).
 *
 * supabase.auth.admin.listUsers caps at perPage=1000. Project membership
 * lists are well under that today; if the project grows past 1k users,
 * paginate here.
 */
export async function getEnrichedMembers(opts: { workspaceId?: string } = {}): Promise<EnrichedMember[]> {
  let query = supabaseAdmin
    .from('workspace_members')
    .select('user_id, workspace_id, role, joined_at')
    .order('joined_at', { ascending: true })

  if (opts.workspaceId) {
    query = query.eq('workspace_id', opts.workspaceId)
  }

  const queryResult = await query
  if (queryResult.error) {
    console.error('[workspace-members] query failed:', queryResult.error.message)
    return []
  }

  interface MembershipRow { user_id: string; workspace_id: string; role: string; joined_at: string }
  const memberships = queryResult.data as MembershipRow[] | null
  if (!memberships || memberships.length === 0) return []

  const userIds = Array.from(new Set(memberships.map(m => m.user_id)))

  // auth.users via admin SDK. listUsers defaults to perPage=50; bump to 1000
  // and filter in-memory by the userIds we actually need.
  const { data: usersPayload, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (usersErr) {
    console.error('[workspace-members] listUsers failed:', usersErr.message)
  }
  const userById = new Map<string, { email: string; metadata: AuthUserMetadata | null }>()
  for (const u of usersPayload?.users ?? []) {
    if (userIds.includes(u.id)) {
      userById.set(u.id, {
        email:    u.email ?? '',
        metadata: (u.user_metadata as AuthUserMetadata | null) ?? null,
      })
    }
  }

  // user_profiles.display_name takes precedence over auth metadata.
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)
  const profileByUserId = new Map<string, UserProfileRow>()
  for (const p of (profiles as UserProfileRow[] | null) ?? []) {
    profileByUserId.set(p.user_id, p)
  }

  return memberships.map(m => {
    const u = userById.get(m.user_id)
    const p = profileByUserId.get(m.user_id)
    return {
      id:           m.user_id,
      workspace_id: m.workspace_id,
      email:        u?.email ?? '',
      name:         deriveName(p, u?.metadata, u?.email ?? ''),
      role:         m.role,
      joined_at:    m.joined_at,
    }
  })
}
