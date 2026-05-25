import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { validateParams } from '@/lib/validation'
import { accountParams } from '@/lib/schemas/inbox'
import { checkRateLimit } from '@/lib/rate-limit'

export async function DELETE(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:inbox`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const [params, paramErr] = validateParams(await routeParams, accountParams)
  if (paramErr) return paramErr

  // Verify account belongs to workspace
  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('id')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Get all conversations for this account
  const { data: conversations } = await supabaseAdmin
    .from('email_conversations')
    .select('id')
    .eq('email_account_id', params.id)

  const conversationIds = (conversations || []).map((c: { id: string }) => c.id)

  if (conversationIds.length > 0) {
    // Delete messages for those conversations
    await supabaseAdmin
      .from('email_messages')
      .delete()
      .in('conversation_id', conversationIds)

    // Delete notes for those conversations
    await supabaseAdmin
      .from('conversation_notes')
      .delete()
      .in('conversation_id', conversationIds)

    // Delete conversations
    await supabaseAdmin
      .from('email_conversations')
      .delete()
      .eq('email_account_id', params.id)
  }

  // Delete the account itself
  const { error } = await supabaseAdmin
    .from('email_accounts')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
