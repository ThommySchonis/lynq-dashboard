import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { DEMO_SHOP, DEMO_TREND } from '@/lib/demoData'
import { getRevenueTrend } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { shopifyRevenueTrendQuery } from '@/lib/schemas/shopify'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifyRevenueTrendQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ trend: DEMO_TREND }, {
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
    console.error('[revenue-trend] error:', err)
    return NextResponse.json({ trend: [] }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  }
}
