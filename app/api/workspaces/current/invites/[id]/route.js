import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../../lib/auth'
import { can } from '../../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'

// DELETE — revoke a pending invite
export async function DELETE(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.removeMembers(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: invite, error: lookupError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, email')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    console.error('[invites DELETE] lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

  const { error: deleteError } = await supabaseAdmin
    .from('workspace_invites')
    .delete()
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (deleteError) {
    console.error('[invites DELETE] delete failed:', deleteError.message)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  console.log('[invites DELETE] revoked invite', id, 'for', invite.email, 'in workspace', ctx.workspaceId)
  return NextResponse.json({ ok: true, email: invite.email })
}
