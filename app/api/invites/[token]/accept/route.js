import { NextResponse } from 'next/server'
import { getUserFromToken } from '../../../../../lib/supabaseAdmin'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

// POST — accept an invite (requires auth)
export async function POST(request, { params }) {
  const { token } = await params

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: invite, error: fetchError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, workspace_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (fetchError || !invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })

  // Check the user isn't already a member of this workspace
  const { data: existing } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'You are already a member of this workspace' }, { status: 400 })

  // Add to workspace
  const { error: joinError } = await supabaseAdmin
    .from('workspace_members')
    .insert({ workspace_id: invite.workspace_id, user_id: user.id, role: invite.role })

  if (joinError) return NextResponse.json({ error: joinError.message }, { status: 500 })

  // Mark invite as accepted
  await supabaseAdmin
    .from('workspace_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({ success: true, workspaceId: invite.workspace_id })
}
