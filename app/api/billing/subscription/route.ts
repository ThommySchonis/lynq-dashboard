import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSubscriptionWithUsage } from '@/lib/services/billing'
import { serviceCatchHandler } from '@/lib/service-catch-handler'

// GET /api/billing/subscription
// Composite read powering the Usage & Plans tab.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await getSubscriptionWithUsage(ctx.workspaceId)
    return NextResponse.json(data)
  } catch (err) {
    const cachedResult = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    const cached = cachedResult.data as Record<string, unknown> | null

    if (cached) {
      return serviceCatchHandler(err, 'whop', {
        fallbackData: cached,
        fallbackMessage: 'Showing cached subscription — billing service is temporarily unavailable',
      })
    }
    return serviceCatchHandler(err, 'whop')
  }
}
