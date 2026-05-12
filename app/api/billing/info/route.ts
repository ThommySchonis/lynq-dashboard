import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '../../../../lib/auth'
import { can } from '../../../../lib/permissions'
import {
  BillingServiceError,
  getBillingInfo,
  updateBillingInfo,
} from '../../../../lib/services/billing'
import type { Role } from '@/types/database'
import type { UpdateBillingInfoInput } from '@/types/billing'

// GET /api/billing/info — read billing address + VAT
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const info = await getBillingInfo(ctx.workspaceId)
  return NextResponse.json({ billing_info: info })
}

// PATCH /api/billing/info — update billing details
// Owner-only. Country-aware validation (VAT required for EU, state for US).
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageBilling(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners can edit billing info', code: 'permission_denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as UpdateBillingInfoInput

  try {
    const info = await updateBillingInfo(ctx.workspaceId, body)
    return NextResponse.json({ ok: true, billing_info: info })
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to update billing info' }, { status: 500 })
  }
}
