import { supabaseAdmin, getUserFromToken } from './supabaseAdmin'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

interface MembershipRow {
  id: string
  workspace_id: string
  role: string
  workspaces: unknown
}

interface MemberIdRow {
  id: string
}

interface ProvisionResult {
  workspace_id?: string
  member_id?: string
}

export interface AuthWorkspace {
  id: string
  name: string
  owner_id: string
}

export interface AuthContext {
  user: User
  workspace: AuthWorkspace
  workspaceId: string
  role: string
  memberId: string | null
}

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
    .select('id, workspace_id, role, workspaces(id, name, owner_id)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    console.error('[auth] workspace_members query failed:', memberError.message)
  }

  if (membership) {
    const m = membership as MembershipRow
    console.log('[auth] path A — membership found, workspace:', m.workspace_id, 'role:', m.role)
    return {
      user,
      workspace:   m.workspaces as AuthWorkspace,
      workspaceId: m.workspace_id,
      role:        m.role,
      memberId:    m.id,
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
    const ws = ownedWorkspace as AuthWorkspace
    console.log('[auth] path B — backfilling missing owner membership for workspace', ws.id)
    const { data: backfilled, error: backfillError } = await supabaseAdmin
      .from('workspace_members')
      .upsert(
        { workspace_id: ws.id, user_id: user.id, role: 'owner' },
        { onConflict: 'workspace_id,user_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (backfillError) {
      console.error('[auth] backfill failed:', backfillError.message)
      return null
    }

    const bf = backfilled as MemberIdRow
    console.log('[auth] path B — backfill complete, member id:', bf.id)
    return {
      user,
      workspace:   ws,
      workspaceId: ws.id,
      role:        'owner',
      memberId:    bf.id,
    }
  }

  // ── Path C: provision — new user, no workspace yet ───────────────────────
  // Prefer company_name from signup form (ONBOARDING_SPEC v1.1 §3.2),
  // fall back to legacy .name (older signups), then email-prefix.
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const workspaceName =
    (meta?.company_name as string) ||
    (meta?.name as string) ||
    user.email?.split('@')[0] ||
    'My Workspace'
  console.log('[auth] path C — provisioning new workspace for', user.email, 'name:', workspaceName)

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
    .select('id, name, owner_id')
    .eq('id', result.workspace_id)
    .single()

  const newWorkspace = newWorkspaceData as AuthWorkspace | null
  console.log('[auth] path C — provisioning complete, workspace:', result.workspace_id)
  return {
    user,
    workspace:   newWorkspace ?? { id: result.workspace_id, name: workspaceName, owner_id: user.id },
    workspaceId: result.workspace_id,
    role:        'owner',
    memberId:    result.member_id ?? null,
  }
}
