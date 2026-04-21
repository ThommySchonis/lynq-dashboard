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

  // Fetch store currency and save to integrations
  const shopRes = await fetch(`https://${client.domain}/admin/api/2024-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': client.accessToken }
  })
  if (shopRes.ok) {
    const shopData = await shopRes.json()
    const currency = shopData.shop?.currency || 'EUR'
    await supabaseAdmin.from('integrations')
      .update({ store_currency: currency })
      .eq('client_id', user.id)
  }

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
    // Use presentment_money (customer-facing currency, e.g. EUR) if available,
    // otherwise fall back to shop currency (e.g. GBP). This matches Shopify Analytics.
    const subtotal = parseFloat(
      order.subtotal_price_set?.presentment_money?.amount ||
      order.subtotal_price || 0
    )
    const totalPrice = parseFloat(
      order.total_price_set?.presentment_money?.amount ||
      order.total_price || 0
    )
    const totalDiscounts = parseFloat(
      order.total_discounts_set?.presentment_money?.amount ||
      order.total_discounts || 0
    )

    const refundAmount = (order.refunds || []).reduce((sum, r) =>
      sum + (r.transactions || []).reduce((ts, t) =>
        ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

    return {
      id: order.id,
      client_id: user.id,
      order_number: order.name,
      financial_status: order.financial_status,
      cancel_reason: order.cancel_reason || null,
      subtotal_price: subtotal,
      total_price: totalPrice,
      total_discounts: totalDiscounts,
      refund_amount: refundAmount,
      presentment_currency: order.presentment_currency || order.currency || null,
      source_name: order.source_name || null,
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
