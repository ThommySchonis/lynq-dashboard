import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { getAnalytics } from '@/lib/services/shopify'
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

  try {
    const dateRange = parseDateRange(request)
    const result = await getAnalytics(credentials, dateRange)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const { data: cached } = await supabaseAdmin
      .from('shopify_orders')
      .select('total_price, financial_status, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (cached && cached.length > 0) {
      const totalOrders = cached.length
      const totalRevenue = cached.reduce((sum, o) => sum + (parseFloat(String(o.total_price)) || 0), 0)
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      return serviceCatchHandler(err, 'shopify', {
        fallbackData: { totalOrders, totalRevenue, avgOrderValue },
        fallbackMessage: 'Showing cached analytics — Shopify is temporarily unavailable',
      })
    }
    return serviceCatchHandler(err, 'shopify')
  }
}
