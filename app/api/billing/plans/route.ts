import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '../../../../lib/auth'
import { listPlans } from '../../../../lib/services/billing'

// GET /api/billing/plans
// All active plans for the plan-selector modal. Catalog is public-ish
// (any authenticated workspace member can see plans) but still gated
// by getAuthContext to avoid scraping by unauthenticated traffic.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plans = await listPlans()
  return NextResponse.json({ plans })
}
