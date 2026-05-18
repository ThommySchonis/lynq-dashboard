import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'
import { parseJson } from '@/lib/utils/typed-json'

interface ShopifyOrdersResponse {
  orders?: Record<string, unknown>[]
}

interface ShopifyTokenResponse {
  access_token?: string
  scope?: string
}

interface WorkspaceMemberRow {
  workspace_id?: string
}

function timingSafeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a || '')
  const right = Buffer.from(b || '')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

async function syncOrders(userId: string, workspaceId: string, shop: string, accessToken: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  let orders: unknown[] = []
  let url: string | null = `https://${shop}/admin/api/2025-04/orders.json?status=any&limit=250&processed_at_min=${since}`

  while (url) {
    const fetchRes: Response = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } })
    if (!fetchRes.ok) break
    const data = await parseJson<ShopifyOrdersResponse>(fetchRes)
    orders = orders.concat(data.orders || [])
    const linkHeader: string | null = fetchRes.headers.get('link')
    const nextMatch: RegExpMatchArray | null = linkHeader?.match(/<([^>]+)>;\s*rel="next"/) ?? null
    url = nextMatch ? nextMatch[1] : null
  }

  const rows = (orders as Record<string, unknown>[]).map(order => {
    const subtotal = parseFloat((order.subtotal_price_set as Record<string, Record<string, string>> | undefined)?.presentment_money?.amount || order.subtotal_price as string || '0')
    const totalPrice = parseFloat((order.total_price_set as Record<string, Record<string, string>> | undefined)?.presentment_money?.amount || order.total_price as string || '0')
    const totalDiscounts = parseFloat((order.total_discounts_set as Record<string, Record<string, string>> | undefined)?.presentment_money?.amount || order.total_discounts as string || '0')
    const refundAmount = ((order.refunds as Record<string, unknown>[] | undefined) || []).reduce((sum, r) =>
      sum + ((r.transactions as Record<string, unknown>[] | undefined) || []).reduce((ts, t) =>
        ts + parseFloat((t.amount_set as Record<string, Record<string, string>> | undefined)?.presentment_money?.amount || t.amount as string || '0'), 0), 0)

    // Transition: dual-write client_id (legacy) + workspace_id
    return {
      id:                   order.id,
      client_id:            userId,
      workspace_id:         workspaceId,
      order_number:         order.name,
      financial_status:     order.financial_status,
      cancel_reason:        order.cancel_reason || null,
      subtotal_price:       subtotal,
      total_price:          totalPrice,
      total_discounts:      totalDiscounts,
      refund_amount:        refundAmount,
      presentment_currency: order.presentment_currency || order.currency || null,
      source_name:          order.source_name || null,
      customer_email:       (order.customer as Record<string, string> | undefined)?.email || order.email || null,
      customer_name:        order.customer
        ? `${(order.customer as Record<string, string>).first_name || ''} ${(order.customer as Record<string, string>).last_name || ''}`.trim()
        : null,
      processed_at:         order.processed_at,
      created_at_shopify:   order.created_at,
      updated_at_shopify:   order.updated_at,
      synced_at:            new Date().toISOString(),
    }
  })

  // onConflict on (workspace_id, id) — the unique constraint added in Phase 4.
  // (id is the Shopify-side order id, bigint.)
  for (let i = 0; i < rows.length; i += 100) {
    await supabaseAdmin.from('shopify_orders').upsert(rows.slice(i, i + 100), { onConflict: 'workspace_id,id' })
  }
}

interface OAuthStateRow {
  state: string
  shop: string
  user_id: string
  workspace_id: string | null
  client_id: string | null
  client_secret: string | null
  expires_at: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code') ?? ''
  const hmac = searchParams.get('hmac') ?? ''
  const shop = searchParams.get('shop') ?? ''
  const state = searchParams.get('state') ?? ''

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const oauthStateResult = await supabaseAdmin
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .eq('shop', shop)
    .maybeSingle()

  const oauthState = oauthStateResult.data as OAuthStateRow | null

  if (!oauthState || new Date(oauthState.expires_at) < new Date()) {
    return NextResponse.redirect(`${appUrl}/settings/integrations/shopify?error=invalid_state`)
  }

  const clientId = oauthState.client_id || process.env.SHOPIFY_CLIENT_ID || ''
  const clientSecret = oauthState.client_secret || process.env.SHOPIFY_CLIENT_SECRET || ''

  const params = Object.fromEntries(searchParams.entries())
  delete params.hmac
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const digest = crypto.createHmac('sha256', clientSecret).update(message).digest('hex')

  if (!timingSafeCompare(digest, hmac)) {
    return NextResponse.redirect(`${appUrl}/settings/integrations/shopify?error=invalid_hmac`)
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })

  const tokenData = await parseJson<ShopifyTokenResponse>(tokenRes)
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings/integrations/shopify?error=token_exchange_failed`)
  }

  // workspace_id is stored in oauth_states at initiation time (via getAuthContext).
  // Fall back to workspace_members lookup for any pre-migration oauth_states rows.
  let workspaceId = oauthState.workspace_id as string | null
  if (!workspaceId) {
    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', oauthState.user_id)
      .maybeSingle()
    workspaceId = (membership as WorkspaceMemberRow | null)?.workspace_id ?? null
  }
  if (!workspaceId) {
    console.error('[shopify oauth callback] no workspace found for user', oauthState.user_id)
    return NextResponse.redirect(`${appUrl}/settings/integrations/shopify?error=no_workspace`)
  }

  // Transition: dual-write client_id (legacy) + workspace_id
  const { error: upsertError } = await supabaseAdmin.from('integrations').upsert({
    client_id:             oauthState.user_id,
    workspace_id:          workspaceId,
    shopify_domain:        shop,
    shopify_access_token:  tokenData.access_token,
    shopify_scope:         tokenData.scope,
    shopify_client_secret: clientSecret,
    shopify_connected_at:  new Date().toISOString(),
  }, { onConflict: 'client_id' })

  if (upsertError) {
    console.error('integrations upsert failed:', JSON.stringify(upsertError))
    return NextResponse.redirect(`${appUrl}/settings/integrations/shopify?error=save_failed`)
  }

  // Register webhooks. ?cid is now workspace_id (Block C Phase 3 Batch 5).
  // Webhook handler resolves the integration row by workspace_id and falls
  // back to legacy client_id lookup for any pre-migration subscriptions.
  const webhookBase = process.env.NEXT_PUBLIC_APP_URL
  const webhookTopics = ['orders/create', 'orders/updated', 'orders/cancelled', 'refunds/create']
  await Promise.all(webhookTopics.map(topic =>
    fetch(`https://${shop}/admin/api/2025-04/webhooks.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': tokenData.access_token! },
      body: JSON.stringify({
        webhook: { topic, address: `${webhookBase}/api/webhooks/shopify?cid=${workspaceId}`, format: 'json' },
      }),
    })
  ))

  await supabaseAdmin.from('oauth_states').delete().eq('state', state)

  // Sync last 90 days of orders immediately after connecting
  try {
    await syncOrders(oauthState.user_id, workspaceId, shop, tokenData.access_token)
  } catch (e: unknown) {
    console.error('Initial sync failed:', e)
  }

  return NextResponse.redirect(`${appUrl}/settings/integrations/shopify?shopify=connected`)
}
