import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '../../../../../lib/auth'
import { can } from '../../../../../lib/permissions'
import { BillingServiceError, changePlan } from '../../../../../lib/services/billing'

interface ChangePlanBody {
  plan_id?: string
  success_url?: string
}

// POST /api/billing/subscription/change-plan
// Body: { plan_id, success_url? }. Owner-only.
//
// Two response shapes (discriminated by `mode`):
//   { ok: true, mode: 'updated',  subscription }  — Whop membership PATCHed in place
//   { ok: true, mode: 'checkout', checkout_url }  — client must redirect to Whop
//
// The client (useChangePlan in hooks/billing) inspects `mode` and
// either invalidates queries or redirects via window.location.
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageBilling(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners can change plans', code: 'permission_denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as ChangePlanBody
  if (!body.plan_id) {
    return NextResponse.json({ error: 'plan_id is required', code: 'plan_id_required' }, { status: 400 })
  }

  try {
    const outcome = await changePlan(ctx.workspaceId, body.plan_id, { successUrl: body.success_url })
    return NextResponse.json({ ok: true, ...outcome })
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    const msg = err instanceof Error ? err.message : 'Failed to change plan'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
