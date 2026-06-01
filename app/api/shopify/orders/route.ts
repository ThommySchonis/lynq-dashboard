import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { DEMO_SHOP, DEMO_ORDERS } from '@/lib/demoData'
import { getOrders } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { shopifyStoreQuery } from '@/lib/schemas/shopify'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifyStoreQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Store not connected to Shopify' }, { status: 422 })
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ orders: DEMO_ORDERS })

  try {
    const orders = await getOrders(credentials)
    return NextResponse.json({ orders })
  } catch (err: unknown) {
    const { data: cached } = await supabaseAdmin
      .from('shopify_orders')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (cached && cached.length > 0) {
      return serviceCatchHandler(err, 'shopify', {
        fallbackData: { orders: cached },
        fallbackMessage: 'Showing cached orders — Shopify is temporarily unavailable',
      })
    }
    return serviceCatchHandler(err, 'shopify')
  }
}
