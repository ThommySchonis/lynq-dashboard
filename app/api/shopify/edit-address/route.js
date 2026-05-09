import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { updateOrderAddress, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, ...address } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const shippingAddress = await updateOrderAddress(credentials, orderId, address)
    return NextResponse.json({ success: true, shippingAddress })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Address update failed' }, { status: 500 })
  }
}
