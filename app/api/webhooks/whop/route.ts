import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyWebhookSignature, type WhopMembership, type WhopPayment } from '@/lib/whop'
import { unlockWorkspace } from '@/lib/services/limit-check'
import { withIdempotency } from '@/lib/services/webhookIdempotency'

interface WorkspaceIdRow {
  workspace_id: string
}

interface IdRow {
  id: string
}

interface PlanIdRow {
  id: string
}

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
  data?:  WhopMembership | WhopPayment | Record<string, unknown>
  [key:  string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getEventType(env: WhopEventEnvelope): string | null {
  return env.event ?? env.type ?? null
}

function isoFromMaybeUnix(value: number | string | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'number') {
    // Whop typically emits unix-seconds. Detect ms by magnitude (> ~31bn = ms).
    const ms = value > 1e12 ? value : value * 1000
    return new Date(ms).toISOString()
  }
  // Already an ISO string or parseable date
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Look up the workspace_subscriptions row this event belongs to. We try:
 *   1. whop_subscription_id match (membership.id)
 *   2. metadata.workspace_id match (set at checkout creation time)
 *
 * Returns null if neither resolves — the caller should log a Sentry
 * warning so we can surface "orphaned membership" cases.
 */
async function _findSubscription({
  membershipId,
  workspaceIdFromMetadata,
}: {
  membershipId?:           string
  workspaceIdFromMetadata?: string
}) {
  if (membershipId) {
    const result = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('whop_subscription_id', membershipId)
      .maybeSingle()
    if (result.data) return result.data as Record<string, unknown>
  }

  if (workspaceIdFromMetadata) {
    const result = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceIdFromMetadata)
      .maybeSingle()
    if (result.data) return result.data as Record<string, unknown>
  }

  return null
}

async function resolveWorkspaceIdFromMembership(membership: WhopMembership): Promise<string | null> {
  // 1. From metadata stamped at checkout-create time
  const fromMeta = (membership.metadata as Record<string, unknown> | undefined)?.workspace_id
  if (typeof fromMeta === 'string') return fromMeta

  // 2. By matching plan_id back to a workspace already on this Whop user.
  // Whop's user_id is the most stable cross-reference; if we've seen the
  // membership.id before (via prior webhook), we can find the subscription.
  if (membership.id) {
    const { data } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('workspace_id')
      .eq('whop_subscription_id', membership.id)
      .maybeSingle()
    if (data) return (data as WorkspaceIdRow).workspace_id
  }

  return null
}

// ─── Event handlers ───────────────────────────────────────────────────

async function handleMembershipActivated(membership: WhopMembership): Promise<void> {
  const workspaceId = await resolveWorkspaceIdFromMembership(membership)
  if (!workspaceId) {
    Sentry.captureMessage('[whop] membership.activated received but no workspace_id resolvable', {
      level: 'warning',
      tags:  { integration: 'whop', event: 'membership.activated' },
      extra: { membership_id: membership.id, user_id: membership.user_id },
    })
    return
  }

  // Map Whop's plan_id back to our internal plan id via the plans table.
  let planId: string | null = null
  if (membership.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('whop_plan_id', membership.plan_id)
      .maybeSingle()
    planId = (plan as PlanIdRow | null)?.id ?? null
  }

  const currentPeriodEnd = isoFromMaybeUnix(membership.current_period_end ?? membership.renewal_period_end)
  const currentPeriodStart = isoFromMaybeUnix(membership.current_period_start ?? membership.renewal_period_start)

  const updates: Record<string, unknown> = {
    status:               'active',
    whop_subscription_id: membership.id,
    whop_customer_id:     membership.user_id ?? null,
    cancel_at_period_end: membership.cancel_at_period_end ?? false,
    canceled_at:          null,
  }
  if (planId)             updates.plan_id              = planId
  if (currentPeriodEnd)   updates.current_period_end   = currentPeriodEnd
  if (currentPeriodStart) updates.current_period_start = currentPeriodStart

  const { error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update(updates)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('[whop webhook] membership.activated DB update failed:', error.message)
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'membership.activated' } })
    throw error
  }

  console.log('[whop webhook] membership.activated:', workspaceId, 'membership=', membership.id, 'plan=', planId)
}

