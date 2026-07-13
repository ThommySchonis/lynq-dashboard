import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { syncOrders } from '@/lib/services/shopify'
import { shopifyGraphQL } from '@/lib/services/shopify-graphql'
import { pickPrimaryMembership } from '@/lib/pick-membership'
import {
  findUserIdByEmail,
  provisionInstallIdentity,
  createInstallSessionLink,
} from '@/lib/services/shopify-install'

interface ShopifyTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  scope?: string
}

interface ShopifyShopQueryResponse {
  shop: { currencyCode: string | null; email: string | null; name: string | null }
}

interface WorkspaceMemberRow {
  id: string
  workspace_id: string
  role: string
  joined_at: string
}

interface OAuthStateRow {
  state: string
  shop: string
  user_id: string | null
  workspace_id: string | null
  client_id: string | null
  client_secret: string | null
  expires_at: string
  store_name?: string
}

interface StoreRow {
  id: string
}

interface WebhookSubscriptionCreateResponse {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string } | null
    userErrors: Array<{ field: string[] | null; message: string }>
  }
}

// GraphQL topic enum values verified against
// https://shopify.dev/docs/api/admin-graphql/latest/enums/WebhookSubscriptionTopic
const WEBHOOK_TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED', 'REFUNDS_CREATE'] as const

