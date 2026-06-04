import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { syncOrders } from '@/lib/services/shopify'

interface ShopifyTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  scope?: string
}

interface ShopifyShopDataResponse {
  shop?: { currency?: string }
}

interface WorkspaceMemberRow {
  workspace_id?: string
}

interface OAuthStateRow {
  state: string
  shop: string
  user_id: string
  workspace_id: string | null
  client_id: string | null
  client_secret: string | null
  expires_at: string
  store_name?: string
}

interface StoreRow {
  id: string
}

function hmacSha256(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const hmac = url.searchParams.get('hmac')
  const shop = url.searchParams.get('shop')
  const state = url.searchParams.get('state')

  if (!code || !hmac || !shop || !state) {
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=missing_params`)
  }

  const oauthStateResult = await supabaseAdmin
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .eq('shop', shop)
    .maybeSingle()

  const oauthState = oauthStateResult.data as OAuthStateRow | null

  if (!oauthState || new Date(oauthState.expires_at) < new Date()) {
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=invalid_state`)
  }

  const clientId = oauthState.client_id || process.env.SHOPIFY_CLIENT_ID || ''
  const clientSecret = oauthState.client_secret || process.env.SHOPIFY_CLIENT_SECRET || ''

  // Verify HMAC
  const params = Object.fromEntries(url.searchParams.entries())
  delete params.hmac
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const digest = hmacSha256(clientSecret, message)

  if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac))) {
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=invalid_hmac`)
  }

  // Exchange code for token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })

  const tokenData = (await tokenRes.json()) as ShopifyTokenResponse
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=token_exchange_failed`)
  }

  const accessToken = tokenData.access_token
  const scope = tokenData.scope

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
    logger.error('[shopify/callback]', 'no workspace found for user', { userId: oauthState.user_id })
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=no_workspace`)
  }

  const userId = oauthState.user_id
  const storeName = oauthState.store_name || shop.replace('.myshopify.com', '')

  // 1. Create store
  const { data: store } = await supabaseAdmin
    .from('stores')
    .upsert({ workspace_id: workspaceId, name: storeName }, { onConflict: 'workspace_id,name' })
    .select('id')
    .single()

  const storeId = (store as StoreRow).id

  // 2. Fetch shop metadata for store_currency
  const shopRes = await fetch(`https://${shop}/admin/api/2025-04/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  })
  const shopData = (await shopRes.json()) as ShopifyShopDataResponse
  const storeCurrency = shopData.shop?.currency || null

  const now = new Date()
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(now.getTime() + tokenData.expires_in * 1000).toISOString()
    : null
  const refreshTokenExpiresAt = tokenData.refresh_token_expires_in
    ? new Date(now.getTime() + tokenData.refresh_token_expires_in * 1000).toISOString()
    : null

  // 3. Write credentials to integrations
  const { error: upsertError } = await supabaseAdmin.from('integrations').upsert(
    {
      workspace_id: workspaceId,
      client_id: userId,
      store_id: storeId,
      shopify_domain: shop,
      shopify_access_token: accessToken,
      shopify_client_id: clientId,
      shopify_client_secret: clientSecret,
      shopify_scope: scope,
      shopify_connected_at: new Date().toISOString(),
      store_currency: storeCurrency,
      status: 'connected',
      shopify_refresh_token: tokenData.refresh_token ?? null,
      shopify_token_expires_at: tokenExpiresAt,
      shopify_refresh_token_expires_at: refreshTokenExpiresAt,
    },
    { onConflict: 'workspace_id,store_id' },
  )

  if (upsertError) {
    logger.error('[shopify/callback]', 'integrations upsert failed', { error: upsertError.message })
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=save_failed`)
  }

  // Register webhooks — point to Supabase Edge Function (server-to-server)
  const webhookBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
  const webhookTopics = ['orders/create', 'orders/updated', 'orders/cancelled', 'refunds/create']
  await Promise.all(
    webhookTopics.map((topic) =>
      fetch(`https://${shop}/admin/api/2025-04/webhooks.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
        body: JSON.stringify({
          webhook: {
            topic,
            address: `${webhookBase}/api/webhooks/shopify?store_id=${storeId}&cid=${workspaceId}`,
            format: 'json',
          },
        }),
      }),
    ),
  )

  await supabaseAdmin.from('oauth_states').delete().eq('state', state)

  // Sync last 90 days of orders immediately after connecting
  try {
    const credentials = { domain: shop, accessToken }
    await syncOrders(workspaceId, credentials, userId, { storeId })
  } catch (e: unknown) {
    logger.error('[shopify/callback]', 'Initial sync failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  }

  return NextResponse.redirect(`${appUrl}/settings/workspace/stores?shopify=connected`)
}
