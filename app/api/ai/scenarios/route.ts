import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody, validateQuery } from '@/lib/validation'
import { getStore } from '@/lib/services/stores'
import { aiScenariosQuery, aiScenarioBody } from '@/lib/schemas/ai'

// GET /api/ai/scenarios?store_id={uuid}
// Returns all ai_scenarios rows for the given store (may be empty).
//
// Shape after the onboarding refactor (20260603000001_ai_scenarios_onboarding_refactor.sql):
// each row now carries five text fields the prompt builder injects per scenario:
//   triggers / approach / must_do / must_not_do / escalate_when.
// Canonical scenario_keys (8 total) — wismo -> order_status,
// wrong_or_damaged -> wrong_or_damaged_item, refund_or_cancel ->
// refund_or_return, plus a new 'cancellation' key. See lib/constants/emma-onboarding.ts
// CANONICAL_SCENARIOS for the authoritative list.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, aiScenariosQuery)
  if (qErr) return qErr

  // Verify the store belongs to this workspace before reading
  const store = await getStore(query.store_id, ctx.workspaceId)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_scenarios')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('store_id', query.store_id)
      .order('scenario_key')

    if (error) throw error
    return NextResponse.json({ scenarios: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/ai/scenarios — upsert a single scenario row (unique on store_id + scenario_key)
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

  const [body, bErr] = await validateBody(request, aiScenarioBody)
  if (bErr) return bErr

  // Verify the store belongs to this workspace before writing
  const store = await getStore(body.store_id, ctx.workspaceId)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_scenarios')
      .upsert(
        { ...body, workspace_id: ctx.workspaceId },
        { onConflict: 'store_id,scenario_key' }
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ scenario: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
