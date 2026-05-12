import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '../../../../../../lib/auth'
import { can } from '../../../../../../lib/permissions'
import { BillingServiceError, subscribeAddon } from '../../../../../../lib/services/billing'

interface RouteParams { params: Promise<{ id: string }> }

// POST /api/billing/addons/[id]/subscribe
// Owner-only. Returns 400 with "coming soon" message for unreleased add-ons.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageBilling(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners can manage add-ons', code: 'permission_denied' }, { status: 403 })
  }

  const { id } = await params

  try {
    const result = await subscribeAddon(ctx.workspaceId, id)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to subscribe to add-on' }, { status: 500 })
  }
}
