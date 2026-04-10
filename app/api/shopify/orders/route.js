import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('shopify_domain, shopify_api_key')
    .eq('email', user.email)
    .single()

  if (!client?.shopify_domain || !client?.shopify_api_key) {
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://${client.shopify_domain}/admin/api/2024-01/orders.json?status=any&limit=50`,
      { headers: { 'X-Shopify-Access-Token': client.shopify_api_key } }
    )
    if (!res.ok) return NextResponse.json({ error: 'Shopify API error' }, { status: 502 })
    const { orders } = await res.json()

    const mapped = orders.map(o => ({
      id: o.id,
      name: o.name,
      customer: o.customer ? `${o.customer.first_name} ${o.customer.last_name}`.trim() : 'Unknown',
      total: parseFloat(o.total_price || 0).toFixed(2),
      financialStatus: o.financial_status,
      fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
      cancelReason: o.cancel_reason || null,
      hasRefund: o.refunds && o.refunds.length > 0,
      createdAt: o.created_at,
    }))

    return NextResponse.json({ orders: mapped })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
