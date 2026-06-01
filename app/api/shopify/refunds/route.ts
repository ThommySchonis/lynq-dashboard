import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { DEMO_SHOP, DEMO_REFUNDS } from '@/lib/demoData'
import { getRefunds } from '@/lib/services/shopify'
import { parseDateRange } from '@/lib/utils/request'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { shopifyStoreQuery } from '@/lib/schemas/shopify'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifyStoreQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Store not connected to Shopify' }, { status: 422 })
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ refunds: DEMO_REFUNDS }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })

  try {
    const dateRange = parseDateRange(request)
    const refunds = await getRefunds(credentials, dateRange)
    return NextResponse.json({ refunds }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (err: unknown) {
    const { data: cached } = await supabaseAdmin
      .from('shopify_orders')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('financial_status', 'refunded')
      .order('created_at', { ascending: false })
      .limit(50)

    if (cached && cached.length > 0) {
      return serviceCatchHandler(err, 'shopify', {
        fallbackData: { refunds: cached },
        fallbackMessage: 'Showing cached refunds — Shopify is temporarily unavailable',
      })
    }
    return serviceCatchHandler(err, 'shopify')
  }
}
