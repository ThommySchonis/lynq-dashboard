import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { validateBody, validateParams } from '@/lib/validation'
import { conversationParams, updateConversationBody } from '@/lib/schemas/inbox'
import { trackEvent } from '@/lib/analytics/track'
import { EVENT_TYPES } from '@/lib/analytics/events'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const [params, paramErr] = validateParams(await routeParams, conversationParams)
  if (paramErr) return paramErr

  const convResult = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .single()

  const conversation = convResult.data as Record<string, unknown> | null
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  const { data: notes } = await supabaseAdmin
    .from('conversation_notes')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  if (conversation.is_unread) {
    await supabaseAdmin
      .from('email_conversations')
      .update({ is_unread: false })
      .eq('id', params.id)
  }

  return NextResponse.json({
    conversation,
    messages: messages || [],
    notes: notes || [],
  })
}

export async function PATCH(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const [params, paramErr] = validateParams(await routeParams, conversationParams)
  if (paramErr) return paramErr

  const [body, bodyErr] = await validateBody(request, updateConversationBody)
  if (bodyErr) return bodyErr

  const updates: Record<string, unknown> = {}
  if (body.status) {
    updates.status = body.status
  }
  if (typeof body.is_unread === 'boolean') {
    updates.is_unread = body.is_unread
  }
  if (body.assigned_to !== undefined) {
    updates.assigned_to = body.assigned_to || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('email_conversations')
    .update(updates)
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve source from conversation's email account
  const sourceResult = await supabaseAdmin
    .from('email_conversations')
    .select('email_accounts(provider)')
    .eq('id', params.id)
    .single()
  const emailAccounts = (sourceResult.data as Record<string, unknown>)?.email_accounts as Record<string, string> | null
  const source = emailAccounts?.provider || 'custom'

  // Emit analytics events (fire-and-forget, no await)
  if (body.status === 'resolved') {
    void trackEvent(ctx.workspaceId, EVENT_TYPES.TICKET_RESOLVED, params.id, source, ctx.memberId, body.metadata)
  } else if (body.status === 'closed') {
    void trackEvent(ctx.workspaceId, EVENT_TYPES.TICKET_CLOSED, params.id, source, ctx.memberId)
  }
  if (body.assigned_to !== undefined) {
    void trackEvent(ctx.workspaceId, EVENT_TYPES.TICKET_ASSIGNED, params.id, source, body.assigned_to)
  }

  return NextResponse.json({ success: true })
}
