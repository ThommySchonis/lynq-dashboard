import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

function upsertOrder(order, clientId) {
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

  const customerName = order.customer
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
    : null

  return supabaseAdmin.from('shopify_orders').upsert({
    id: order.id,
    client_id: clientId,
    order_number: order.name,
    financial_status: order.financial_status,
    cancel_reason: order.cancel_reason || null,
    subtotal_price: subtotal,
    total_price: totalPrice,
    total_discounts: totalDiscounts,
    refund_amount: refundAmount,
    source_name: order.source_name || null,
    customer_email: order.customer?.email || order.email || null,
    customer_name: customerName,
    processed_at: order.processed_at,
    created_at_shopify: order.created_at,
    updated_at_shopify: order.updated_at,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'id,client_id' })
}

export async function POST(request) {
  const { searchParams } = await new URL(request.url)
  const clientId = searchParams.get('cid')
  if (!clientId) return NextResponse.json({ ok: true })

  const rawBody = await request.text()
  const hmac = request.headers.get('x-shopify-hmac-sha256')
  const topic = request.headers.get('x-shopify-topic')

  // Verify HMAC using stored client secret
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('shopify_client_secret')
    .eq('client_id', clientId)
    .maybeSingle()

  if (integration?.shopify_client_secret) {
    const digest = crypto
      .createHmac('sha256', integration.shopify_client_secret)
      .update(rawBody, 'utf8')
      .digest('base64')
    if (digest !== hmac) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const payload = JSON.parse(rawBody)

  if (topic === 'orders/create' || topic === 'orders/updated') {
    await upsertOrder(payload, clientId)
  }

  if (topic === 'orders/cancelled') {
    await supabaseAdmin
      .from('shopify_orders')
      .update({ cancel_reason: payload.cancel_reason || 'other', synced_at: new Date().toISOString() })
      .eq('id', payload.id)
      .eq('client_id', clientId)
  }

  if (topic === 'refunds/create') {
    const orderId = payload.order_id
    const { data: existing } = await supabaseAdmin
      .from('shopify_orders')
      .select('refund_amount')
      .eq('id', orderId)
      .eq('client_id', clientId)
      .maybeSingle()

    if (existing) {
      const newRefund = (payload.transactions || []).reduce((s, t) => s + parseFloat(t.amount || 0), 0)
      await supabaseAdmin
        .from('shopify_orders')
        .update({ refund_amount: (existing.refund_amount || 0) + newRefund, synced_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('client_id', clientId)
    }
  }

  return NextResponse.json({ ok: true })
}
