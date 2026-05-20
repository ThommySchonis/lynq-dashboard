import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { DEMO_SHOP, DEMO_REFUNDS } from '@/lib/demoData'
import { getRefunds, ShopifyApiError } from '@/lib/services/shopify'
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
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 })
  }
}
