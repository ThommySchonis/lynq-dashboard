import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_REFUNDS } from '../../../../lib/demoData'
import { getRefunds, ShopifyApiError } from '../../../../lib/services/shopify'
import { parseDateRange } from '../../../../lib/utils/request'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ refunds: DEMO_REFUNDS })

  try {
    const dateRange = parseDateRange(request)
    const refunds = await getRefunds(credentials, dateRange)
    return NextResponse.json({ refunds })
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 })
  }
}
