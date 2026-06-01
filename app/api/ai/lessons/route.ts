import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody, validateQuery } from '@/lib/validation'
import { getStore } from '@/lib/services/stores'
import { aiLessonsQuery, aiLessonsBody } from '@/lib/schemas/ai'

// GET /api/ai/lessons?store_id={uuid}
// Returns enabled ai_lessons rows for the given store, newest first.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, aiLessonsQuery)
  if (qErr) return qErr

  // Verify the store belongs to this workspace before reading
  const store = await getStore(query.store_id, ctx.workspaceId)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_lessons')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('store_id', query.store_id)
      .eq('enabled', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ lessons: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/ai/lessons — insert a manual lesson for {store_id, workspace_id}.
// source_type is hard-coded 'manual' here; the automated extraction path
// (out of scope for this trede) will set 'edit' or 'reject'.
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:ai`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } }
    )
  }

  const [body, bErr] = await validateBody(request, aiLessonsBody)
  if (bErr) return bErr

  // Verify the store belongs to this workspace before writing
  const store = await getStore(body.store_id, ctx.workspaceId)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_lessons')
      .insert({
        workspace_id:        ctx.workspaceId,
        store_id:            body.store_id,
        lesson_text:         body.lesson_text,
        applies_to_scenario: body.applies_to_scenario ?? null,
        source_type:         'manual',
        source_ref:          null,
        created_by:          ctx.user.id,
        // `enabled` falls back to the DB column default (true).
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ lesson: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
