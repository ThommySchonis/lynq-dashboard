import { Hono } from 'hono'
import { getAdminClient } from '../lib/supabase.ts'
import { logger } from '../lib/logger.ts'
import {
  normalizeStatus,
  resolveLocalSubscriptionState,
  deriveUsagePeriod,
  notifyAdminUnmappedPlan,
} from '../lib/services/shopify-billing.ts'

// verify_jwt is disabled for this route — Shopify hits it server-to-server
// and authenticates via HMAC, not Supabase Auth.

interface AppSubscriptionUpdatePayload {
  app_subscription?: {
    admin_graphql_api_id?: string
    name?: string
    plan_handle?: string
    status?: string
    trial_days?: number
    current_period_end?: string | null
    created_at?: string
  }
}

export async function verifyHmac(rawBody: string, hmacHeader: string | null, secret: string): Promise<boolean> {
  if (!hmacHeader) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)))
  const computed = btoa(String.fromCharCode(...sig))
  // Constant-time comparison.
  if (computed.length !== hmacHeader.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hmacHeader.charCodeAt(i)
  return diff === 0
}

async function checkIdempotency(eventId: string | null, topic: string, shop: string | null): Promise<boolean> {
  if (!eventId) return true // accept, but cannot dedupe
  const sb = getAdminClient()
  const { error } = await sb
    .from('shopify_webhook_events')
    .insert({ event_id: eventId, topic, shop_domain: shop })
  if (error && error.code === '23505') return false // duplicate primary key — already processed
  return true
}

export const webhooksShopifyBillingRoutes = new Hono()

webhooksShopifyBillingRoutes.post('/app-subscriptions-update', async (c) => {
  const rawBody = await c.req.text()
  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET') ?? ''
  const hmac = c.req.header('x-shopify-hmac-sha256') ?? null
  const eventId = c.req.header('x-shopify-webhook-id') ?? null
  const shopDomain = c.req.header('x-shopify-shop-domain') ?? null

  if (!(await verifyHmac(rawBody, hmac, secret))) {
    logger.warn('[shopify-billing]', 'HMAC verification failed', { eventId, shopDomain })
    return c.json({ error: 'Invalid signature' }, 401)
  }
  if (!(await checkIdempotency(eventId, 'app_subscriptions/update', shopDomain))) {
    return c.json({ received: true, deduped: true })
  }

  let payload: AppSubscriptionUpdatePayload
  try { payload = JSON.parse(rawBody) } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const sub = payload.app_subscription
  if (!sub || !sub.admin_graphql_api_id || !shopDomain) {
    logger.warn('[shopify-billing]', 'incomplete payload', { keys: Object.keys(payload) })
    return c.json({ received: true, skipped: 'incomplete_payload' })
  }

  const sb = getAdminClient()
  const { data: integration } = await sb
    .from('integrations')
    .select('workspace_id')
    .eq('shopify_domain', shopDomain)
    .eq('is_billing_store', true)
    .maybeSingle()
  const workspaceId = (integration as { workspace_id: string } | null)?.workspace_id
  if (!workspaceId) {
    logger.warn('[shopify-billing]', 'no billing-store integration found', { shopDomain })
    return c.json({ received: true, skipped: 'no_billing_store' })
  }

  const handle = sub.plan_handle ?? null
  let planId: string | null = null
  if (handle) {
    const { data: plan } = await sb.from('plans').select('id').eq('shopify_handle', handle).maybeSingle()
    planId = (plan as { id: string } | null)?.id ?? null
  }
  const planFound = planId !== null

  const { status: localStatus, planUnmapped } = resolveLocalSubscriptionState(sub.status ?? 'PENDING', planFound)
  const chargeStatus = normalizeStatus(sub.status ?? null)
  if (planUnmapped) {
    await notifyAdminUnmappedPlan(workspaceId, handle ?? '(none)', shopDomain)
  }

  const trialEndsAt = sub.trial_days && sub.created_at
    ? new Date(new Date(sub.created_at).getTime() + sub.trial_days * 86_400_000).toISOString()
    : null
  const period = sub.current_period_end ? deriveUsagePeriod(sub.current_period_end) : null

  const { error: upsertError } = await sb.from('workspace_subscriptions').upsert(
    {
      workspace_id: workspaceId,
      plan_id: planId,
      plan_unmapped: planUnmapped,
      status: localStatus,
      shopify_charge_id: sub.admin_graphql_api_id,
      shopify_charge_status: chargeStatus,
      shopify_billing_shop_domain: shopDomain,
      shopify_trial_ends_at: trialEndsAt,
      shopify_current_period_end: sub.current_period_end ?? null,
      ...(period ? { current_period_start: period.period_start, current_period_end: period.period_end } : {}),
    },
    { onConflict: 'workspace_id' },
  )
  if (upsertError) {
    logger.error('[shopify-billing]', 'subscription upsert failed', { workspaceId, error: upsertError.message })
    return c.json({ error: 'persist_failed' }, 500)
  }

  return c.json({ received: true, event: 'app_subscriptions/update' })
})

webhooksShopifyBillingRoutes.post('/app-uninstalled', async (c) => {
  const rawBody = await c.req.text()
  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET') ?? ''
  const hmac = c.req.header('x-shopify-hmac-sha256') ?? null
  const eventId = c.req.header('x-shopify-webhook-id') ?? null
  const shopDomain = c.req.header('x-shopify-shop-domain') ?? null

  if (!(await verifyHmac(rawBody, hmac, secret))) {
    return c.json({ error: 'Invalid signature' }, 401)
  }
  if (!(await checkIdempotency(eventId, 'app/uninstalled', shopDomain))) {
    return c.json({ received: true, deduped: true })
  }
  if (!shopDomain) return c.json({ received: true, skipped: 'no_shop' })

  const sb = getAdminClient()
  const { data: integration } = await sb
    .from('integrations')
    .select('id, workspace_id, is_billing_store')
    .eq('shopify_domain', shopDomain)
    .maybeSingle()
  const intRow = integration as { id: string; workspace_id: string; is_billing_store: boolean } | null
  if (!intRow) return c.json({ received: true, skipped: 'no_integration' })

  await sb.from('integrations').update({
    shopify_access_token: null,
    status: 'uninstalled',
  }).eq('id', intRow.id)

  if (intRow.is_billing_store) {
    await sb.from('workspace_subscriptions').update({
      status: 'canceled',
      shopify_charge_status: 'cancelled',
    }).eq('workspace_id', intRow.workspace_id)
  }

  return c.json({ received: true, event: 'app/uninstalled' })
})
