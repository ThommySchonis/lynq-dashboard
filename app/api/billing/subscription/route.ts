import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '../../../../lib/auth'
import { getSubscriptionWithUsage } from '../../../../lib/services/billing'

// GET /api/billing/subscription
// Composite read powering the Usage & Plans tab.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await getSubscriptionWithUsage(ctx.workspaceId)
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load subscription'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
