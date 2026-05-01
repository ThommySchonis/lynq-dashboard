import { supabaseAdmin, getUserFromToken } from './supabaseAdmin'

/**
 * Resolves the authenticated user + their workspace membership from a Bearer token.
 * Auto-provisions a workspace for users who don't have one yet (backward compat).
 *
 * Returns null if the token is missing or invalid.
 */
export async function getAuthContext(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return null

  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id, role, workspaces(id, name, owner_id)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) {
    return {
      user,
      workspace:   membership.workspaces,
      workspaceId: membership.workspace_id,
      role:        membership.role,
      memberId:    membership.id,
    }
  }

  // Auto-provision: first time this user hits a workspace-aware endpoint
  const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'My Workspace'
  const { data: workspace, error } = await supabaseAdmin
    .from('workspaces')
    .insert({ name: displayName, owner_id: user.id })
    .select()
    .single()

  if (error || !workspace) return null

  const { data: member } = await supabaseAdmin
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' })
    .select()
    .single()

  return {
    user,
    workspace,
    workspaceId: workspace.id,
    role:        'owner',
    memberId:    member?.id ?? null,
  }
}
