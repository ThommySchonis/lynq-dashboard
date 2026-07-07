import { supabaseAdmin, getUserFromToken } from './supabaseAdmin'
import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'
import { isPlatformAdmin } from '@/lib/platformAdmin'
import { pickPrimaryMembership } from '@/lib/pick-membership'

export interface AuthWorkspace {
  id: string
  name: string
  suspended_at: string | null
}

interface MembershipRow {
  id: string
  workspace_id: string
  role: string
  joined_at: string
  workspaces: AuthWorkspace
}

interface UserMetadata {
  company_name?: string
  name?: string
  full_name?: string
}

interface ProvisionResult {
  workspace_id?: string
  member_id?: string
}

export interface AuthContext {
  user: User
  workspace: AuthWorkspace
  workspaceId: string
  role: string
  memberId: string | null
  isSuspended: boolean
  scheduledForDeletion: string | null
  isImpersonating: boolean
  impersonationSessionId: string | null
}

/**
 * Extracts `data` from a Supabase query result as `T | null`, avoiding
 * `no-unsafe-assignment` / `no-unsafe-member-access` on untyped clients.
 * The single `as unknown as T | null` cast is the intentional boundary.
 */
function pluck<T>(result: { data: unknown }): T | null {
  return result.data as unknown as T | null
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
    logger.warn('[auth]', 'getUserFromToken failed — token invalid or expired')
    return null
  }

  Sentry.setUser({ id: user.id })

  // ── Impersonation check ──────────────────────────────────────────────
  const impersonateCookie = request.cookies.get('x-impersonate-session')?.value
  const isAdmin = await isPlatformAdmin(user.email)
  if (impersonateCookie && isAdmin) {
    const impRow = await supabaseAdmin
      .from('impersonation_sessions')
      .select('id, target_workspace_id')
      .eq('id', impersonateCookie)
      .eq('admin_user_id', user.id)
      .is('ended_at', null)
      .maybeSingle()

    const imp = pluck<{ id: string; target_workspace_id: string }>(impRow)

    if (imp) {
      const wsRow = await supabaseAdmin
        .from('workspaces')
        .select('id, name, suspended_at')
        .eq('id', imp.target_workspace_id)
        .single()

      const ws = pluck<AuthWorkspace>(wsRow)

      if (ws) {
        logger.info('[auth]', 'impersonation active', {
          adminId: user.id,
          targetWorkspaceId: ws.id,
        })
        return {
          user,
          workspace: ws,
          workspaceId: ws.id,
          role: 'owner',
          memberId: null,
          isSuspended: !!ws.suspended_at,
          scheduledForDeletion: null,
          isImpersonating: true,
          impersonationSessionId: imp.id,
        }
      }
    }
  }

  // ── Path A: membership exists ────────────────────────────────────────────
  // Fetch ALL memberships and pick deterministically — a user may belong to
  // more than one workspace (e.g. agency staff). `.maybeSingle()` would ERROR
  // on 2+ rows and silently fall through to provisioning a junk workspace.
  const memberRow = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id, role, joined_at, workspaces(id, name, suspended_at)')
    .eq('user_id', user.id)

  if (memberRow.error) {
    logger.error('[auth]', 'workspace_members query failed', { error: memberRow.error.message })
  }

  const memberships = pluck<MembershipRow[]>(memberRow) ?? []
  const membership = pickPrimaryMembership(memberships)

  if (membership) {
    logger.debug('[auth]', 'path A — membership found', { workspaceId: membership.workspace_id, role: membership.role })

    const profileRow = await supabaseAdmin
      .from('user_profiles')
      .select('scheduled_for_deletion_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const profile = pluck<{ scheduled_for_deletion_at: string | null }>(profileRow)

    return {
      user,
      workspace:              membership.workspaces,
      workspaceId:            membership.workspace_id,
      role:                   membership.role,
      memberId:               membership.id,
      isSuspended:            !!membership.workspaces.suspended_at,
      scheduledForDeletion:   profile?.scheduled_for_deletion_at ?? null,
      isImpersonating:        false,
      impersonationSessionId: null,
    }
  }

  // ── Path B: provision — new user, no workspace yet ───────────────────────
  // Prefer company_name from signup form (ONBOARDING_SPEC v1.1 §3.2),
  // fall back to legacy .name (older signups), then email-prefix.
  const meta: UserMetadata = (user.user_metadata ?? {}) as UserMetadata
  const workspaceName =
    meta.company_name ||
    meta.name ||
    user.email?.split('@')[0] ||
    'My Workspace'
  logger.debug('[auth]', 'path B — provisioning new workspace', { workspaceName })

  const provisionRaw = await supabaseAdmin.rpc('provision_workspace', {
    p_user_id:        user.id,
    p_workspace_name: workspaceName,
  })

  const rpcError = provisionRaw.error as { message: string } | null
  const result = pluck<ProvisionResult>(provisionRaw)
  logger.info('[auth]', 'provision_workspace result', { workspaceId: result?.workspace_id, error: rpcError?.message ?? null })

  if (rpcError || !result?.workspace_id) {
    logger.error('[auth]', 'provision_workspace RPC failed', { error: rpcError?.message ?? 'returned no workspace_id' })
    return null
  }

  const newWsRow = await supabaseAdmin
    .from('workspaces')
    .select('id, name, suspended_at')
    .eq('id', result.workspace_id)
    .single()

  const newWorkspace = pluck<AuthWorkspace>(newWsRow)
  logger.debug('[auth]', 'path B — provisioning complete', { workspaceId: result.workspace_id })
  return {
    user,
    workspace:              newWorkspace ?? { id: result.workspace_id, name: workspaceName, suspended_at: null },
    workspaceId:            result.workspace_id,
    role:                   'owner',
    memberId:               result.member_id ?? null,
    isSuspended:            false,
    scheduledForDeletion:   null,
    isImpersonating:        false,
    impersonationSessionId: null,
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

/**
 * Returns a 403 response if the user is impersonating a client.
 * Call this in routes that should be blocked during impersonation
 * (workspace deletion, ownership transfer, billing changes, member management).
 */
export function requireNotImpersonating(ctx: AuthContext): NextResponse | null {
  if (ctx.isImpersonating) {
    return NextResponse.json(
      { error: 'impersonation_restricted', message: 'This action is not available during impersonation.' },
      { status: 403 }
    )
  }
  return null
}
