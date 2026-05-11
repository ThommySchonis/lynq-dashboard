import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const customerId = searchParams.get('id')

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('shopify_domain, shopify_api_key')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!client?.shopify_domain || !client?.shopify_api_key) {
    return NextResponse.json({ customers: [] })
  }

  let url: string
  if (customerId) {
    url = `https://${client.shopify_domain}/admin/api/2024-01/customers/${customerId}.json`
  } else if (query) {
    url = `https://${client.shopify_domain}/admin/api/2024-01/customers/search.json?query=${encodeURIComponent(query)}`
  } else {
    return NextResponse.json({ error: 'q or id parameter required' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': client.shopify_api_key },
    })
    if (!res.ok) return NextResponse.json({ customers: [] })
    const data = await res.json() as {
      customer?: Record<string, unknown>
      customers?: Record<string, unknown>[]
    }

    const customers = customerId ? [data.customer] : (data.customers || [])
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
