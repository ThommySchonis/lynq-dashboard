import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateBody } from '@/lib/validation'
import { macroOnboardingBody } from '@/lib/schemas/macros'
import { logger } from '@/lib/logger'

// GET /api/macros/onboarding — fetch existing answers (for prefill)
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewMacros(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('macro_onboarding')
    .select('id, answers, completed_at, last_generated_at, generation_count, updated_at')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (error) {
    logger.error('[macros/onboarding]', 'GET failed', { error: error.message })
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }

  return NextResponse.json({ onboarding: data ?? null, currentUserRole: ctx.role })
}

// POST /api/macros/onboarding — upsert answers (one row per workspace)
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  if (!can.manageMacros(ctx.role as Role)) {
    return NextResponse.json({ error: 'You do not have permission to save onboarding.', code: 'permission_denied' }, { status: 403 })
  }

  const [body, err] = await validateBody(request, macroOnboardingBody)
  if (err) return err
  const { answers } = body

  const upsertResult = await supabaseAdmin
    .from('macro_onboarding')
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        answers,
        completed_at: new Date().toISOString(),
        created_by:   ctx.user.id,
      },
      { onConflict: 'workspace_id' }
    )
    .select()
    .single()

  if (upsertResult.error || !upsertResult.data) {
    logger.error('[macros/onboarding]', 'upsert failed', { error: upsertResult.error?.message })
    return NextResponse.json({ error: upsertResult.error?.message ?? 'Failed to save onboarding', code: 'upsert_failed' }, { status: 500 })
  }

  return NextResponse.json({ onboarding: upsertResult.data as Record<string, unknown> })
}
