import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { syncOrders } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'
import { parseJson } from '@/lib/utils/typed-json'
import { validateQuery } from '@/lib/validation'
import { shopifyCallbackQuery } from '@/lib/schemas/auth'
import { logger } from '@/lib/logger'

interface ShopifyShopDataResponse {
  shop?: { currency?: string }
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


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const [query, queryErr] = validateQuery(request, shopifyCallbackQuery)
  if (queryErr) return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=missing_params`)

  const { code, hmac, shop, state } = query

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

  const params = Object.fromEntries(searchParams.entries())
  delete params.hmac
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const digest = crypto.createHmac('sha256', clientSecret).update(message).digest('hex')

  if (!timingSafeCompare(digest, hmac)) {
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=invalid_hmac`)
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })

  const tokenData = await parseJson<ShopifyTokenResponse>(tokenRes)
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=token_exchange_failed`)
  }

  const accessToken = tokenData.access_token
  const scope = tokenData.scope

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
    logger.error('[shopify/callback]', 'no workspace found for user', { userId: oauthState.user_id })
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=no_workspace`)
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

  const storeId = (store as StoreRow).id

  // 2. Fetch shop metadata for store_currency
  const shopRes = await fetch(`https://${shop}/admin/api/2025-04/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  })
  const shopData = await parseJson<ShopifyShopDataResponse>(shopRes)
  const storeCurrency = shopData.shop?.currency || null

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
    logger.error('[shopify/callback]', 'integrations upsert failed', { error: upsertError.message })
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=save_failed`)
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
    logger.error('[shopify/callback]', 'Initial sync failed', { error: e instanceof Error ? e.message : String(e) })
  }

  return NextResponse.redirect(`${appUrl}/settings/workspace/stores?shopify=connected`)
}
