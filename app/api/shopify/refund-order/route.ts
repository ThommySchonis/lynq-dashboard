import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { createRefund } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery, validateBody } from '@/lib/validation'
import { shopifyStoreQuery, legacyRefundOrderBody } from '@/lib/schemas/shopify'
import { serviceCatchHandler } from '@/lib/service-catch-handler'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [query, qErr] = validateQuery(request, shopifyStoreQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Store not connected to Shopify' }, { status: 422 })

  const [body, bErr] = await validateBody(request, legacyRefundOrderBody)
  if (bErr) return bErr

  const { orderId, ...params } = body

  try {
    const refund = await createRefund(credentials, orderId, params)
    return NextResponse.json({ success: true, refund })
  } catch (err: unknown) {
    return serviceCatchHandler(err, 'shopify')
  }
}
