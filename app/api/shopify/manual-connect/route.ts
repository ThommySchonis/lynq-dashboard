import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateBody } from '@/lib/validation'
import { shopifyManualConnectBody } from '@/lib/schemas/shopify'
import { syncOrders } from '@/lib/services/shopify'
import { parseJson } from '@/lib/utils/typed-json'
import { logger } from '@/lib/logger'

interface ShopifyShopResponse {
  shop?: { name?: string; currency?: string }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [body, bErr] = await validateBody(request, shopifyManualConnectBody)
  if (bErr) return bErr

  const shopDomain = body.shop.includes('.myshopify.com')
    ? body.shop.toLowerCase().trim()
    : `${body.shop.toLowerCase().trim()}.myshopify.com`

  // 1. Validate token + extract shop metadata
  const shopRes = await fetch(
    `https://${shopDomain}/admin/api/2025-04/shop.json`,
    { headers: { 'X-Shopify-Access-Token': body.accessToken } }
  )

  if (!shopRes.ok) {
    return NextResponse.json(
      { error: 'Invalid token or store domain. Please check your credentials.' },
      { status: 400 }
    )
  }

  const shopData = await parseJson<ShopifyShopResponse>(shopRes)
  const storeName = shopData.shop?.name || shopDomain.replace('.myshopify.com', '')
  const storeCurrency = shopData.shop?.currency || null

  // 2. Create store record
  const { data: store, error: storeError } = await supabaseAdmin
    .from('stores')
    .upsert(
      { workspace_id: ctx.workspaceId, name: storeName },
      { onConflict: 'workspace_id,name' }
    )
    .select('id')
    .single()

  if (storeError || !store) {
    logger.error('[shopify/manual-connect]', 'store upsert failed', { error: storeError?.message })
    return NextResponse.json({ error: 'Failed to create store record' }, { status: 500 })
  }

  const storeId = store.id

  // 3. Save credentials (replaces legacy client_id-based upsert)
  const { error: upsertError } = await supabaseAdmin
    .from('integrations')
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        client_id: ctx.user.id,
        store_id: storeId,
        shopify_domain: shopDomain,
        shopify_access_token: body.accessToken,
        shopify_connected_at: new Date().toISOString(),
        store_currency: storeCurrency,
        status: 'connected',
      },
      { onConflict: 'workspace_id,store_id' }
    )

  if (upsertError) {
    logger.error('[shopify/manual-connect]', 'integrations upsert failed', { error: upsertError.message })
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 })
  }

  // 4. Register webhooks
  const webhookBase = process.env.NEXT_PUBLIC_APP_URL
  const webhookTopics = ['orders/create', 'orders/updated', 'orders/cancelled', 'refunds/create']
  try {
    await Promise.all(webhookTopics.map(topic =>
      fetch(`https://${shopDomain}/admin/api/2025-04/webhooks.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': body.accessToken },
        body: JSON.stringify({
          webhook: {
            topic,
            address: `${webhookBase}/api/webhooks/shopify?store_id=${storeId}&cid=${ctx.workspaceId}`,
            format: 'json',
          },
        }),
      })
    ))
  } catch (e: unknown) {
    logger.warn('[shopify/manual-connect]', 'Webhook registration failed', { error: e instanceof Error ? e.message : String(e) })
  }

  // 5. Initial order sync (non-blocking)
  try {
    await syncOrders(ctx.workspaceId, { domain: shopDomain, accessToken: body.accessToken }, ctx.user.id, { storeId })
  } catch (e: unknown) {
    logger.error('[shopify/manual-connect]', 'Initial sync failed', { error: e instanceof Error ? e.message : String(e) })
  }

  return NextResponse.json({ success: true, shop: shopDomain, storeName })
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked2 = requireWriteAccess(ctx)
  if (blocked2) return blocked2

  await supabaseAdmin.from('integrations').update({
    shopify_domain: null,
    shopify_access_token: null,
    shopify_connected_at: null,
  }).eq('workspace_id', ctx.workspaceId)
  return NextResponse.json({ success: true })
}
