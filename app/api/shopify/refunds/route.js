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

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (client.domain === DEMO_SHOP) {
    return NextResponse.json({ refunds: DEMO_REFUNDS })
  }

  try {
    let url = `https://${client.domain}/admin/api/2025-04/orders.json?status=any&limit=250`
    if (from) url += `&processed_at_min=${from}T00:00:00`
    if (to)   url += `&processed_at_max=${to}T23:59:59`

    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': client.accessToken } })
    if (!res.ok) return NextResponse.json({ error: 'Shopify API error' }, { status: 502 })
    const { orders } = await res.json()

    const refunded = orders
      .filter(o => o.refunds && o.refunds.length > 0)
      .map(o => {
        const orderTotal = parseFloat(o.total_price || 0)

        // Sum all refund transaction amounts
        const refundTotal = o.refunds.reduce((sum, r) =>
          sum + (r.transactions || []).reduce((ts, t) => ts + parseFloat(t.amount || 0), 0), 0)

        // Collect refunded line items
        const items = o.refunds.flatMap(r => r.refund_line_items || [])
        const productNames = [...new Set(items.map(i => i.line_item?.title).filter(Boolean))]

        // Determine reason — use refund note, then cancel_reason
        const refundNote = o.refunds.map(r => r.note).filter(Boolean).join('; ')
        const reason = refundNote || o.cancel_reason || null

        return {
          orderId: o.name,
          orderIdNumeric: o.id,
          customer: o.customer
            ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() || 'Unknown'
            : o.email || 'Unknown',
          customerEmail: o.customer?.email || o.email || null,
          refundAmount: refundTotal.toFixed(2),
          orderTotal: orderTotal.toFixed(2),
          refundPct: orderTotal > 0 ? ((refundTotal / orderTotal) * 100).toFixed(1) : '0.0',
          itemCount: items.reduce((s, i) => s + (i.quantity || 0), 0),
          products: productNames,
          reason,
          refundedAt: o.refunds[0].created_at,
        }
      })
      .sort((a, b) => new Date(b.refundedAt) - new Date(a.refundedAt))

    return NextResponse.json({ refunds: refunded })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 })
  }
}
