import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { parseJson } from '@/lib/utils/typed-json'
import { validateQuery } from '@/lib/validation'
import { shopifyCustomerQuery } from '@/lib/schemas/inbox'
import { checkRateLimit } from '@/lib/rate-limit'

interface ShopifyClient {
  shopify_domain?: string
  shopify_api_key?: string
}

interface ShopifyCustomerResponse {
  customer?: Record<string, unknown>
  customers?: Record<string, unknown>[]
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:inbox`, 60, 60_000)
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

  const [query, queryErr] = validateQuery(request, shopifyCustomerQuery)
  if (queryErr) return queryErr

  const { data: clientRaw } = await supabaseAdmin
    .from('clients')
    .select('shopify_domain, shopify_api_key')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  const client = clientRaw as ShopifyClient | null

  if (!client?.shopify_domain || !client?.shopify_api_key) {
    return NextResponse.json({ customers: [] })
  }

  let url: string
  if (query.id) {
    url = `https://${client.shopify_domain}/admin/api/2024-01/customers/${query.id}.json`
  } else if (query.q) {
    url = `https://${client.shopify_domain}/admin/api/2024-01/customers/search.json?query=${encodeURIComponent(query.q)}`
  } else {
    return NextResponse.json({ error: 'q or id parameter required' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': client.shopify_api_key },
    })
    if (!res.ok) return NextResponse.json({ customers: [] })
    const data = await parseJson<ShopifyCustomerResponse>(res)

    const customers = query.id ? [data.customer] : (data.customers || [])
    return NextResponse.json({
      customers: customers.filter(Boolean).map(c => ({
        id: String((c as Record<string, unknown>).id),
        email: (c as Record<string, unknown>).email,
        name: `${(c as Record<string, unknown>).first_name || ''} ${(c as Record<string, unknown>).last_name || ''}`.trim(),
        ordersCount: (c as Record<string, unknown>).orders_count,
        totalSpent: (c as Record<string, unknown>).total_spent,
      }))
    })
  } catch (err: unknown) {
    void err
    return NextResponse.json({ customers: [] })
  }
}
