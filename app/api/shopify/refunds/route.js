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
    // Filter by updated_at so we catch orders that were refunded in the requested period
    // (e.g. a March order refunded in April shows up in April's data)
    let nextUrl = `https://${client.domain}/admin/api/2025-04/orders.json?status=any&limit=250`
    if (from) nextUrl += `&updated_at_min=${from}T00:00:00`
    if (to)   nextUrl += `&updated_at_max=${to}T23:59:59`

    const allOrders = []

    // Paginate through all pages
    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { 'X-Shopify-Access-Token': client.accessToken },
      })

      // Respect Shopify rate limiting
      if (res.status === 429) {
        const wait = parseInt(res.headers.get('Retry-After') || '2') * 1000
        await new Promise(r => setTimeout(r, wait))
        continue
      }

      if (!res.ok) return NextResponse.json({ error: 'Shopify API error' }, { status: 502 })

      const data = await res.json()
      allOrders.push(...(data.orders || []))

      const link = res.headers.get('link')
      const next = link?.match(/<([^>]+)>;\s*rel="next"/)
      nextUrl = next ? next[1] : null
    }

    const fromTs = from ? `${from}T00:00:00` : null
    const toTs   = to   ? `${to}T23:59:59`   : null

    const refunded = allOrders
      .filter(o => o.refunds && o.refunds.length > 0)
      .flatMap(o => {
        const orderTotal = parseFloat(
          o.total_price_set?.presentment_money?.amount || o.total_price || 0
        )

        // Only include refunds whose created_at falls within the requested date range
        const inRange = (o.refunds || []).filter(r => {
          if (!fromTs && !toTs) return true
          if (fromTs && r.created_at < fromTs) return false
          if (toTs   && r.created_at > toTs)   return false
          return true
        })

        if (inRange.length === 0) return []

        const refundTotal = inRange.reduce((sum, r) =>
          sum + (r.transactions || []).reduce((ts, t) =>
            ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

        if (refundTotal <= 0) return []

        const items = inRange.flatMap(r => r.refund_line_items || [])
        const productNames = [...new Set(items.map(i => i.line_item?.title).filter(Boolean))]

        const refundNote = inRange.map(r => r.note).filter(Boolean).join('; ')
        const reason = refundNote || o.cancel_reason || null

        // Use the most recent refund's timestamp as refundedAt
        const refundedAt = inRange.map(r => r.created_at).sort().at(-1)

        return [{
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
          refundedAt,
        }]
      })
      .sort((a, b) => new Date(b.refundedAt) - new Date(a.refundedAt))

    return NextResponse.json({ refunds: refunded })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 })
  }
}
