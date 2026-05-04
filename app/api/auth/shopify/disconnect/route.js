import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../../lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Workspace-level disconnect: remove integration row + all orders for the
  // workspace. oauth_states is per-user OAuth flow state (no workspace_id
  // column) so it stays scoped to the calling user's id.
  await supabaseAdmin.from('integrations').delete().eq('workspace_id', ctx.workspaceId)
  await supabaseAdmin.from('shopify_orders').delete().eq('workspace_id', ctx.workspaceId)
  await supabaseAdmin.from('oauth_states').delete().eq('user_id', ctx.user.id)

  return NextResponse.json({ success: true })
}
