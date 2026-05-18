import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '../../../../lib/auth'
import { can } from '../../../../lib/permissions'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

const REQUIRED_KEYS = [
  'store_name', 'what_sells', 'brand_voice',
  'support_email', 'signature',
  'return_days', 'return_shipping', 'damage_policy',
]

const VALID_BRAND_VOICES = [
  'Warm & personal', 'Professional & efficient', 'Casual & friendly',
  'Luxury & elegant', 'Playful & fun',
]

const VALID_RETURN_SHIPPING = [
  'Customer pays return shipping',
  'We cover all return shipping',
  'Free returns above certain order value',
]

const VALID_DAMAGE_POLICY = [
  'We cover return postage + replacement or refund',
  'Customer sends photos first, then we decide',
  'Customer pays return as normal',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function sanitizeAnswers(raw: unknown) {
  const a = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = {
    store_name:      typeof a.store_name === 'string'      ? a.store_name.trim().slice(0, 200)      : '',
    what_sells:      typeof a.what_sells === 'string'      ? a.what_sells.trim().slice(0, 500)      : '',
    brand_voice:     typeof a.brand_voice === 'string'     ? a.brand_voice.trim()                   : '',
    support_email:   typeof a.support_email === 'string'   ? a.support_email.trim().slice(0, 200)   : '',
    signature:       typeof a.signature === 'string'       ? a.signature.trim().slice(0, 300)       : '',
    tracking_link:   typeof a.tracking_link === 'string'   ? a.tracking_link.trim().slice(0, 500)   : '',
    return_days:     Number.isFinite(Number(a.return_days)) ? Math.max(1, Math.min(365, Math.floor(Number(a.return_days)))) : 30,
    return_shipping: typeof a.return_shipping === 'string' ? a.return_shipping.trim()               : '',
    damage_policy:   typeof a.damage_policy === 'string'   ? a.damage_policy.trim()                 : '',
    extra_notes:     typeof a.extra_notes === 'string'     ? a.extra_notes.trim().slice(0, 2000)    : '',
  }
  return out
}

function validate(answers: ReturnType<typeof sanitizeAnswers>) {
  for (const k of REQUIRED_KEYS) {
    const v = (answers as Record<string, unknown>)[k]
    if (v === undefined || v === null || v === '') {
      return { ok: false, code: 'missing_field', error: `Missing required field: ${k}` }
    }
  }
  if (!VALID_BRAND_VOICES.includes(answers.brand_voice)) {
    return { ok: false, code: 'invalid_brand_voice', error: 'Invalid brand voice' }
  }
  if (!VALID_RETURN_SHIPPING.includes(answers.return_shipping)) {
    return { ok: false, code: 'invalid_return_shipping', error: 'Invalid return shipping policy' }
  }
  if (!VALID_DAMAGE_POLICY.includes(answers.damage_policy)) {
    return { ok: false, code: 'invalid_damage_policy', error: 'Invalid damage policy' }
  }
  if (!EMAIL_RE.test(answers.support_email)) {
    return { ok: false, code: 'invalid_email', error: 'Invalid support email' }
  }
  return { ok: true }
}

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
    console.error('[onboarding GET] failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }

  return NextResponse.json({ onboarding: data ?? null, currentUserRole: ctx.role })
}

// POST /api/macros/onboarding — upsert answers (one row per workspace)
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role as Role)) {
    return NextResponse.json({ error: 'You do not have permission to save onboarding.', code: 'permission_denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const answers = sanitizeAnswers(body.answers)
  const v = validate(answers)
  if (!v.ok) return NextResponse.json({ error: v.error, code: v.code }, { status: 400 })

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
    console.error('[onboarding POST] upsert failed:', upsertResult.error?.message)
    return NextResponse.json({ error: upsertResult.error?.message ?? 'Failed to save onboarding', code: 'upsert_failed' }, { status: 500 })
  }

  return NextResponse.json({ onboarding: upsertResult.data as Record<string, unknown> })
}
