import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '../../../../../lib/auth'
import { can } from '../../../../../lib/permissions'
import { BillingServiceError, changePlan } from '../../../../../lib/services/billing'

// POST /api/billing/subscription/change-plan
// Body: { plan_id }. Owner-only. Stubs Whop call.
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageBilling(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners can change plans', code: 'permission_denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { plan_id?: string }
  if (!body.plan_id) {
    return NextResponse.json({ error: 'plan_id is required', code: 'plan_id_required' }, { status: 400 })
  }

  try {
    const sub = await changePlan(ctx.workspaceId, body.plan_id)
    return NextResponse.json({ ok: true, subscription: sub })
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    const msg = err instanceof Error ? err.message : 'Failed to change plan'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
