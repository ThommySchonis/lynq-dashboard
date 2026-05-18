import { getAuthContext } from '../../../../lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { getCustomer, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id')
  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 })
  }
  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)

  const email = searchParams.get('email')
  const order = searchParams.get('order')

  if (!email && !order) {
    return NextResponse.json({ error: 'Missing email or order' }, { status: 400 })
  }

  try {
    const result = await getCustomer(credentials, { email: email ?? undefined, order: order ?? undefined })
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}
