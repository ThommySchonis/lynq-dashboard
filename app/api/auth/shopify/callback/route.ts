import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { syncOrders } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

function timingSafeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a || '')
  const right = Buffer.from(b || '')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export async function GET(request: NextRequest) {
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

  if (!timingSafeCompare(digest, hmac)) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_hmac`)
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })

  const tokenData = await tokenRes.json() as { access_token?: string; scope?: string }
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?error=token_exchange_failed`)
  }

  const accessToken = tokenData.access_token
  const scope = tokenData.scope

  // Resolve workspace_id from the user who initiated OAuth. If the user
  // somehow has no workspace at this point, fail loudly — the OAuth flow
  // shouldn't be reachable without a logged-in user who already has one.
  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', oauthState.user_id)
    .maybeSingle()

  const workspaceId = membership?.workspace_id
  if (!workspaceId) {
    console.error('[shopify oauth callback] no workspace found for user', oauthState.user_id)
    return NextResponse.redirect(`${appUrl}/settings?error=no_workspace`)
  }

  const userId = oauthState.user_id
  const storeName = oauthState.store_name || shop.replace('.myshopify.com', '')

  // 1. Create store (name only — no Shopify creds in stores table)
  const { data: store } = await supabaseAdmin
    .from('stores')
    .upsert(
      { workspace_id: workspaceId, name: storeName },
      { onConflict: 'workspace_id,name' }
    )
    .select('id')
    .single()

  const storeId = store!.id

  // 2. Fetch shop metadata for store_currency
  const shopRes = await fetch(`https://${shop}/admin/api/2025-04/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  })
  const shopData = await shopRes.json()
  const storeCurrency = shopData?.shop?.currency || null

  // 3. Write credentials to integrations (not stores)
  const { error: upsertError } = await supabaseAdmin
    .from('integrations')
    .upsert(
      {
        workspace_id: workspaceId,
        client_id: userId,
        store_id: storeId,
        shopify_domain: shop,
        shopify_access_token: accessToken,
        shopify_client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        shopify_scope: scope,
        shopify_connected_at: new Date().toISOString(),
        store_currency: storeCurrency,
        status: 'connected',
      },
      { onConflict: 'workspace_id,store_id' }
    )

  if (upsertError) {
    console.error('integrations upsert failed:', JSON.stringify(upsertError))
    return NextResponse.redirect(`${appUrl}/settings?error=save_failed`)
  }

  // Register webhooks with store_id in URLs
  const webhookBase = process.env.NEXT_PUBLIC_APP_URL
  const webhookTopics = ['orders/create', 'orders/updated', 'orders/cancelled', 'refunds/create']
  await Promise.all(webhookTopics.map(topic =>
    fetch(`https://${shop}/admin/api/2025-04/webhooks.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({
        webhook: { topic, address: `${webhookBase}/api/webhooks/shopify?store_id=${storeId}&cid=${workspaceId}`, format: 'json' },
      }),
    })
  ))

  await supabaseAdmin.from('oauth_states').delete().eq('state', state)

  // Sync last 90 days of orders immediately after connecting
  try {
    const credentials = { domain: shop, accessToken }
    await syncOrders(workspaceId, credentials, userId, { storeId })
  } catch (e: unknown) {
    console.error('Initial sync failed:', e)
  }

  return NextResponse.redirect(`${appUrl}/settings?shopify=connected`)
}
