import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import type { RouteContext } from '@/types/api'
import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { BillingServiceError, deletePaymentMethod } from '@/lib/services/billing'
import { validateParams } from '@/lib/validation'
import { billingIdParams } from '@/lib/schemas/billing'

// DELETE /api/billing/payment-methods/[id]
// Owner-only. Stubs Whop call to detach the method.
export async function DELETE(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageBilling(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners can manage payment methods', code: 'permission_denied' }, { status: 403 })
  }

  const [params, paramErr] = validateParams(await routeParams, billingIdParams)
  if (paramErr) return paramErr

  try {
    await deletePaymentMethod(ctx.workspaceId, params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 })
  }
}
