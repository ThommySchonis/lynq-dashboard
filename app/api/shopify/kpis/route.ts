import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { DEMO_SHOP, DEMO_KPIS } from '@/lib/demoData'
import { getKPIs } from '@/lib/services/shopify'
import { parseDateRange } from '@/lib/utils/request'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { shopifyStoreQuery } from '@/lib/schemas/shopify'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifyStoreQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (credentials.domain === DEMO_SHOP) return NextResponse.json(DEMO_KPIS, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })

  try {
    const dateRange = parseDateRange(request)
    const kpis = await getKPIs(ctx.workspaceId, dateRange, query.store_id)
    // Signal to frontend that initial sync is needed
    const response = kpis.totalOrders === 0 ? { ...kpis, needsSync: true } : kpis
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (err: unknown) {
    console.error('[kpis] error:', err)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
