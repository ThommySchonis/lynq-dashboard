import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_TREND } from '../../../../lib/demoData'
import { getRevenueTrend } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (creds?.domain === DEMO_SHOP) return NextResponse.json({ trend: DEMO_TREND })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ trend: [] })

  try {
    const trend = await getRevenueTrend(ctx.workspaceId, { from, to })
    return NextResponse.json({ trend })
  } catch (err) {
    console.error('[revenue-trend] error:', err)
    return NextResponse.json({ trend: [] })
  }
}
