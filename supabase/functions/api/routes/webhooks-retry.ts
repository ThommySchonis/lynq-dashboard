import { Hono } from 'hono'
import { logger } from '../lib/logger.ts'
import {
  handleEmailWebhook,
  handleShopifyWebhook,
  handleWhopWebhook,
  handleParcelPanelWebhook,
} from '../lib/services/webhook-handlers.ts'

interface RetryRequest {
  event_type: string
  payload: Record<string, unknown>
  workspace_id: string | null
  metadata: Record<string, unknown> | null
}

function verifyRetrySecret(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const secret = c.req.header('x-retry-secret')
  const expected = Deno.env.get('WEBHOOK_RETRY_SECRET')
  if (!secret || !expected || secret !== expected) return false
  return true
}

export const webhooksRetryRoutes = new Hono()

// ─── Email retry ──────────────────────────────────────────────────────

webhooksRetryRoutes.post('/email', async (c) => {
  if (!verifyRetrySecret(c)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = (await c.req.json()) as RetryRequest

  try {
    await handleEmailWebhook(body.payload)
    return c.json({ ok: true })
  } catch (err) {
    logger.error('[webhook-retry/email]', 'handler failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Handler failed' }, 500)
  }
})

// ─── ParcelPanel retry ────────────────────────────────────────────────

webhooksRetryRoutes.post('/parcelpanel', async (c) => {
  if (!verifyRetrySecret(c)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = (await c.req.json()) as RetryRequest

  try {
    await handleParcelPanelWebhook(
      body.payload,
      body.workspace_id || '',
      (body.metadata?.storeId as string) || '',
    )
    return c.json({ ok: true })
  } catch (err) {
    logger.error('[webhook-retry/parcelpanel]', 'handler failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Handler failed' }, 500)
  }
})

// ─── Shopify retry ────────────────────────────────────────────────────

webhooksRetryRoutes.post('/shopify', async (c) => {
  if (!verifyRetrySecret(c)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = (await c.req.json()) as RetryRequest

  try {
    await handleShopifyWebhook(
      body.event_type,
      body.payload,
      body.workspace_id || '',
      (body.metadata?.storeId as string) || null,
      (body.metadata?.clientId as string) || '',
    )
    return c.json({ ok: true })
  } catch (err) {
    logger.error('[webhook-retry/shopify]', 'handler failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Handler failed' }, 500)
  }
})

// ─── Whop retry ───────────────────────────────────────────────────────

webhooksRetryRoutes.post('/whop', async (c) => {
  if (!verifyRetrySecret(c)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = (await c.req.json()) as RetryRequest

  try {
    await handleWhopWebhook(body.event_type, body.payload)
    return c.json({ ok: true })
  } catch (err) {
    logger.error('[webhook-retry/whop]', 'handler failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Handler failed' }, 500)
  }
})
