import { getAuthContext } from '../../../../../../lib/auth'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { parseBody } from '@/lib/utils/typed-json'
import { checkRateLimit } from '@/lib/rate-limit'

interface NoteBody {
  body?: string
}

export async function GET(request: NextRequest, { params }: RouteContext<{ id: string }>) {
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

  const { id } = await params

  const { data: notes } = await supabaseAdmin
    .from('conversation_notes')
    .select('*')
    .eq('conversation_id', id)
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ notes: notes || [] })
}

export async function POST(request: NextRequest, { params }: RouteContext<{ id: string }>) {
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

  const { id } = await params
  const body = await parseBody<NoteBody>(request)

  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Note body required' }, { status: 400 })
  }

  const { data: conv } = await supabaseAdmin
    .from('email_conversations')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const noteResult = await supabaseAdmin
    .from('conversation_notes')
    .insert({
      conversation_id: id,
      workspace_id: ctx.workspaceId,
      body: body.body.trim(),
    })
    .select()
    .single()

  if (noteResult.error) return NextResponse.json({ error: noteResult.error.message }, { status: 500 })

  return NextResponse.json({ note: noteResult.data as Record<string, unknown> })
}
