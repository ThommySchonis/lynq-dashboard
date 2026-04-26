import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyCredentials } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_ORDERS } from '../../../../lib/demoData'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyCredentials(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  if (client.domain === DEMO_SHOP) {
    return NextResponse.json({ orders: DEMO_ORDERS })
  }

  try {
    const res = await fetch(
      `https://${client.domain}/admin/api/2025-04/orders.json?status=any&limit=50`,
      { headers: { 'X-Shopify-Access-Token': client.accessToken } }
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
