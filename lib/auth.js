import { supabaseAdmin, getUserFromToken } from './supabaseAdmin'

/**
 * Resolves authenticated user + workspace membership from a Bearer token.
 *
 * Three paths:
 *   A) Membership row found → return immediately (fast path)
 *   B) Backfill: user owns a workspace but has no membership row → upsert it
 *   C) Provision: brand-new user → call provision_workspace RPC (atomic)
 *
 * Returns null on missing/invalid token. Never swallows provisioning errors
 * silently — every failure path logs to console (visible in Vercel logs).
 */
export async function getAuthContext(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) {
    console.error('[auth] getUserFromToken failed — token invalid or expired')
    return null
  }

  console.log('[auth] user resolved:', user.email)

  // ── Path A: membership exists ────────────────────────────────────────────
  const { data: membership, error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id, role, workspaces(id, name, owner_id)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    console.error('[auth] workspace_members query failed:', memberError.message)
  }

  if (membership) {
    console.log('[auth] path A — membership found, workspace:', membership.workspace_id, 'role:', membership.role)
    return {
      user,
      workspace:   membership.workspaces,
      workspaceId: membership.workspace_id,
      role:        membership.role,
      memberId:    membership.id,
    }
  }

  // ── Path B: backfill — workspace exists but member row is missing ────────
  console.log('[auth] no membership found — checking for owned workspace (path B)')
  const { data: ownedWorkspace, error: workspaceError } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, owner_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (workspaceError) {
    console.error('[auth] workspaces query failed:', workspaceError.message)
  }

  if (ownedWorkspace) {
    console.log('[auth] path B — backfilling missing owner membership for workspace', ownedWorkspace.id)
    const { data: backfilled, error: backfillError } = await supabaseAdmin
      .from('workspace_members')
      .upsert(
        { workspace_id: ownedWorkspace.id, user_id: user.id, role: 'owner' },
        { onConflict: 'workspace_id,user_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (backfillError) {
      console.error('[auth] backfill failed:', backfillError.message)
      return null
    }

    console.log('[auth] path B — backfill complete, member id:', backfilled.id)
    return {
      user,
      workspace:   ownedWorkspace,
      workspaceId: ownedWorkspace.id,
      role:        'owner',
      memberId:    backfilled.id,
    }
  }

  // ── Path C: provision — new user, no workspace yet ───────────────────────
  // Prefer company_name from signup form (ONBOARDING_SPEC v1.1 §3.2),
  // fall back to legacy .name (older signups), then email-prefix.
  const workspaceName =
    user.user_metadata?.company_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'My Workspace'
  console.log('[auth] path C — provisioning new workspace for', user.email, 'name:', workspaceName)

  const { data: result, error: rpcError } = await supabaseAdmin
    .rpc('provision_workspace', {
      p_user_id:        user.id,
      p_workspace_name: workspaceName,
    })

  console.log('[auth] provision_workspace result:', JSON.stringify(result), 'error:', rpcError?.message ?? null)

  if (rpcError || !result?.workspace_id) {
    console.error('[auth] provision_workspace RPC failed:', rpcError?.message ?? 'returned no workspace_id')
    return null
  }

  const { data: newWorkspace } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, owner_id')
    .eq('id', result.workspace_id)
    .single()

  console.log('[auth] path C — provisioning complete, workspace:', result.workspace_id)
  return {
    user,
    workspace:   newWorkspace ?? { id: result.workspace_id, name: workspaceName, owner_id: user.id },
    workspaceId: result.workspace_id,
    role:        'owner',
    memberId:    result.member_id ?? null,
  }
}
