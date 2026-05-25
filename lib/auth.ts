import { supabaseAdmin, getUserFromToken } from './supabaseAdmin'
import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

interface MembershipRow {
  id: string
  workspace_id: string
  role: string
  workspaces: unknown
}

interface ProvisionResult {
  workspace_id?: string
  member_id?: string
}

export interface AuthWorkspace {
  id: string
  name: string
  suspended_at: string | null
}

export interface AuthContext {
  user: User
  workspace: AuthWorkspace
  workspaceId: string
  role: string
  memberId: string | null
  isSuspended: boolean
  scheduledForDeletion: string | null
}

/**
 * Resolves authenticated user + workspace membership from a Bearer token.
 *
 * Two paths:
 *   A) Membership row found → return immediately (fast path)
 *   B) Provision: brand-new user → call provision_workspace RPC (atomic)
 *
 * Returns null on missing/invalid token. Never swallows provisioning errors
 * silently — every failure path logs to console (visible in Vercel logs).
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
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
    .select('id, workspace_id, role, workspaces(id, name, suspended_at)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    console.error('[auth] workspace_members query failed:', memberError.message)
  }

  if (membership) {
    const m = membership as MembershipRow
    console.log('[auth] path A — membership found, workspace:', m.workspace_id, 'role:', m.role)

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('scheduled_for_deletion_at')
      .eq('user_id', user.id)
      .maybeSingle()

    return {
      user,
      workspace:            m.workspaces as AuthWorkspace,
      workspaceId:          m.workspace_id,
      role:                 m.role,
      memberId:             m.id,
      isSuspended:          !!(m.workspaces as AuthWorkspace).suspended_at,
      scheduledForDeletion: (profile?.scheduled_for_deletion_at as string | null) ?? null,
    }
  }

  // ── Path B: provision — new user, no workspace yet ───────────────────────
  // Prefer company_name from signup form (ONBOARDING_SPEC v1.1 §3.2),
  // fall back to legacy .name (older signups), then email-prefix.
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const workspaceName =
    (meta?.company_name as string) ||
    (meta?.name as string) ||
    user.email?.split('@')[0] ||
    'My Workspace'
  console.log('[auth] path B — provisioning new workspace for', user.email, 'name:', workspaceName)

  const provisionResult = await supabaseAdmin
    .rpc('provision_workspace', {
      p_user_id:        user.id,
      p_workspace_name: workspaceName,
    })

  const rpcError = provisionResult.error
  const result = provisionResult.data as ProvisionResult | null
  console.log('[auth] provision_workspace result:', JSON.stringify(result), 'error:', rpcError?.message ?? null)

  if (rpcError || !result?.workspace_id) {
    console.error('[auth] provision_workspace RPC failed:', rpcError?.message ?? 'returned no workspace_id')
    return null
  }

  const { data: newWorkspaceData } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, suspended_at')
    .eq('id', result.workspace_id)
    .single()

  const newWorkspace = newWorkspaceData as AuthWorkspace | null
  console.log('[auth] path B — provisioning complete, workspace:', result.workspace_id)
  return {
    user,
    workspace:            newWorkspace ?? { id: result.workspace_id, name: workspaceName, suspended_at: null },
    workspaceId:          result.workspace_id,
    role:                 'owner',
    memberId:             result.member_id ?? null,
    isSuspended:          false,
    scheduledForDeletion: null,
  }
}

/**
 * Returns a 403 response if the workspace is suspended.
 * Call this in write routes (POST/PUT/PATCH/DELETE) after getAuthContext().
 * Returns null if write access is allowed (caller should proceed).
 */
export function requireWriteAccess(ctx: AuthContext): NextResponse | null {
  if (ctx.isSuspended) {
    return NextResponse.json(
      { error: 'workspace_suspended', message: 'This workspace is currently suspended. Write operations are disabled.' },
      { status: 403 }
    )
  }
  return null
}
