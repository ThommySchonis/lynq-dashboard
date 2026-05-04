import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../../lib/auth'
import { can } from '../../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'

const VALID_ROLES = ['owner', 'admin', 'agent', 'observer']

// PATCH — change a member's role. See spec in PR for the full rule matrix.
export async function PATCH(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })
  }

  // Only owners + admins are ever allowed to change roles
  if (!can.changeRole(ctx.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to change roles.', code: 'permission_denied' },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { role: newRole } = body

  if (!VALID_ROLES.includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role', code: 'invalid_role' }, { status: 400 })
  }

  const { data: target, error: lookupError } = await supabaseAdmin
    .from('workspace_members')
    .select('id, user_id, role')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    console.error('[role PATCH] target lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message, code: 'lookup_failed' }, { status: 500 })
  }
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
      console.error('[role PATCH] owner count failed:', countError.message)
      return NextResponse.json({ error: countError.message, code: 'lookup_failed' }, { status: 500 })
    }
    if ((count ?? 0) === 0) {
      return NextResponse.json(
        { error: 'This is the only owner. Promote someone else first.', code: 'last_owner' },
        { status: 409 }
      )
    }
  }

  const { data: member, error: updateError } = await supabaseAdmin
    .from('workspace_members')
    .update({ role: newRole })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select('id, user_id, role, joined_at')
    .single()

  if (updateError) {
    console.error('[role PATCH] update failed:', updateError.message)
    return NextResponse.json({ error: updateError.message, code: 'update_failed' }, { status: 500 })
  }

  console.log('[role PATCH]', { workspaceId: ctx.workspaceId, target: target.id, from: target.role, to: newRole })
  return NextResponse.json({ ok: true, member })
}

// DELETE — remove a member OR revoke a pending invite (?type=invite)
// Kept for backwards compat; the UI now uses /api/workspaces/current/invites/[id]
// for invite revocation. Member removal still routes through here.
export async function DELETE(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  // Legacy invite-revoke path (no longer called by the UI but kept for safety)
  if (type === 'invite') {
    if (!can.removeMembers(ctx.role)) {
      return NextResponse.json({ error: 'Forbidden', code: 'permission_denied' }, { status: 403 })
    }
    const { error } = await supabaseAdmin
      .from('workspace_invites')
      .delete()
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)

    if (error) return NextResponse.json({ error: error.message, code: 'delete_failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Member removal ─────────────────────────────────────────────────
  if (!can.removeMembers(ctx.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to remove members.', code: 'permission_denied' },
      { status: 403 }
    )
  }

  const { data: target, error: lookupError } = await supabaseAdmin
    .from('workspace_members')
    .select('id, user_id, role')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    console.error('[member DELETE] lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message, code: 'lookup_failed' }, { status: 500 })
  }
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
      console.error('[member DELETE] owner count failed:', countError.message)
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
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (deleteError) {
    console.error('[member DELETE] delete failed:', deleteError.message)
    return NextResponse.json({ error: deleteError.message, code: 'delete_failed' }, { status: 500 })
  }

  console.log('[member DELETE]', {
    workspaceId: ctx.workspaceId,
    removed:     target.id,
    removedRole: target.role,
    by:          ctx.user.id,
  })

  // Note: their auth.users row is intentionally NOT deleted — they may
  // belong to other workspaces or sign up to a new one later.
  return NextResponse.json({ ok: true, removed_id: target.id })
}
