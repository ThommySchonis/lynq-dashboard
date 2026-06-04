import { Hono } from 'hono'
import { getAdminClient } from '../lib/supabase.ts'
import { logger } from '../lib/logger.ts'
import { withIdempotency } from '../lib/services/webhook-idempotency.ts'
import { handleShopifyWebhook } from '../lib/services/webhook-handlers.ts'

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

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function hmacSha256Base64(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const bytes = new Uint8Array(sig)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

/**
 * Resolve the integration row from the ?cid= URL parameter. As of Block C
 * Phase 3 Batch 5, ?cid is the workspace_id; pre-migration subscriptions
 * passed client_id. Try workspace_id first, then fall back to client_id.
 */
async function resolveIntegration(cid: string): Promise<IntegrationRow | null> {
  const sb = getAdminClient()

  const { data: byWorkspace } = await sb
    .from('integrations')
    .select('client_id, workspace_id, shopify_client_secret, shopify_domain')
    .eq('workspace_id', cid)
    .maybeSingle()
  if (byWorkspace) return byWorkspace as unknown as IntegrationRow

  const { data: byClient } = await sb
    .from('integrations')
    .select('client_id, workspace_id, shopify_client_secret, shopify_domain')
    .eq('client_id', cid)
    .maybeSingle()
  return (byClient as unknown as IntegrationRow) || null
}

export const webhooksShopifyRoutes = new Hono()

webhooksShopifyRoutes.post('/', async (c) => {
  const sb = getAdminClient()
  const url = new URL(c.req.url)
  const cid = url.searchParams.get('cid')
  const storeId = url.searchParams.get('store_id')

  if (!cid && !storeId) return c.json({ ok: true })

  const rawBody = await c.req.text()
  const hmac = c.req.header('x-shopify-hmac-sha256') ?? null
  const topic = c.req.header('x-shopify-topic') ?? null

  let clientSecret: string | undefined
  let workspaceId: string | undefined
  let clientId: string | undefined
  let shopifyDomain: string | undefined

  // When store_id is present, resolve credentials from the integrations table
  if (storeId) {
    const { data } = await sb
      .from('integrations')
      .select('shopify_client_secret, workspace_id')
      .eq('store_id', storeId)
      .single()

    if (!data?.shopify_client_secret) {
      return new Response('Store not found', { status: 404 })
    }

    clientSecret = (data as unknown as IntegrationByStoreRow).shopify_client_secret
    workspaceId = (data as unknown as IntegrationByStoreRow).workspace_id
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
    return c.json({ error: 'Webhook verification unavailable' }, 401)
  }

  const shopDomain = c.req.header('x-shopify-shop-domain') ?? null
  if (shopDomain && shopifyDomain && shopDomain !== shopifyDomain) {
    return c.json({ error: 'Shop mismatch' }, 401)
  }

  const digest = await hmacSha256Base64(clientSecret, rawBody)
  if (!constantTimeEqual(digest, hmac)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // workspaceId is guaranteed non-empty at this point (we returned 401 above if
  // neither store nor integration resolved)
  const resolvedWorkspaceId = workspaceId as string
  const resolvedClientId = clientId || ''

  return withIdempotency({
    rawBody,
    request: c.req.raw,
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
        resolvedClientId,
      )
      return {
        response: new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        workspaceId: result.workspaceId,
      }
    },
  })
})
