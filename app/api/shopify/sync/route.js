import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyCredentials } from '../../../../lib/shopifyCredentials'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyCredentials(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  let orders = []
  let url = `https://${client.domain}/admin/api/2024-01/orders.json?status=any&limit=250`

  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': client.accessToken } })
    if (!res.ok) break
    const data = await res.json()
    orders = orders.concat(data.orders)
    const link = res.headers.get('link')
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }

  const rows = orders.map(order => {
    const refundAmount = (order.refunds || []).reduce((sum, r) =>
      sum + (r.transactions || []).reduce((ts, t) => ts + parseFloat(t.amount || 0), 0), 0)

    return {
      id: order.id,
      client_id: user.id,
      order_number: order.name,
      financial_status: order.financial_status,
      cancel_reason: order.cancel_reason || null,
      subtotal_price: parseFloat(order.subtotal_price || 0),
      total_price: parseFloat(order.total_price || 0),
      total_discounts: parseFloat(order.total_discounts || 0),
      refund_amount: refundAmount,
      customer_email: order.customer?.email || order.email || null,
      customer_name: order.customer
        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
        : null,
      processed_at: order.processed_at,
      created_at_shopify: order.created_at,
      updated_at_shopify: order.updated_at,
      synced_at: new Date().toISOString(),
    }
  })

  // Upsert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    await supabaseAdmin.from('shopify_orders').upsert(rows.slice(i, i + 100), { onConflict: 'id,client_id' })
  }

  return NextResponse.json({ success: true, synced: rows.length })
}
