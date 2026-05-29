import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import type { RouteContext } from '@/types/api'
import { getAuthContext, requireNotImpersonating } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { BillingServiceError, subscribeAddon } from '@/lib/services/billing'
import { validateParams } from '@/lib/validation'
import { billingIdParams } from '@/lib/schemas/billing'

// POST /api/billing/addons/[id]/subscribe
// Owner-only. Returns 400 with "coming soon" message for unreleased add-ons.
export async function POST(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const impersonationBlocked = requireNotImpersonating(ctx)
  if (impersonationBlocked) return impersonationBlocked
  if (!can.manageBilling(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners can manage add-ons', code: 'permission_denied' }, { status: 403 })
  }

  const [params, paramErr] = validateParams(await routeParams, billingIdParams)
  if (paramErr) return paramErr

  try {
    const result = await subscribeAddon(ctx.workspaceId, params.id)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to subscribe to add-on' }, { status: 500 })
  }
}
