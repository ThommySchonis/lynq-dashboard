import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// GET — public: fetch invite metadata for the accept page.
// No auth required — the token IS the credential. Tokens are 32 bytes
// of random data (256-bit entropy) so enumeration is not practical.
export async function GET(request, { params }) {
  const { token } = await params

  const { data: invite, error } = await supabaseAdmin
    .from('workspace_invite_details')
    .select('id, email, role, expires_at, accepted_at, workspace_id, inviter_email, inviter_name')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('[invite GET] lookup failed:', error.message)
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!invite) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'already_accepted' }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  // Look up workspace name (not in the view; one extra query is fine here)
  const { data: ws } = await supabaseAdmin
    .from('workspaces')
    .select('name')
    .eq('id', invite.workspace_id)
    .maybeSingle()

  return NextResponse.json({
    ok:               true,
    invite_email:     invite.email,
    workspace_name:   ws?.name ?? null,
    role:             invite.role,
    inviter_name:     invite.inviter_name ?? invite.inviter_email ?? null,
    expires_at:       invite.expires_at,
    already_accepted: false,
  })
}
