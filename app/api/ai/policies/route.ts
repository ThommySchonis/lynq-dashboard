import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody, validateQuery } from '@/lib/validation'
import { getStore } from '@/lib/services/stores'
import { aiPoliciesQuery, aiPoliciesBody } from '@/lib/schemas/ai'

// GET /api/ai/policies?store_id={uuid}
// Returns the ai_policies row for the given store, or null if not yet created.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, aiPoliciesQuery)
  if (qErr) return qErr

  // Verify the store belongs to this workspace before reading
  const store = await getStore(query.store_id, ctx.workspaceId)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_policies')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('store_id', query.store_id)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ policies: data ?? null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/ai/policies — upsert the ai_policies row for {store_id, workspace_id}
export async function PUT(request: NextRequest) {
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

  const [body, bErr] = await validateBody(request, aiPoliciesBody)
  if (bErr) return bErr

  // Verify the store belongs to this workspace before writing
  const store = await getStore(body.store_id, ctx.workspaceId)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_policies')
      .upsert(
        { ...body, workspace_id: ctx.workspaceId },
        { onConflict: 'store_id' }
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ policies: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
