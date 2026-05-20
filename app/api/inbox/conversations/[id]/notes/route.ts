import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { validateBody, validateParams } from '@/lib/validation'
import { conversationParams, createNoteBody } from '@/lib/schemas/inbox'
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

  const { data: notes } = await supabaseAdmin
    .from('conversation_notes')
    .select('*')
    .eq('conversation_id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ notes: notes || [] })
}

export async function POST(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
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

  const [body, bodyErr] = await validateBody(request, createNoteBody)
  if (bodyErr) return bodyErr

  const { data: conv } = await supabaseAdmin
    .from('email_conversations')
    .select('id')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const noteResult = await supabaseAdmin
    .from('conversation_notes')
    .insert({
      conversation_id: params.id,
      workspace_id: ctx.workspaceId,
      body: body.body.trim(),
    })
    .select()
    .single()

  if (noteResult.error) return NextResponse.json({ error: noteResult.error.message }, { status: 500 })

  return NextResponse.json({ note: noteResult.data as Record<string, unknown> })
}
