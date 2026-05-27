import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'
import { validateQuery } from '@/lib/validation'
import { shopifyWebhookQuery } from '@/lib/schemas/webhooks'
import { withIdempotency } from '@/lib/services/webhookIdempotency'
import { handleShopifyWebhook } from '@/lib/services/webhookHandlers'

interface IntegrationRow {
  client_id: string
  workspace_id: string
  shopify_client_secret: string
  shopify_domain: string
}

interface IntegrationByStoreRow {
  shopify_client_secret: string
  workspace_id: string
}

function timingSafeCompare(a: string, b: string): boolean {
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
async function resolveIntegration(cid: string): Promise<IntegrationRow | null> {
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


export async function POST(request: NextRequest) {
  const [query, queryErr] = validateQuery(request, shopifyWebhookQuery)
  if (queryErr) return queryErr
  const cid = query.cid ?? null
  const storeId = query.store_id ?? null

  if (!cid && !storeId) return NextResponse.json({ ok: true })

  const rawBody = await request.text()
  const hmac    = request.headers.get('x-shopify-hmac-sha256')
  const topic   = request.headers.get('x-shopify-topic')

  let clientSecret: string | undefined
  let workspaceId: string | undefined
  let clientId: string | undefined
  let shopifyDomain: string | undefined

  // When store_id is present, resolve credentials from the integrations table
  if (storeId) {
    const { data } = await supabaseAdmin
      .from('integrations')
      .select('shopify_client_secret, workspace_id')
      .eq('store_id', storeId)
      .single()

    if (!data?.shopify_client_secret) {
      return new Response('Store not found', { status: 404 })
    }

    clientSecret = (data as IntegrationByStoreRow).shopify_client_secret
    workspaceId = (data as IntegrationByStoreRow).workspace_id
  }

  // Fall back to the existing cid-based integration lookup when store_id
  // didn't resolve or wasn't provided
  let integration: IntegrationRow | null = null
  if (!clientSecret && cid) {
    integration = await resolveIntegration(cid)
    if (integration) {
      clientSecret = integration.shopify_client_secret
      workspaceId = integration.workspace_id
      clientId = integration.client_id
      shopifyDomain = integration.shopify_domain
    }
  }

  if (!clientSecret || !hmac) {
    return NextResponse.json({ error: 'Webhook verification unavailable' }, { status: 401 })
  }

  const shopDomain = request.headers.get('x-shopify-shop-domain')
  if (shopDomain && shopifyDomain && shopDomain !== shopifyDomain) {
    return NextResponse.json({ error: 'Shop mismatch' }, { status: 401 })
  }

  const digest = crypto
    .createHmac('sha256', clientSecret)
    .update(rawBody, 'utf8')
    .digest('base64')
  if (!timingSafeCompare(digest, hmac)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // workspaceId is guaranteed non-empty at this point (we returned 401 above if
  // neither store nor integration resolved)
  const resolvedWorkspaceId = workspaceId as string
  const resolvedClientId = clientId || ''

  return withIdempotency({
    rawBody,
    request,
    source: 'shopify',
    eventType: topic || 'unknown',
    extractEventId: (req) => req.headers.get('x-shopify-webhook-id'),
    workspaceId: resolvedWorkspaceId,
    handler: async (body) => {
      const payload = body as Record<string, unknown>
      const result = await handleShopifyWebhook(
        topic || 'unknown',
        payload,
        resolvedWorkspaceId,
        storeId,
        resolvedClientId
      )
      return {
        response: NextResponse.json({ ok: true }),
        workspaceId: result.workspaceId,
      }
    },
  })
}
