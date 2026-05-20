import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { fulfillOrder, ShopifyApiError } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { validateQuery, validateParams, validateBody } from '@/lib/validation'
import { shopifyStoreQuery, shopifyOrderParams, shopifyPassthroughBody } from '@/lib/schemas/shopify'

export async function POST(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifyStoreQuery)
  if (qErr) return qErr

  const [p, pErr] = validateParams(await params, shopifyOrderParams)
  if (pErr) return pErr

  const [body, bErr] = await validateBody(request, shopifyPassthroughBody)
  if (bErr) return bErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)

  try {
    const fulfillment = await fulfillOrder(credentials, p.id, body as Parameters<typeof fulfillOrder>[2])
    return NextResponse.json({ success: true, fulfillment })
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 })
  }
}
