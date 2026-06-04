import { Hono } from 'hono'
import { logger } from '../lib/logger.ts'
import {
  verifyHmacAgainstAppSecret,
  logComplianceWebhook,
  resolveWorkspaceForShop,
  processCustomersDataRequest,
  processCustomersRedact,
  processShopRedact,
  markWorkerFailed,
  type CustomersDataRequestPayload,
  type CustomersRedactPayload,
  type ShopRedactPayload,
} from '../lib/services/shopify-compliance.ts'

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const webhooksShopifyComplianceRoutes = new Hono()

// ─── customers/data_request ───────────────────────────────────────────

webhooksShopifyComplianceRoutes.post('/customers-data-request', async (c) => {
  const rawBody = await c.req.text()
  const hmacHeader = c.req.header('x-shopify-hmac-sha256') ?? null
  const shopifyWebhookId = c.req.header('x-shopify-webhook-id') ?? null

  const { ok, secretUsed } = await verifyHmacAgainstAppSecret(rawBody, hmacHeader)
  if (!ok) {
    return c.json({ error: 'Invalid HMAC' }, 401)
  }

  let payload: CustomersDataRequestPayload
  try {
    payload = JSON.parse(rawBody) as CustomersDataRequestPayload
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { workspaceId } = await resolveWorkspaceForShop(payload.shop_domain)

  let logResult: Awaited<ReturnType<typeof logComplianceWebhook>>
  try {
    logResult = await logComplianceWebhook({
      topic: 'customers/data_request',
      shopDomain: payload.shop_domain,
      shopifyShopId: payload.shop_id ?? null,
      shopifyCustomerId: payload.customer?.id ?? null,
      customerEmail: payload.customer?.email ?? null,
      workspaceId,
      hmacOk: true,
      hmacSecretUsed: secretUsed,
      payload,
      shopifyWebhookId,
    })
  } catch (err: unknown) {
    logger.error(
      '[webhook/shopify/compliance/customers-data-request]',
      'log insert failed',
      { error: err instanceof Error ? err.message : String(err) },
    )
    return c.json({ error: 'Log insert failed' }, 500)
  }

  if ('duplicate' in logResult) {
    return c.json({ ok: true, duplicate: true })
  }

  // Fire-and-forget worker. Don't await; respond 200 immediately.
  void processCustomersDataRequest(logResult.row).catch((err) =>
    markWorkerFailed(logResult.row.id, err)
  )

  return c.json({ ok: true })
})

// ─── customers/redact ─────────────────────────────────────────────────

webhooksShopifyComplianceRoutes.post('/customers-redact', async (c) => {
  const rawBody = await c.req.text()
  const hmacHeader = c.req.header('x-shopify-hmac-sha256') ?? null
  const shopifyWebhookId = c.req.header('x-shopify-webhook-id') ?? null

  const { ok, secretUsed } = await verifyHmacAgainstAppSecret(rawBody, hmacHeader)
  if (!ok) {
    return c.json({ error: 'Invalid HMAC' }, 401)
  }

  let payload: CustomersRedactPayload
  try {
    payload = JSON.parse(rawBody) as CustomersRedactPayload
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { workspaceId } = await resolveWorkspaceForShop(payload.shop_domain)

  let logResult: Awaited<ReturnType<typeof logComplianceWebhook>>
  try {
    logResult = await logComplianceWebhook({
      topic: 'customers/redact',
      shopDomain: payload.shop_domain,
      shopifyShopId: payload.shop_id ?? null,
      shopifyCustomerId: payload.customer?.id ?? null,
      customerEmail: payload.customer?.email ?? null,
      workspaceId,
      hmacOk: true,
      hmacSecretUsed: secretUsed,
      payload,
      shopifyWebhookId,
    })
  } catch (err: unknown) {
    logger.error(
      '[webhook/shopify/compliance/customers-redact]',
      'log insert failed',
      { error: err instanceof Error ? err.message : String(err) },
    )
    return c.json({ error: 'Log insert failed' }, 500)
  }

  if ('duplicate' in logResult) {
    return c.json({ ok: true, duplicate: true })
  }

  void processCustomersRedact(logResult.row).catch((err) =>
    markWorkerFailed(logResult.row.id, err)
  )

  return c.json({ ok: true })
})

// ─── shop/redact ──────────────────────────────────────────────────────

webhooksShopifyComplianceRoutes.post('/shop-redact', async (c) => {
  const rawBody = await c.req.text()
  const hmacHeader = c.req.header('x-shopify-hmac-sha256') ?? null
  const shopifyWebhookId = c.req.header('x-shopify-webhook-id') ?? null

  const { ok, secretUsed } = await verifyHmacAgainstAppSecret(rawBody, hmacHeader)
  if (!ok) {
    return c.json({ error: 'Invalid HMAC' }, 401)
  }

  let payload: ShopRedactPayload
  try {
    payload = JSON.parse(rawBody) as ShopRedactPayload
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  // workspaceId may be null here — the integration row may already have been
  // deleted by the merchant 48 hours before this webhook fires. That's fine;
  // shop/redact worker handles the null case.
  const { workspaceId } = await resolveWorkspaceForShop(payload.shop_domain)

  let logResult: Awaited<ReturnType<typeof logComplianceWebhook>>
  try {
    logResult = await logComplianceWebhook({
      topic: 'shop/redact',
      shopDomain: payload.shop_domain,
      shopifyShopId: payload.shop_id ?? null,
      shopifyCustomerId: null,
      customerEmail: null,
      workspaceId,
      hmacOk: true,
      hmacSecretUsed: secretUsed,
      payload,
      shopifyWebhookId,
    })
  } catch (err: unknown) {
    logger.error(
      '[webhook/shopify/compliance/shop-redact]',
      'log insert failed',
      { error: err instanceof Error ? err.message : String(err) },
    )
    return c.json({ error: 'Log insert failed' }, 500)
  }

  if ('duplicate' in logResult) {
    return c.json({ ok: true, duplicate: true })
  }

  void processShopRedact(logResult.row).catch((err) =>
    markWorkerFailed(logResult.row.id, err)
  )

  return c.json({ ok: true })
})
