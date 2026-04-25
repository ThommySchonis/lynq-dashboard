import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyCredentials } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_REFUNDS } from '../../../../lib/demoData'
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
    return NextResponse.json({ refunds: DEMO_REFUNDS })
  }

  try {
    const res = await fetch(
      `https://${client.domain}/admin/api/2024-01/orders.json?status=any&limit=250`,
      { headers: { 'X-Shopify-Access-Token': client.accessToken } }
    )
    if (!res.ok) return NextResponse.json({ error: 'Shopify API error' }, { status: 502 })
    const { orders } = await res.json()

    const refunded = orders
      .filter(o => o.refunds && o.refunds.length > 0)
      .map(o => {
        const refundTotal = o.refunds.reduce((sum, r) => {
          return sum + (r.transactions || []).reduce((ts, t) => ts + parseFloat(t.amount || 0), 0)
        }, 0)
        const items = o.refunds.flatMap(r => r.refund_line_items || [])
        const productNames = [...new Set(
          items.map(i => i.line_item?.title).filter(Boolean)
        )]
        return {
          orderId: o.name,
          customer: o.customer ? `${o.customer.first_name} ${o.customer.last_name}`.trim() : 'Unknown',
          refundAmount: refundTotal.toFixed(2),
          itemCount: items.reduce((s, i) => s + (i.quantity || 0), 0),
          products: productNames,
          refundedAt: o.refunds[0].created_at,
        }
      })

    return NextResponse.json({ refunds: refunded })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 })
  }
}
