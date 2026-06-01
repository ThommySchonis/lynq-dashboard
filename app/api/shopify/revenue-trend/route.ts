import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { DEMO_SHOP, DEMO_TREND } from '@/lib/demoData'
import { getRevenueTrend } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { shopifyRevenueTrendQuery } from '@/lib/schemas/shopify'
import { logger } from '@/lib/logger'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifyRevenueTrendQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (credentials?.domain === DEMO_SHOP) return NextResponse.json({ trend: DEMO_TREND }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })

  if (!query.from || !query.to) return NextResponse.json({ trend: [] }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })

  try {
    const trend = await getRevenueTrend(ctx.workspaceId, { from: query.from, to: query.to }, query.store_id)
    return NextResponse.json({ trend }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (err: unknown) {
    logger.error('[shopify/revenue-trend]', 'error fetching revenue trend', { error: err instanceof Error ? err.message : String(err) })

    const { data: cached } = await supabaseAdmin
      .from('shopify_orders')
      .select('total_price, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .gte('created_at', query.from)
      .lte('created_at', query.to)
      .order('created_at', { ascending: true })
      .limit(500)

    if (cached && cached.length > 0) {
      const trendMap = new Map<string, number>()
      for (const order of cached) {
        const createdAt = String(order.created_at ?? '')
        const date = createdAt.split('T')[0] ?? ''
        if (date) {
          trendMap.set(date, (trendMap.get(date) ?? 0) + (parseFloat(String(order.total_price)) || 0))
        }
      }
      const fallbackTrend = Array.from(trendMap.entries()).map(([date, revenue]) => ({ date, revenue }))

      return serviceCatchHandler(err, 'shopify', {
        fallbackData: { trend: fallbackTrend },
        fallbackMessage: 'Showing cached revenue trend — Shopify is temporarily unavailable',
      })
    }
    return serviceCatchHandler(err, 'shopify')
  }
}