// `uri` is the current (non-deprecated) callback field on WebhookSubscriptionInput —
// https://shopify.dev/docs/api/admin-graphql/latest/input-objects/WebhookSubscriptionInput
const WEBHOOK_SUBSCRIPTION_CREATE_MUTATION = `
  mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id }
      userErrors { field message }
    }
  }
`

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
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, expiring: '1' }),
  })

  const tokenData = (await tokenRes.json()) as ShopifyTokenResponse
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=token_exchange_failed`)
  }

  const accessToken = tokenData.access_token
  const scope = tokenData.scope

  // An install (App Store) has no pre-existing user; the state row carries a
  // null user_id. A manual-add is initiated by an already-authenticated user.
  const stateUserId = oauthState.user_id
  const isInstall = stateUserId == null

  let workspaceId: string | null = null
  let userId: string | null = stateUserId
  let sessionEmail: string | null = null

  // Fetch shop metadata once (currency + owner email/name for install provisioning).
  let shopData: ShopifyShopQueryResponse
  try {
    shopData = await shopifyGraphQL<ShopifyShopQueryResponse>(
      { domain: shop, accessToken },
      'query { shop { currencyCode email name } }',
    )
  } catch (e: unknown) {
    logger.error('[shopify/callback]', 'shop query failed', {
      shop,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.redirect(
      isInstall
        ? `${appUrl}/login?error=install_failed`
        : `${appUrl}/settings/workspace/stores?error=shop_query_failed`,
    )
  }
  const storeCurrency = shopData.shop.currencyCode || null

  if (isInstall) {
    const email = shopData.shop.email
    const shopName = shopData.shop.name || shop.replace('.myshopify.com', '')
    if (!email) {
      logger.error('[shopify/callback]', 'install: no shop email', { shop })
      return NextResponse.redirect(`${appUrl}/login?error=install_no_email`)
    }
    // Resolve a pre-existing user for this email (idempotent installs / reinstalls).
    try {
      const existingUserId = await findUserIdByEmail(email)
      const identity = await provisionInstallIdentity({ email, shopName, existingUserId })
      userId = identity.userId
      workspaceId = identity.workspaceId
      sessionEmail = email
    } catch (e: unknown) {
      logger.error('[shopify/callback]', 'install: identity provisioning failed', {
        shop,
        error: e instanceof Error ? e.message : String(e),
      })
      return NextResponse.redirect(`${appUrl}/login?error=install_failed`)
    }
  } else {
    // Manual-add: isInstall is false, so stateUserId is the authenticated user.
    userId = stateUserId
    workspaceId = oauthState.workspace_id as string | null
    if (!workspaceId) {
      // Fallback when the stored state has no workspace: pick the user's primary
      // membership deterministically (same rule as getAuthContext). A user may
      // belong to more than one workspace, so `.maybeSingle()` is unsafe here.
      const { data: memberships } = await supabaseAdmin
        .from('workspace_members')
        .select('id, workspace_id, role, joined_at')
        .eq('user_id', userId)
      workspaceId = pickPrimaryMembership((memberships ?? []) as WorkspaceMemberRow[])?.workspace_id ?? null
    }
    if (!workspaceId) {
      logger.error('[shopify/callback]', 'no workspace found for user', { userId })
      return NextResponse.redirect(`${appUrl}/settings/workspace/stores?error=no_workspace`)
    }
  }

  const storeName = oauthState.store_name || shop.replace('.myshopify.com', '')

  // 1. Create store
  const { data: store } = await supabaseAdmin
    .from('stores')
    .upsert({ workspace_id: workspaceId, name: storeName }, { onConflict: 'workspace_id,name' })
    .select('id')
    .single()

  const storeId = (store as StoreRow).id

  const now = new Date()
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(now.getTime() + tokenData.expires_in * 1000).toISOString()
    : null
  const refreshTokenExpiresAt = tokenData.refresh_token_expires_in
    ? new Date(now.getTime() + tokenData.refresh_token_expires_in * 1000).toISOString()
    : null

  // 2. Write credentials to integrations
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

  // Determine whether this is the workspace's first connected store. If so,
  // mark it as the billing store and create a pending subscription row.
  const { data: existingBillingStore } = await supabaseAdmin
    .from('integrations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('is_billing_store', true)
    .maybeSingle()

  let isFirstStore = false
  if (!existingBillingStore) {
    isFirstStore = true
    await supabaseAdmin
      .from('integrations')
      .update({ is_billing_store: true })
      .eq('workspace_id', workspaceId)
      .eq('shopify_domain', shop)

    // Ensure a workspace_subscriptions row exists in pending state.
    const { data: existingSub } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!existingSub) {
      await supabaseAdmin.from('workspace_subscriptions').insert({
        workspace_id: workspaceId,
        status: 'pending_shopify_subscription',
        shopify_billing_shop_domain: shop,
      })
    } else {
      await supabaseAdmin
        .from('workspace_subscriptions')
        .update({ shopify_billing_shop_domain: shop })
        .eq('workspace_id', workspaceId)
    }
  }

  // Register webhooks — point to Supabase Edge Function (server-to-server).
  // Fire-and-forget per topic: a registration failure is logged but must
  // never abort the install/connect flow (matches prior REST behavior).
  const webhookBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
  const webhookCallbackUrl = `${webhookBase}/api/webhooks/shopify?store_id=${storeId}&cid=${workspaceId}`
  await Promise.all(
    WEBHOOK_TOPICS.map(async (topic) => {
      try {
        const result = await shopifyGraphQL<WebhookSubscriptionCreateResponse>(
          { domain: shop, accessToken },
          WEBHOOK_SUBSCRIPTION_CREATE_MUTATION,
          { topic, webhookSubscription: { uri: webhookCallbackUrl, format: 'JSON' } },
        )
        const userErrors = result.webhookSubscriptionCreate.userErrors
        if (userErrors.length) {
          logger.error('[shopify/callback]', 'webhook subscription userErrors', { topic, userErrors })
        }
      } catch (e: unknown) {
        logger.error('[shopify/callback]', 'webhook subscription failed', {
          topic,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }),
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

  const handle = process.env.SHOPIFY_APP_HANDLE
  const nextPath = isFirstStore && handle
    ? `/auth/shopify-complete?next=${encodeURIComponent(`https://${shop}/admin/charges/${handle}/pricing_plans`)}`
    : `/auth/shopify-complete?next=${encodeURIComponent(`${appUrl}/home`)}`

  if (isInstall && sessionEmail) {
    // Install: hand the browser a session via the magic-link, then continue
    // to the pricing page (first store) or the dashboard.
    try {
      const link = await createInstallSessionLink({
        email: sessionEmail,
        redirectTo: `${appUrl}${nextPath}`,
      })
      return NextResponse.redirect(link)
    } catch (e: unknown) {
      logger.error('[shopify/callback]', 'install: session link generation failed', {
        shop,
        error: e instanceof Error ? e.message : String(e),
      })
      return NextResponse.redirect(`${appUrl}/login?error=install_failed`)
    }
  }

  // Manual-add (already authenticated): behave exactly as before.
  if (isFirstStore && handle) {
    return NextResponse.redirect(`https://${shop}/admin/charges/${handle}/pricing_plans`)
  }
  return NextResponse.redirect(`${appUrl}/settings/workspace/stores?shopify=connected`)
}
