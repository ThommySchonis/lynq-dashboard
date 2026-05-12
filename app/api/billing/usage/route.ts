import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '../../../../lib/auth'
import { getUsageBreakdown } from '../../../../lib/services/billing'

// GET /api/billing/usage
// Workspace's current-period usage breakdown (tickets, AI Suggest,
// AI Resolutions, percentages, overage). Drives in-product banners.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const usage = await getUsageBreakdown(ctx.workspaceId)
  if (!usage) return NextResponse.json({ error: 'No active subscription' }, { status: 404 })

  return NextResponse.json(usage)
}
