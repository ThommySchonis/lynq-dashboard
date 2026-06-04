import { Hono } from 'hono'
import { verifyWebhookSignature } from '../lib/whop.ts'
import { logger } from '../lib/logger.ts'
import { withIdempotency } from '../lib/services/webhook-idempotency.ts'
import { handleWhopWebhook } from '../lib/services/webhook-handlers.ts'

// ─── Types ────────────────────────────────────────────────────────────

type WhopEventType =
  | 'membership.activated'
  | 'membership.deactivated'
  | 'membership.cancel_at_period_end_changed'
  | 'payment.succeeded'
  | 'payment.failed'
  | string // tolerate unknowns

interface WhopEventEnvelope {
  event?: WhopEventType
  type?: WhopEventType
  data?: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getEventType(env: WhopEventEnvelope): string | null {
  return env.event ?? env.type ?? null
}

// ─── Routes ───────────────────────────────────────────────────────────

export const webhooksWhopRoutes = new Hono()

webhooksWhopRoutes.post('/', async (c) => {
  const rawBody = await c.req.text()

  const webhookTimestamp = c.req.header('webhook-timestamp') ?? null
  const webhookSignature = c.req.header('webhook-signature') ?? null
  const webhookId = c.req.header('webhook-id') ?? null

  const ok = await verifyWebhookSignature({
    webhookId,
    webhookTimestamp,
    webhookSignature,
    rawBody,
    secret: Deno.env.get('WHOP_WEBHOOK_SECRET'),
  })

  if (!ok) {
    logger.error('[whop]', 'signature verification failed')
    logger.warn('[whop]', 'signature verification failed details', {
      webhookId,
      has_signature: !!webhookSignature,
    })
    return c.json({ error: 'Invalid signature' }, 401)
  }

  let envelope: WhopEventEnvelope
  try {
    envelope = JSON.parse(rawBody) as WhopEventEnvelope
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const eventType = getEventType(envelope)
  if (!eventType) {
    logger.warn('[whop]', 'webhook received without event type', {
      envelope_keys: Object.keys(envelope),
    })
    return c.json({ received: true, unknown_event: true })
  }

  return withIdempotency({
    rawBody,
    request: c.req.raw,
    source: 'whop',
    eventType,
    extractEventId: (req) => req.headers.get('webhook-id'),
    handler: async () => {
      const result = await handleWhopWebhook(eventType, envelope as Record<string, unknown>)
      return {
        response: new Response(JSON.stringify({ received: true, event: eventType }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        workspaceId: result.workspaceId,
      }
    },
  })
})
