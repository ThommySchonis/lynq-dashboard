import { getAuthContext } from '../../../../lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { createRefund, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { parseBody } from '@/lib/utils/typed-json'

interface RefundOrderBody {
  orderId: string
  [key: string]: unknown
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(request.url).searchParams.get('store_id')
  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 })
  }
  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)

  const { orderId, ...params } = await parseBody<RefundOrderBody>(request)
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const refund = await createRefund(credentials, orderId, params)
    return NextResponse.json({ success: true, refund })
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
  }
}
