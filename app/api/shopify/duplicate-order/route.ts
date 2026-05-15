import { getAuthContext } from '../../../../lib/auth'
import { resolveCredentials } from '@/lib/store-credentials'
import { duplicateOrder, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(request.url).searchParams.get('store_id')
  const credentials = await resolveCredentials(storeId, ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, ...params } = await request.json() as { orderId: string; [key: string]: unknown }
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const draftOrder = await duplicateOrder(credentials, orderId, params)
    return NextResponse.json({ success: true, draftOrder })
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 })
  }
}
