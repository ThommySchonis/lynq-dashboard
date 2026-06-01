import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody, validateQuery } from '@/lib/validation'
import { getStore } from '@/lib/services/stores'
import {
  aiAutonomyRulesQuery,
  aiAutonomyRulesBody,
  DEFAULT_AUTONOMY_CONFIG,
  type AiAutonomyRulesConfig,
} from '@/lib/schemas/ai'

interface AutonomyRow {
  config: AiAutonomyRulesConfig | null
}

// GET /api/ai/autonomy-rules?store_id={uuid}
// Returns the existing row's config, OR the default config if no row exists
// yet. Never auto-creates a row on GET — the UI is responsible for sending
// a PUT once the user actually saves. `has_persisted_config` lets the UI
// distinguish "showing defaults" from "showing stored values".
//
// Post Emma onboarding refactor: DEFAULT_AUTONOMY_CONFIG.global_block_intents
// is now ['refund_or_return', 'cancellation', 'angry_or_chargeback']
// (was ['refund_or_cancel', 'angry_or_chargeback']). Existing stored configs
// were migrated in 20260603000001_ai_scenarios_onboarding_refactor.sql.
// The PUT body still validates against aiAutonomyRulesConfig which now
// accepts the 10 new REPLY_INTENTS values only.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, aiAutonomyRulesQuery)
  if (qErr) return qErr

  // Verify the store belongs to this workspace before reading
  const store = await getStore(query.store_id, ctx.workspaceId)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_autonomy_rules')
      .select('config')
      .eq('workspace_id', ctx.workspaceId)
      .eq('store_id', query.store_id)
      .maybeSingle<AutonomyRow>()

    if (error) throw error

    const persisted = data?.config ?? null
    return NextResponse.json({
      config:               persisted ?? DEFAULT_AUTONOMY_CONFIG,
      has_persisted_config: persisted !== null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/ai/autonomy-rules — upsert the row for {store_id, workspace_id}.
// Existing UNIQUE constraint on store_id makes this idempotent.
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

  const [body, bErr] = await validateBody(request, aiAutonomyRulesBody)
  if (bErr) return bErr

  // Verify the store belongs to this workspace before writing
  const store = await getStore(body.store_id, ctx.workspaceId)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 403 })

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_autonomy_rules')
      .upsert(
        {
          store_id:     body.store_id,
          workspace_id: ctx.workspaceId,
          config:       body.config,
        },
        { onConflict: 'store_id' }
      )
      .select('config')
      .single<AutonomyRow>()

    if (error) throw error
    return NextResponse.json({ config: data?.config ?? body.config })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
