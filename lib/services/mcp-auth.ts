import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAccessToken } from '@/lib/services/oauth-tokens'
import type { AuthContext, AuthWorkspace } from '@/lib/auth'

interface MembershipRow {
  id: string
  workspace_id: string
  role: string
  workspaces: AuthWorkspace
}

interface UserProfileRow {
  scheduled_for_deletion_at: string | null
}

/**
 * Resolves an MCP bearer access token to the same workspace-scoped AuthContext
 * used by the JWT path. The token's workspace must match the user's current
 * membership; otherwise the token is treated as invalid.
 */
export async function verifyMcpAccessToken(raw: string): Promise<AuthContext | null> {
  const verified = await verifyAccessToken(supabaseAdmin as never, raw)
  if (!verified) return null

  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id, role, workspaces(id, name, suspended_at)')
    .eq('user_id', verified.userId)
    .maybeSingle()

  if (error || !data) return null
  const membership = data as unknown as MembershipRow
  if (membership.workspace_id !== verified.workspaceId) return null

  const profileResult = await supabaseAdmin
    .from('user_profiles')
    .select('scheduled_for_deletion_at')
    .eq('user_id', verified.userId)
    .maybeSingle()

  const profile = profileResult.data as unknown as UserProfileRow | null

  return {
    user: { id: verified.userId } as AuthContext['user'],
    workspace: membership.workspaces,
    workspaceId: membership.workspace_id,
    role: membership.role,
    memberId: membership.id,
    isSuspended: !!membership.workspaces.suspended_at,
    scheduledForDeletion: profile?.scheduled_for_deletion_at ?? null,
    isImpersonating: false,
    impersonationSessionId: null,
  }
}