async function handleMembershipDeactivated(membership: WhopMembership): Promise<void> {
  if (!membership.id) return

  const { error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update({
      status:      'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('whop_subscription_id', membership.id)

  if (error) {
    console.error('[whop webhook] membership.deactivated update failed:', error.message)
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'membership.deactivated' } })
    throw error
  }

  console.log('[whop webhook] membership.deactivated:', membership.id)
}

async function handleMembershipCancelAtPeriodEndChanged(membership: WhopMembership): Promise<void> {
  if (!membership.id) return

  const { error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update({
      cancel_at_period_end: membership.cancel_at_period_end ?? false,
    })
    .eq('whop_subscription_id', membership.id)

  if (error) {
    console.error('[whop webhook] cancel_at_period_end_changed update failed:', error.message)
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'membership.cancel_at_period_end_changed' } })
    throw error
  }

  console.log('[whop webhook] cancel_at_period_end_changed:', membership.id, 'cancel=', membership.cancel_at_period_end)
}

async function handlePaymentSucceeded(payment: WhopPayment): Promise<void> {
  const invoiceIdFromMeta = (payment.metadata as Record<string, unknown> | undefined)?.invoice_id
  const amount = typeof payment.amount === 'number' ? payment.amount : 0

  // Strategy: match by metadata.invoice_id first (historical — set by
  // the now-removed chargeOverage flow; preserved for any in-flight
  // payments). For renewal/upgrade payments that Whop bills automatically,
  // fall back to "most recent open invoice for the membership's workspace".
  let invoiceId: string | null = null

  if (typeof invoiceIdFromMeta === 'string') {
    invoiceId = invoiceIdFromMeta
  } else if (payment.membership_id) {
    const { data: sub } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('workspace_id')
      .eq('whop_subscription_id', payment.membership_id)
      .maybeSingle()

    if (sub) {
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('workspace_id', (sub as WorkspaceIdRow).workspace_id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      invoiceId = (invoice as IdRow | null)?.id ?? null
    }
  }

  if (!invoiceId) {
    Sentry.captureMessage('[whop] payment.succeeded with no matchable invoice', {
      level: 'warning',
      tags:  { integration: 'whop', event: 'payment.succeeded' },
      extra: { payment_id: payment.id, membership_id: payment.membership_id, amount },
    })
    return
  }

  const { error } = await supabaseAdmin
    .from('invoices')
    .update({
      status:           'paid',
      paid_at:          new Date().toISOString(),
      amount_paid_eur:  amount,
      amount_due_eur:   0,
      whop_invoice_id:  payment.id,
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('[whop webhook] payment.succeeded update failed:', error.message)
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'payment.succeeded' } })
    throw error
  }

  console.log('[whop webhook] payment.succeeded: invoice=', invoiceId, 'amount=', amount)

  // Model 3 (forced upgrade): a successful subscription payment is the
  // single source of truth for unlocking a workspace + resetting its
  // usage counters. We do this only when a membership_id is present —
  // ad-hoc invoice payments without a membership do not represent a
  // renewal/upgrade event.
  if (payment.membership_id) {
    await unlockAndResetForMembership(payment.membership_id)
  }
}

