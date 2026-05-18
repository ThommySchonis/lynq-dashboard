import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '../../../../../types/api'
import { getUserFromToken, supabaseAdmin } from '../../../../../lib/supabaseAdmin'

// POST — accept an invite (requires auth).
// All validation (token, expiry, accepted, email-match) happens atomically
// inside accept_workspace_invite RPC — see Feature 4 SQL migration.
export async function POST(request: NextRequest, { params }: RouteContext<{ token: string }>) {
  const { token } = await params

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  interface RpcResult { ok?: boolean; error?: string; workspace_id?: string; invite_email?: string; user_email?: string }

  const rpcResponse = await supabaseAdmin
    .rpc('accept_workspace_invite', {
      p_token:   token,
      p_user_id: user.id,
    })

  if (rpcResponse.error) {
    console.error('[invite accept] RPC error:', rpcResponse.error.message)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }

  const result = rpcResponse.data as RpcResult | null

  // The RPC returns a single jsonb object; map its error codes to HTTP statuses
  if (result?.ok) {
    return NextResponse.json({ success: true, workspaceId: result.workspace_id })
  }

  const code = result?.error
  switch (code) {
    case 'not_found':
      return NextResponse.json({ error: 'Invite not found', code }, { status: 404 })

    case 'expired':
      return NextResponse.json({ error: 'Invite has expired', code }, { status: 410 })

    case 'user_not_found':
      return NextResponse.json({ error: 'User not found', code }, { status: 404 })

    case 'email_mismatch':
      return NextResponse.json(
        {
          error:        `This invite is for ${result?.invite_email ?? 'unknown'}. Sign in with that account.`,
          code,
          invite_email: result?.invite_email,
          user_email:   result?.user_email,
        },
        { status: 409 }
      )

    case 'already_accepted':
      // RPC returns ok for already-accepted (idempotent), but handle defensively
      return NextResponse.json({ error: 'Invite already accepted', code }, { status: 410 })

    default:
      console.error('[invite accept] unexpected RPC payload:', JSON.stringify(result))
      return NextResponse.json({ error: 'Invite could not be accepted' }, { status: 500 })
  }
}
