import { getAuthContext } from '../../../../../../lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { editOrder, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'

export async function POST(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(request.url).searchParams.get('store_id')
  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 })
  }
  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)

  const { id } = await params
  const body = await request.json()

  try {
    const orderEdit = await editOrder(credentials, id, body)
    return NextResponse.json({ success: true, orderEdit })
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
  }
}
