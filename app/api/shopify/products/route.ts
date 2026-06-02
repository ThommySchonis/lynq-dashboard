import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { searchProducts } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { shopifyProductSearchQuery } from '@/lib/schemas/shopify'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:shopify-products`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const [query, qErr] = validateQuery(request, shopifyProductSearchQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (!credentials) {
    return NextResponse.json(
      { error: 'Store not connected to Shopify' },
      { status: 422 }
    )
  }

  try {
    const result = await searchProducts(credentials, query.q, query.limit)
    return NextResponse.json(result)
  } catch (err: unknown) {
    return serviceCatchHandler(err, 'shopify')
  }
}
