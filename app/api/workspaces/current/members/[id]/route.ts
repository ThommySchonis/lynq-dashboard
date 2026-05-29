import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import type { Role } from '@/types/database'
import { getAuthContext, requireWriteAccess, requireNotImpersonating } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateBody, validateParams } from '@/lib/validation'
import { memberParams, updateMemberBody } from '@/lib/schemas/workspaces'
import { logger } from '@/lib/logger'

interface MemberRow { id: string; user_id: string; role: string }

// PATCH — change a member's role. See spec in PR for the full rule matrix.
export async function PATCH(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })
  }
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  const impersonationBlocked = requireNotImpersonating(ctx)
  if (impersonationBlocked) return impersonationBlocked

  // Only owners + admins are ever allowed to change roles
  if (!can.changeRole(ctx.role as Role)) {
    return NextResponse.json(
      { error: 'You do not have permission to change roles.', code: 'permission_denied' },
      { status: 403 }
    )
  }

  const [params, paramErr] = validateParams(await routeParams, memberParams)
  if (paramErr) return paramErr

  const [body, bodyErr] = await validateBody(request, updateMemberBody)
  if (bodyErr) return bodyErr

  const { role: newRole } = body

  const targetResult = await supabaseAdmin
    .from('workspace_members')
    .select('id, user_id, role')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (targetResult.error) {
    logger.error('[members]', 'role PATCH target lookup failed', { message: targetResult.error.message })
    return NextResponse.json({ error: targetResult.error.message, code: 'lookup_failed' }, { status: 500 })
  }
  const target = targetResult.data as MemberRow | null
  if (!target) {
    return NextResponse.json({ error: 'Member not found', code: 'not_found' }, { status: 404 })
  }

  // Self-change is forbidden
  if (target.user_id === ctx.user.id) {
    return NextResponse.json(
      { error: "You can't change your own role.", code: 'self_change_forbidden' },
      { status: 409 }
    )
  }

  // Promoting to owner — only owners can do this
  if (newRole === 'owner' && ctx.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only owners can promote others to owner.', code: 'permission_denied' },
      { status: 403 }
    )
  }

  // Demoting an existing owner — only owners can do this
  if (target.role === 'owner' && ctx.role !== 'owner') {
    return NextResponse.json(
      { error: "Only owners can change another owner's role.", code: 'permission_denied' },
      { status: 403 }
    )
  }

  // No-op: same role → return success without writing
  if (newRole === target.role) {
    return NextResponse.json({ ok: true, member: target, noop: true })
  }

  // Last-owner protection: if demoting an owner, ensure ≥1 owner remains
  if (target.role === 'owner' && newRole !== 'owner') {
    const { count, error: countError } = await supabaseAdmin
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('role', 'owner')
      .neq('id', target.id)

    if (countError) {
      logger.error('[members]', 'role PATCH owner count failed', { message: countError.message })
      return NextResponse.json({ error: countError.message, code: 'lookup_failed' }, { status: 500 })
    }
    if ((count ?? 0) === 0) {
      return NextResponse.json(
        { error: 'This is the only owner. Promote someone else first.', code: 'last_owner' },
        { status: 409 }
      )
    }
  }

  const memberUpdateResult = await supabaseAdmin
    .from('workspace_members')
    .update({ role: newRole })
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .select('id, user_id, role, joined_at')
    .single()

  if (memberUpdateResult.error) {
    logger.error('[members]', 'role PATCH update failed', { message: memberUpdateResult.error.message })
    return NextResponse.json({ error: memberUpdateResult.error.message, code: 'update_failed' }, { status: 500 })
  }

  logger.info('[members]', 'role updated', { workspaceId: ctx.workspaceId, targetId: target.id, from: target.role, to: newRole })
  return NextResponse.json({ ok: true, member: memberUpdateResult.data as Record<string, unknown> })
}

// DELETE — remove a member OR revoke a pending invite (?type=invite)
// Kept for backwards compat; the UI now uses /api/workspaces/current/invites/[id]
// for invite revocation. Member removal still routes through here.
export async function DELETE(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })
  }
  const blocked2 = requireWriteAccess(ctx)
  if (blocked2) return blocked2
  const impersonationBlocked2 = requireNotImpersonating(ctx)
  if (impersonationBlocked2) return impersonationBlocked2

  const [params, paramErr] = validateParams(await routeParams, memberParams)
  if (paramErr) return paramErr

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  // Legacy invite-revoke path (no longer called by the UI but kept for safety)
  if (type === 'invite') {
    if (!can.removeMembers(ctx.role as Role)) {
      return NextResponse.json({ error: 'Forbidden', code: 'permission_denied' }, { status: 403 })
    }
    const { error } = await supabaseAdmin
      .from('workspace_invites')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    if (error) return NextResponse.json({ error: error.message, code: 'delete_failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Member removal ─────────────────────────────────────────────────
  if (!can.removeMembers(ctx.role as Role)) {
    return NextResponse.json(
      { error: 'You do not have permission to remove members.', code: 'permission_denied' },
      { status: 403 }
    )
  }

  const delTargetResult = await supabaseAdmin
    .from('workspace_members')
    .select('id, user_id, role')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (delTargetResult.error) {
    logger.error('[members]', 'member DELETE lookup failed', { message: delTargetResult.error.message })
    return NextResponse.json({ error: delTargetResult.error.message, code: 'lookup_failed' }, { status: 500 })
  }
  const target = delTargetResult.data as MemberRow | null
  if (!target) {
    return NextResponse.json({ error: 'Member not found', code: 'not_found' }, { status: 404 })
  }

  // Self-remove is forbidden — owners must transfer ownership first
  if (target.user_id === ctx.user.id) {
    const msg = ctx.role === 'owner'
      ? 'Owners must transfer ownership before leaving the workspace.'
      : "You can't remove yourself."
    return NextResponse.json({ error: msg, code: 'self_remove_forbidden' }, { status: 409 })
  }

  // Admins cannot remove owners or other admins
  if (ctx.role === 'admin' && (target.role === 'owner' || target.role === 'admin')) {
    return NextResponse.json(
      { error: 'Only owners can remove other owners or admins.', code: 'permission_denied' },
      { status: 403 }
    )
  }

  // Last-owner protection: if removing an owner, ≥1 owner must remain
  if (target.role === 'owner') {
    const { count, error: countError } = await supabaseAdmin
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('role', 'owner')
      .neq('id', target.id)

    if (countError) {
      logger.error('[members]', 'member DELETE owner count failed', { message: countError.message })
      return NextResponse.json({ error: countError.message, code: 'lookup_failed' }, { status: 500 })
    }
    if ((count ?? 0) === 0) {
      return NextResponse.json(
        { error: 'This is the only owner. Promote someone else first.', code: 'last_owner' },
        { status: 409 }
      )
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from('workspace_members')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)

  if (deleteError) {
    logger.error('[members]', 'member DELETE failed', { message: deleteError.message })
    return NextResponse.json({ error: deleteError.message, code: 'delete_failed' }, { status: 500 })
  }

  logger.info('[members]', 'member removed', {
    workspaceId: ctx.workspaceId,
    removedId:   target.id,
    removedRole: target.role,
    by:          ctx.user.id,
  })

  // Note: their auth.users row is intentionally NOT deleted — they may
  // belong to other workspaces or sign up to a new one later.
  return NextResponse.json({ ok: true, removed_id: target.id })
}
