import { NextResponse } from 'next/server'
import { getUserFromToken, supabaseAdmin } from '../../../../../lib/supabaseAdmin'

// POST — accept an invite (requires auth)
export async function POST(request, { params }) {
  const { token } = await params

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use atomic RPC — handles locking, idempotency, expiry, and member upsert
  const { data: result, error: rpcError } = await supabaseAdmin
    .rpc('accept_workspace_invite', {
      p_token:   token,
      p_user_id: user.id,
    })

  if (rpcError) {
    console.error('[invite accept] RPC error:', rpcError.message)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }

  if (result?.error === 'not_found') {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (result?.error === 'expired') {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  if (!result?.ok) {
    return NextResponse.json({ error: 'Invite could not be accepted' }, { status: 400 })
  }

  // Email match guard: verify the logged-in user's email matches the invite
  // Do this after the RPC so we can still return workspace_id for redirect,
  // but reject if there's a mismatch (prevents invite-link theft).
  const { data: invite } = await supabaseAdmin
    .from('workspace_invites')
    .select('email')
    .eq('token', token)
    .maybeSingle()

  if (invite && user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    // Roll back the membership we just inserted
    await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', result.workspace_id)
      .eq('user_id', user.id)

    return NextResponse.json(
      { error: `This invite was sent to ${invite.email}. Please sign in with that account.` },
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true, workspaceId: result.workspace_id })
}
