import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getUsageBreakdown } from '@/lib/services/billing'
import { serviceCatchHandler } from '@/lib/service-catch-handler'

// GET /api/billing/usage
// Workspace's current-period usage breakdown (tickets, AI Suggest,
// AI Resolutions, percentages, overage). Drives in-product banners.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const usage = await getUsageBreakdown(ctx.workspaceId)
    if (!usage) return NextResponse.json({ error: 'No active subscription' }, { status: 404 })

    return NextResponse.json(usage)
  } catch (err) {
    const { data: cached } = await supabaseAdmin
      .from('usage_counters')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)

    if (cached) {
      return serviceCatchHandler(err, 'whop', {
        fallbackData: cached,
        fallbackMessage: 'Showing cached usage — billing service is temporarily unavailable',
      })
    }
    return serviceCatchHandler(err, 'whop')
  }
}
