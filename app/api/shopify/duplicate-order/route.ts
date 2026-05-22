import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { duplicateOrder, ShopifyApiError } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery, validateBody } from '@/lib/validation'
import { shopifyStoreQuery, legacyDuplicateOrderBody } from '@/lib/schemas/shopify'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [query, qErr] = validateQuery(request, shopifyStoreQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)

  const [body, bErr] = await validateBody(request, legacyDuplicateOrderBody)
  if (bErr) return bErr

  const { orderId, ...params } = body

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
