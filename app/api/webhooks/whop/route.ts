import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { verifyWebhookSignature } from '@/lib/whop'
import { withIdempotency } from '@/lib/services/webhookIdempotency'
import { logger } from '@/lib/logger'
import { handleWhopWebhook } from '@/lib/services/webhookHandlers'

// ─── Whop webhook handler ─────────────────────────────────────────────
//
// Receives Standard Webhooks-spec signed events from Whop and applies
// them to workspace_subscriptions / invoices. Idempotent via the
// withIdempotency middleware — duplicate webhook-id deliveries are a
// no-op return-200.
//
// Five events handled:
//   - membership.activated                      → status='active', stamp IDs
//   - membership.deactivated                    → status='canceled'
//   - membership.cancel_at_period_end_changed   → toggle cancel_at_period_end
//   - payment.succeeded                         → mark invoice paid
//   - payment.failed                            → mark invoice failed
//
// Unknown event types are logged + 200'd (Whop's webhook console
// expects 2xx for "received OK"; we don't want unrelated events
// triggering retries).
//
// Bypass: /api/webhooks/* is already in proxy.ts's AUTH_BYPASS_PREFIXES,
// so no auth gate fires. Signature verification is THE security boundary
// for this route — without WHOP_WEBHOOK_SECRET it returns 500, not 200.
// ──────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────

type WhopEventType =
  | 'membership.activated'
  | 'membership.deactivated'
  | 'membership.cancel_at_period_end_changed'
  | 'payment.succeeded'
  | 'payment.failed'
  | string  // tolerate unknowns

interface WhopEventEnvelope {
  // Whop's envelope shape isn't perfectly documented; we accept both
  // `event` (Standard Webhooks convention) and `type` (alternate naming).
  event?: WhopEventType
  type?:  WhopEventType
  data?:  Record<string, unknown>
  [key:  string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getEventType(env: WhopEventEnvelope): string | null {
  return env.event ?? env.type ?? null
}

// ─── Main handler ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const webhookTimestamp = request.headers.get('webhook-timestamp')
  const webhookSignature = request.headers.get('webhook-signature')
  const webhookId        = request.headers.get('webhook-id')

  const ok = verifyWebhookSignature({
    webhookId,
    webhookTimestamp,
    webhookSignature,
    rawBody,
    secret: process.env.WHOP_WEBHOOK_SECRET,
  })

  if (!ok) {
    logger.error('[whop]', 'signature verification failed')
    Sentry.captureMessage('[whop] signature verification failed', {
      level: 'warning',
      tags:  { integration: 'whop' },
      extra: { webhookId, has_signature: !!webhookSignature },
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let envelope: WhopEventEnvelope
  try {
    envelope = JSON.parse(rawBody) as WhopEventEnvelope
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = getEventType(envelope)
  if (!eventType) {
    Sentry.captureMessage('[whop] webhook received without event type', {
      level: 'warning',
      tags:  { integration: 'whop' },
      extra: { envelope_keys: Object.keys(envelope) },
    })
    return NextResponse.json({ received: true, unknown_event: true })
  }

  return withIdempotency({
    rawBody,
    request,
    source: 'whop',
    eventType: eventType,
    extractEventId: (req) => req.headers.get('webhook-id'),
    handler: async () => {
      const result = await handleWhopWebhook(eventType, envelope as Record<string, unknown>)
      return {
        response: NextResponse.json({ received: true, event: eventType }),
        workspaceId: result.workspaceId,
      }
    },
  })
}
