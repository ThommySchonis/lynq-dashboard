import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody, validateParams } from '@/lib/validation'
import { getStore } from '@/lib/services/stores'
import { aiLessonParams, aiLessonPatchBody } from '@/lib/schemas/ai'
import type { RouteContext } from '@/types/api'

interface LessonOwnershipRow {
  id: string
  store_id: string
  workspace_id: string
}

// PATCH /api/ai/lessons/[id] — toggle `enabled` on an existing lesson.
// The lesson must belong to a store inside the caller's workspace; both
// constraints are verified before the UPDATE.
export async function PATCH(request: NextRequest, { params }: RouteContext<{ id: string }>) {
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

  const [p, pErr] = validateParams(await params, aiLessonParams)
  if (pErr) return pErr

  const [body, bErr] = await validateBody(request, aiLessonPatchBody)
  if (bErr) return bErr

  try {
    // Look up to confirm the lesson exists in this workspace AND grab its
    // store_id so we can re-verify store ownership (defense in depth — RLS
    // is bypassed here, but the workspace filter already prevents
    // cross-tenant writes; the store check guards against stale store_id
    // values if a store is deleted out from under a lesson).
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from('ai_lessons')
      .select('id, store_id, workspace_id')
      .eq('id', p.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle<LessonOwnershipRow>()

    if (lookupErr) throw lookupErr
    if (!existing) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const store = await getStore(existing.store_id, ctx.workspaceId)
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

    const { data, error } = await supabaseAdmin
      .from('ai_lessons')
      .update({ enabled: body.enabled })
      .eq('id', p.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ lesson: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
