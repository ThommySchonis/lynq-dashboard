import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

function timingSafeCompare(a, b) {
  const left = Buffer.from(a || '')
  const right = Buffer.from(b || '')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

// Resolve the integration row from the ?cid= URL parameter. As of Block C
// Phase 3 Batch 5 ?cid is the workspace_id; pre-migration subscriptions
// passed client_id (= the auth user id). Try workspace_id first, then
// fall back to client_id so legacy webhook subscriptions keep working
// during the transition. Once Phase 5 drops client_id, this fallback
// path will go away.
async function resolveIntegration(cid) {
  const { data: byWorkspace } = await supabaseAdmin
    .from('integrations')
    .select('client_id, workspace_id, shopify_client_secret, shopify_domain')
    .eq('workspace_id', cid)
    .maybeSingle()
  if (byWorkspace) return byWorkspace

  const { data: byClient } = await supabaseAdmin
    .from('integrations')
    .select('client_id, workspace_id, shopify_client_secret, shopify_domain')
    .eq('client_id', cid)
    .maybeSingle()
  return byClient || null
}

function upsertOrder(order, clientId, workspaceId) {
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

  // Transition: dual-write client_id (legacy) + workspace_id.
  // onConflict is the new (workspace_id, id) unique key from Phase 4.
  return supabaseAdmin.from('shopify_orders').upsert({
    id:                 order.id,
    client_id:          clientId,
    workspace_id:       workspaceId,
    order_number:       order.name,
    financial_status:   order.financial_status,
    cancel_reason:      order.cancel_reason || null,
    subtotal_price:     subtotal,
    total_price:        totalPrice,
    total_discounts:    totalDiscounts,
    refund_amount:      refundAmount,
    source_name:        order.source_name || null,
    customer_email:     order.customer?.email || order.email || null,
    customer_name:      customerName,
    processed_at:       order.processed_at,
    created_at_shopify: order.created_at,
    updated_at_shopify: order.updated_at,
    synced_at:          new Date().toISOString(),
  }, { onConflict: 'workspace_id,id' })
}

export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const cid = searchParams.get('cid')
  if (!cid) return NextResponse.json({ ok: true })

  const rawBody = await request.text()
  const hmac    = request.headers.get('x-shopify-hmac-sha256')
  const topic   = request.headers.get('x-shopify-topic')

  // Resolve the integration (workspace-keyed; legacy client_id fallback)
  const integration = await resolveIntegration(cid)

  if (!integration?.shopify_client_secret || !hmac) {
    return NextResponse.json({ error: 'Webhook verification unavailable' }, { status: 401 })
  }

  const shopDomain = request.headers.get('x-shopify-shop-domain')
  if (shopDomain && integration.shopify_domain && shopDomain !== integration.shopify_domain) {
    return NextResponse.json({ error: 'Shop mismatch' }, { status: 401 })
  }

  const digest = crypto
    .createHmac('sha256', integration.shopify_client_secret)
    .update(rawBody, 'utf8')
    .digest('base64')
  if (!timingSafeCompare(digest, hmac)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id: clientId, workspace_id: workspaceId } = integration

  if (topic === 'orders/create' || topic === 'orders/updated') {
    await upsertOrder(payload, clientId, workspaceId)
  }

  if (topic === 'orders/cancelled') {
    await supabaseAdmin
      .from('shopify_orders')
      .update({ cancel_reason: payload.cancel_reason || 'other', synced_at: new Date().toISOString() })
      .eq('id', payload.id)
      .eq('workspace_id', workspaceId)
  }

  if (topic === 'refunds/create') {
    const orderId = payload.order_id
    const { data: existing } = await supabaseAdmin
      .from('shopify_orders')
      .select('refund_amount')
      .eq('id', orderId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (existing) {
      const newRefund = (payload.transactions || []).reduce((s, t) => s + parseFloat(t.amount || 0), 0)
      await supabaseAdmin
        .from('shopify_orders')
        .update({ refund_amount: (existing.refund_amount || 0) + newRefund, synced_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('workspace_id', workspaceId)
    }
  }

  return NextResponse.json({ ok: true })
}
