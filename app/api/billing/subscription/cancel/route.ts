import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { BillingServiceError, cancelSubscription } from '@/lib/services/billing'

// POST /api/billing/subscription/cancel
// Owner-only. Sets cancel_at_period_end=true (grace cancel).
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageBilling(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners can cancel', code: 'permission_denied' }, { status: 403 })
  }

  try {
    const sub = await cancelSubscription(ctx.workspaceId, true)
    return NextResponse.json({ ok: true, subscription: sub })
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}
