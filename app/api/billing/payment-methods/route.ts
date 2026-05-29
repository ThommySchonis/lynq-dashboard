import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext, requireNotImpersonating } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { BillingServiceError, listPaymentMethods } from '@/lib/services/billing'

// GET /api/billing/payment-methods — list (empty until Whop wires up)
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const methods = await listPaymentMethods(ctx.workspaceId)
    return NextResponse.json({ payment_methods: methods })
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to list payment methods' }, { status: 500 })
  }
}

// POST /api/billing/payment-methods
// Owner-only. Stub for now — returns 501 + "coming soon" message until
// Whop integration lands. The real flow will tokenize via Whop SDK on
// the client, POST the token here, we attach to the customer.
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const impersonationBlocked = requireNotImpersonating(ctx)
  if (impersonationBlocked) return impersonationBlocked
  if (!can.manageBilling(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners can manage payment methods', code: 'permission_denied' }, { status: 403 })
  }

  return NextResponse.json(
    { error: 'Payment methods coming soon — Whop integration not yet wired up', code: 'whop_pending' },
    { status: 501 }
  )
}
