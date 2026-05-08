import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
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

  let url
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
    const data = await res.json()

    const customers = customerId ? [data.customer] : (data.customers || [])
    return NextResponse.json({
      customers: customers.filter(Boolean).map(c => ({
        id: String(c.id),
        email: c.email,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        ordersCount: c.orders_count,
        totalSpent: c.total_spent,
      }))
    })
  } catch (err) {
    return NextResponse.json({ customers: [] })
  }
}
