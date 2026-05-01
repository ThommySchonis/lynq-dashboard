import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../../lib/auth'
import { can } from '../../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'

// PATCH — change a member's role
export async function PATCH(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.changeRole(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { role } = await request.json()
  if (!['admin', 'agent', 'observer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data: target } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .single()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (target.user_id === ctx.user.id) return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
  if (target.role === 'owner') return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 400 })

  // Last-admin protection: if demoting an admin, ensure at least one other admin/owner remains
  if (target.role === 'admin' && role !== 'admin') {
    const { count } = await supabaseAdmin
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .in('role', ['owner', 'admin'])

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot demote the last admin. Promote another member first.' }, { status: 400 })
    }
  }

  const { data: member, error } = await supabaseAdmin
    .from('workspace_members')
    .update({ role })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member })
}

// DELETE — remove a member OR revoke a pending invite (?type=invite)
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
