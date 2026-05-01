import { supabaseAdmin, getUserFromToken } from './supabaseAdmin'

/**
 * Resolves authenticated user + workspace membership from a Bearer token.
 *
 * Three paths:
 *   A) Membership row found → return immediately (fast path)
 *   B) Backfill: user owns a workspace but has no membership row → upsert it
 *   C) Provision: brand-new user → call provision_workspace RPC (atomic)
 *
 * Returns null on missing/invalid token or unrecoverable provisioning failure.
 */
export async function getAuthContext(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return null

  // ── Path A: membership exists ────────────────────────────────────────────
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

  // ── Path B: backfill — workspace exists but member row is missing ────────
  const { data: ownedWorkspace } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, owner_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (ownedWorkspace) {
    console.warn('[auth] Backfilling missing owner membership for user', user.id, 'workspace', ownedWorkspace.id)
    const { data: backfilled, error: backfillError } = await supabaseAdmin
      .from('workspace_members')
      .upsert(
        { workspace_id: ownedWorkspace.id, user_id: user.id, role: 'owner' },
        { onConflict: 'workspace_id,user_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (backfillError) {
      console.error('[auth] Backfill failed:', backfillError.message)
      return null
    }

    return {
      user,
      workspace:   ownedWorkspace,
      workspaceId: ownedWorkspace.id,
      role:        'owner',
      memberId:    backfilled.id,
    }
  }

  // ── Path C: provision — new user, no workspace yet ───────────────────────
  const workspaceName = user.user_metadata?.name || user.email?.split('@')[0] || 'My Workspace'

  const { data: result, error: rpcError } = await supabaseAdmin
    .rpc('provision_workspace', {
      p_user_id:        user.id,
      p_workspace_name: workspaceName,
    })

  if (rpcError || !result?.workspace_id) {
    console.error('[auth] provision_workspace RPC failed:', rpcError?.message ?? 'no result')
    return null
  }

  // Fetch the freshly created workspace row so callers have full workspace data
  const { data: newWorkspace } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, owner_id')
    .eq('id', result.workspace_id)
    .single()

  return {
    user,
    workspace:   newWorkspace ?? { id: result.workspace_id, name: workspaceName, owner_id: user.id },
    workspaceId: result.workspace_id,
    role:        'owner',
    memberId:    result.member_id ?? null,
  }
}
