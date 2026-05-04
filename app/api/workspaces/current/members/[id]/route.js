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
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.removeMembers(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type === 'invite') {
    const { error } = await supabaseAdmin
      .from('workspace_invites')
      .delete()
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { data: target } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .single()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 400 })
  if (target.user_id === ctx.user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('workspace_members')
    .delete()
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
