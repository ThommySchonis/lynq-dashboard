import { getAuthContext } from '../../../../lib/auth'
import { resolveCredentials } from '@/lib/store-credentials'
import { DEMO_SHOP, DEMO_KPIS } from '../../../../lib/demoData'
import { getKPIs } from '../../../../lib/services/shopify'
import { parseDateRange } from '../../../../lib/utils/request'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(request.url).searchParams.get('store_id')
  const creds = await resolveCredentials(storeId, ctx.workspaceId)
  if (creds?.domain === DEMO_SHOP) return NextResponse.json(DEMO_KPIS)

  try {
    const dateRange = parseDateRange(request)
    const kpis = await getKPIs(ctx.workspaceId, dateRange, storeId || undefined)
    // Signal to frontend that initial sync is needed
    const response = kpis.totalOrders === 0 ? { ...kpis, needsSync: true } : kpis
    return NextResponse.json(response)
  } catch (err: unknown) {
    console.error('[kpis] error:', err)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
