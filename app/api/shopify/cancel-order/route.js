import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { cancelOrder, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, ...params } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const order = await cancelOrder(credentials, orderId, params)
    return NextResponse.json({ success: true, order })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 })
  }
}
