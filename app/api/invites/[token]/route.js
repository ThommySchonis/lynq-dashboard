import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// GET — public: fetch invite metadata for the accept page
export async function GET(request, { params }) {
  const { token } = await params

  const { data: invite, error } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, email, role, expires_at, accepted_at, workspace_id, workspaces(name)')
    .eq('token', token)
    .maybeSingle()

  if (error || !invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.accepted_at)  return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })

  return NextResponse.json({
    invite: {
      id:            invite.id,
      email:         invite.email,
      role:          invite.role,
      expires_at:    invite.expires_at,
      workspace_name: invite.workspaces?.name ?? null,
    },
  })
}
