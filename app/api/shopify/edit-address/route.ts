import { getAuthContext } from '../../../../lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { updateOrderAddress, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(request.url).searchParams.get('store_id')
  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 })
  }
  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)

  const { orderId, ...address } = await request.json() as { orderId: string; [key: string]: unknown }
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const shippingAddress = await updateOrderAddress(credentials, orderId, address)
    return NextResponse.json({ success: true, shippingAddress })
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Address update failed' }, { status: 500 })
  }
}
