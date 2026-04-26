import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

async function syncOrders(userId, shop, accessToken) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  let orders = []
  let url = `https://${shop}/admin/api/2025-04/orders.json?status=any&limit=250&processed_at_min=${since}`

  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } })
    if (!res.ok) break
    const data = await res.json()
    orders = orders.concat(data.orders || [])
    const link = res.headers.get('link')
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }

  const rows = orders.map(order => {
    const subtotal = parseFloat(order.subtotal_price_set?.presentment_money?.amount || order.subtotal_price || 0)
    const totalPrice = parseFloat(order.total_price_set?.presentment_money?.amount || order.total_price || 0)
    const totalDiscounts = parseFloat(order.total_discounts_set?.presentment_money?.amount || order.total_discounts || 0)
    const refundAmount = (order.refunds || []).reduce((sum, r) =>
      sum + (r.transactions || []).reduce((ts, t) =>
        ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

    return {
      id: order.id,
      client_id: userId,
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

  for (let i = 0; i < rows.length; i += 100) {
    await supabaseAdmin.from('shopify_orders').upsert(rows.slice(i, i + 100), { onConflict: 'id,client_id' })
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const { code, hmac, shop, state } = Object.fromEntries(searchParams)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const { data: oauthState } = await supabaseAdmin
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .eq('shop', shop)
    .maybeSingle()

  if (!oauthState || new Date(oauthState.expires_at) < new Date()) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`)
  }

  const clientId = oauthState.client_id || process.env.SHOPIFY_CLIENT_ID
  const clientSecret = oauthState.client_secret || process.env.SHOPIFY_CLIENT_SECRET

  const params = Object.fromEntries(searchParams.entries())
  delete params.hmac
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const digest = crypto.createHmac('sha256', clientSecret).update(message).digest('hex')

  if (digest !== hmac) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_hmac`)
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?error=token_exchange_failed`)
  }

  const { error: upsertError } = await supabaseAdmin.from('integrations').upsert({
    client_id: oauthState.user_id,
    shopify_domain: shop,
    shopify_access_token: tokenData.access_token,
    shopify_scope: tokenData.scope,
    shopify_client_secret: clientSecret,
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  if (upsertError) {
    console.error('integrations upsert failed:', JSON.stringify(upsertError))
    return NextResponse.redirect(`${appUrl}/settings?error=save_failed`)
  }

  // Register webhooks
  const webhookBase = process.env.NEXT_PUBLIC_APP_URL
  const webhookTopics = ['orders/create', 'orders/updated', 'orders/cancelled', 'refunds/create']
  await Promise.all(webhookTopics.map(topic =>
    fetch(`https://${shop}/admin/api/2025-04/webhooks.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': tokenData.access_token },
      body: JSON.stringify({
        webhook: { topic, address: `${webhookBase}/api/webhooks/shopify?cid=${oauthState.user_id}`, format: 'json' },
      }),
    })
  ))

  await supabaseAdmin.from('oauth_states').delete().eq('state', state)

  // Sync last 90 days of orders immediately after connecting
  try {
    await syncOrders(oauthState.user_id, shop, tokenData.access_token)
  } catch (e) {
    console.error('Initial sync failed:', e)
  }

  return NextResponse.redirect(`${appUrl}/settings?shopify=connected`)
}
