import { getAuthContext } from '../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../lib/shopifyCredentials'
import { getOrderDetail, ShopifyApiError } from '../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params

  try {
    const order = await getOrderDetail(credentials, id)
    return NextResponse.json(order)
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
