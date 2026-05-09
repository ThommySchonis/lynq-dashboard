import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_KPIS } from '../../../../lib/demoData'
import { getKPIs } from '../../../../lib/services/shopify'
import { parseDateRange } from '../../../../lib/utils/request'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (creds?.domain === DEMO_SHOP) return NextResponse.json(DEMO_KPIS)

  try {
    const dateRange = parseDateRange(request)
    const kpis = await getKPIs(ctx.workspaceId, dateRange)
    // Signal to frontend that initial sync is needed
    if (kpis.totalOrders === 0) kpis.needsSync = true
    return NextResponse.json(kpis)
  } catch (err) {
    console.error('[kpis] error:', err)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
