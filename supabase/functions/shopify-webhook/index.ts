import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')!

const supabase = createClient(supabaseUrl, supabaseKey)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verify HMAC signature
  const body = await req.text()
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
  if (!hmacHeader) {
    return new Response('Missing signature', { status: 401 })
  }

  const computed = hmac('sha256', webhookSecret, body, 'utf8', 'base64')
  if (computed !== hmacHeader) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(body)
  const topic = req.headers.get('x-shopify-topic')
  const shopDomain = req.headers.get('x-shopify-shop-domain')

  // Resolve workspace by shop domain
  const { data: integration } = await supabase
    .from('integrations')
    .select('workspace_id, client_id')
    .eq('shopify_domain', shopDomain)
    .maybeSingle()

  if (!integration) {
    console.error(`[shopify-webhook] No workspace found for domain: ${shopDomain}`)
    return new Response('Unknown shop', { status: 200 }) // 200 so Shopify doesn't retry
  }

  const { workspace_id, client_id } = integration

  if (topic === 'orders/create' || topic === 'orders/updated') {
    const order = payload
    const subtotal = parseFloat(
      order.subtotal_price_set?.presentment_money?.amount || order.subtotal_price || 0
    )
    const totalPrice = parseFloat(
      order.total_price_set?.presentment_money?.amount || order.total_price || 0
    )
    const totalDiscounts = parseFloat(
      order.total_discounts_set?.presentment_money?.amount || order.total_discounts || 0
    )
    const refundAmount = (order.refunds || []).reduce((sum: number, r: any) =>
      sum + (r.transactions || []).reduce((ts: number, t: any) =>
        ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

    const row = {
      id: order.id,
      client_id,
      workspace_id,
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

    const { error } = await supabase
      .from('shopify_orders')
      .upsert(row, { onConflict: 'workspace_id,id' })

    if (error) {
      console.error('[shopify-webhook] upsert error:', error.message)
    }
  }

  return new Response('OK', { status: 200 })
})
