import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { getCustomer, ShopifyApiError } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { shopifyCustomerQuery } from '@/lib/schemas/shopify'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifyCustomerQuery)
  if (qErr) return qErr

  if (!query.email && !query.order) {
    return NextResponse.json({ error: 'Missing email or order' }, { status: 400 })
  }

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)

  try {
    const result = await getCustomer(credentials, { email: query.email, order: query.order })
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}
