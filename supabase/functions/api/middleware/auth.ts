import type { MiddlewareHandler } from 'hono'
import { getAdminClient, getUserFromToken } from '../lib/supabase.ts'
import type { AuthContext, AuthWorkspace } from '../lib/types.ts'
import { pickPrimaryMembership } from '../lib/pick-membership.ts'

interface MembershipRow {
  id: string
  workspace_id: string
  role: string
  joined_at: string
  workspaces: AuthWorkspace
}

interface ProvisionResult {
  workspace_id?: string
  member_id?: string
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sb = getAdminClient()

  // ── Path A: membership exists ──
  // Fetch ALL memberships and pick deterministically — a user may belong to
  // more than one workspace (e.g. agency staff). `.maybeSingle()` would ERROR
  // on 2+ rows and silently fall through to provisioning a junk workspace.
  const { data: memberships, error: memberErr } = await sb
    .from('workspace_members')
    .select('id, workspace_id, role, joined_at, workspaces(id, name, suspended_at)')
    .eq('user_id', user.id)

  if (memberErr) {
    console.error('[auth] workspace_members query failed:', memberErr.message)
  }

  const membership = pickPrimaryMembership((memberships ?? []) as unknown as MembershipRow[])

  if (membership) {
    const row = membership

    const { data: profile } = await sb
      .from('user_profiles')
      .select('scheduled_for_deletion_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const ctx: AuthContext = {
      user,
      workspace: row.workspaces,
      workspaceId: row.workspace_id,
      role: row.role,
      memberId: row.id,
      isSuspended: !!row.workspaces.suspended_at,
      scheduledForDeletion: (profile as { scheduled_for_deletion_at: string | null } | null)?.scheduled_for_deletion_at ?? null,
      isImpersonating: false,
      impersonationSessionId: null,
    }

    c.set('authContext', ctx)
    return next()
  }

  // ── Path B: provision — new user, no workspace yet ──
  const meta = (user.user_metadata ?? {}) as Record<string, string>
  const workspaceName =
    meta.company_name || meta.name || user.email?.split('@')[0] || 'My Workspace'

  const { data: provisionRaw, error: rpcError } = await sb.rpc('provision_workspace', {
    p_user_id: user.id,
    p_workspace_name: workspaceName,
  })

  const result = provisionRaw as unknown as ProvisionResult | null
  if (rpcError || !result?.workspace_id) {
    console.error('[auth] provision_workspace failed:', rpcError?.message ?? 'no workspace_id returned')
    return c.json({ error: 'Failed to provision workspace' }, 500)
  }

  const { data: newWs } = await sb
    .from('workspaces')
    .select('id, name, suspended_at')
    .eq('id', result.workspace_id)
    .single()

  const workspace = (newWs as unknown as AuthWorkspace) ?? {
    id: result.workspace_id,
    name: workspaceName,
    suspended_at: null,
  }

  const ctx: AuthContext = {
    user,
    workspace,
    workspaceId: result.workspace_id,
    role: 'owner',
    memberId: result.member_id ?? null,
    isSuspended: false,
    scheduledForDeletion: null,
    isImpersonating: false,
    impersonationSessionId: null,
  }

  c.set('authContext', ctx)
  return next()
}