async function unlockAndResetForMembership(membershipId: string): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('workspace_id')
    .eq('whop_subscription_id', membershipId)
    .maybeSingle()

  const workspaceId = (sub as WorkspaceIdRow | null)?.workspace_id
  if (!workspaceId) {
    Sentry.captureMessage('[whop] payment.succeeded — workspace not found for membership', {
      level: 'warning',
      tags:  { integration: 'whop', event: 'payment.succeeded' },
      extra: { membership_id: membershipId },
    })
    return
  }

  try {
    await unlockWorkspace(workspaceId)
  } catch (err) {
    console.error('[whop webhook] unlockWorkspace failed:', err)
    Sentry.captureException(err, { tags: { integration: 'whop', event: 'payment.succeeded' } })
    // Continue to counter reset — the two are independent.
  }

  // Zero out the latest usage_counters row for this workspace + clear
  // notification timestamps so the 80%/100% emails can fire again next
  // period. We keep the row's period boundaries — Whop's renewal moves
  // current_period_end on workspace_subscriptions, not here.
  const { error: resetErr } = await supabaseAdmin
    .from('usage_counters')
    .update({
      tickets_used:       0,
      tickets_overage:    0,
      ai_suggest_used:    0,
      ai_suggest_overage: 0,
      notified_80_at:     null,
      notified_100_at:    null,
    })
    .eq('workspace_id', workspaceId)

  if (resetErr) {
    console.error('[whop webhook] usage_counters reset failed:', resetErr.message)
    Sentry.captureException(resetErr, { tags: { integration: 'whop', event: 'payment.succeeded' } })
  } else {
    console.log('[whop webhook] payment.succeeded: unlocked + reset counters for workspace=', workspaceId)
  }
}

async function handlePaymentFailed(payment: WhopPayment): Promise<void> {
  const invoiceIdFromMeta = (payment.metadata as Record<string, unknown> | undefined)?.invoice_id
  let invoiceId: string | null = typeof invoiceIdFromMeta === 'string' ? invoiceIdFromMeta : null

  if (!invoiceId && payment.membership_id) {
    const { data: sub } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('workspace_id')
      .eq('whop_subscription_id', payment.membership_id)
      .maybeSingle()

    if (sub) {
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('workspace_id', (sub as WorkspaceIdRow).workspace_id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      invoiceId = (invoice as IdRow | null)?.id ?? null
    }
  }

  if (!invoiceId) {
    Sentry.captureMessage('[whop] payment.failed with no matchable invoice', {
      level: 'warning',
      tags:  { integration: 'whop', event: 'payment.failed' },
      extra: { payment_id: payment.id, membership_id: payment.membership_id },
    })
    return
  }

  const { error } = await supabaseAdmin
    .from('invoices')
    .update({
      status:          'failed',
      whop_invoice_id: payment.id,
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('[whop webhook] payment.failed update failed:', error.message)
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'payment.failed' } })
    throw error
  }

  // TODO: queue payment-failed notification email (PR 2's usage-warnings
  // cron already has the Resend pattern — apply the same here once the
  // template is built).
  Sentry.captureMessage('[whop] payment.failed processed — notification email TODO', {
    level: 'info',
    tags:  { integration: 'whop', event: 'payment.failed' },
    extra: { invoice_id: invoiceId, payment_id: payment.id },
  })

  console.log('[whop webhook] payment.failed: invoice=', invoiceId, 'payment=', payment.id)
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
    console.error('[whop webhook] signature verification failed')
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
      const data = envelope.data ?? envelope
      let resolvedWorkspaceId: string | undefined

      switch (eventType) {
        case 'membership.activated':
          await handleMembershipActivated(data as WhopMembership)
          resolvedWorkspaceId = await resolveWorkspaceIdFromMembership(data as WhopMembership) ?? undefined
          break
        case 'membership.deactivated':
          await handleMembershipDeactivated(data as WhopMembership)
          break
        case 'membership.cancel_at_period_end_changed':
          await handleMembershipCancelAtPeriodEndChanged(data as WhopMembership)
          break
        case 'payment.succeeded':
          await handlePaymentSucceeded(data as WhopPayment)
          break
        case 'payment.failed':
          await handlePaymentFailed(data as WhopPayment)
          break
        default:
          console.log('[whop webhook] unhandled event:', eventType)
          Sentry.captureMessage(`[whop] unhandled event type: ${eventType}`, {
            level: 'info',
            tags: { integration: 'whop', event: eventType },
          })
      }

      return {
        response: NextResponse.json({ received: true, event: eventType }),
        workspaceId: resolvedWorkspaceId,
      }
    },
  })
}
