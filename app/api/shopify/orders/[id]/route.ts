import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { getOrderDetail, ShopifyApiError } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { validateQuery, validateParams } from '@/lib/validation'
import { shopifyStoreQuery, shopifyOrderParams } from '@/lib/schemas/shopify'

export async function GET(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifyStoreQuery)
  if (qErr) return qErr

  const [p, pErr] = validateParams(await params, shopifyOrderParams)
  if (pErr) return pErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Store not connected to Shopify' }, { status: 422 })

  try {
    const order = await getOrderDetail(credentials, p.id)
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
