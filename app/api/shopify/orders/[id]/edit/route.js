import { getAuthContext } from '../../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../../lib/shopifyCredentials'
import { editOrder, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const body = await request.json()

  try {
    const orderEdit = await editOrder(credentials, id, body)
    return NextResponse.json({ success: true, orderEdit })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
  }
}
