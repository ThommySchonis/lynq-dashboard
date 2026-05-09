import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_ORDERS } from '../../../../lib/demoData'
import { getOrders, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ orders: DEMO_ORDERS })

  try {
    const orders = await getOrders(credentials)
    return NextResponse.json({ orders })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
