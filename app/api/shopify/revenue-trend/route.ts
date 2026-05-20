import { getAuthContext } from '../../../../lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { DEMO_SHOP, DEMO_TREND } from '../../../../lib/demoData'
import { getRevenueTrend } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(request.url).searchParams.get('store_id')
  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 })
  }
  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ trend: DEMO_TREND }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ trend: [] }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })

  try {
    const trend = await getRevenueTrend(ctx.workspaceId, { from, to }, storeId)
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
