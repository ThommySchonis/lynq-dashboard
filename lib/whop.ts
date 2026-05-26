import crypto from 'crypto'
import { logger } from '@/lib/logger'
// Whop integration — real v1 API calls (no more stubs).
//
// Base URL: https://api.whop.com/api/v1 (configured via WHOP_API_URL).
// Auth: Authorization: Bearer ${WHOP_API_KEY}
//
// Whop is a checkout-driven platform — there's no "create subscription
// via API" like Stripe. The flow is:
//   1. Client wants to subscribe → we call createCheckoutSession()
//   2. We return a checkout URL → frontend redirects user to Whop
//   3. User pays on Whop's hosted page
//   4. Whop fires `membership.activated` webhook → we set up the
//      workspace_subscriptions row in app/api/webhooks/whop/route.ts
//
// For existing memberships (plan changes, cancel, reactivate), we use
// the membership-level endpoints directly.
//
// Whop's terminology vs ours:
//   - Whop "membership"  ←→ our "subscription" (workspace_subscriptions row)
//   - Whop "user"        ←→ our "customer" (workspace_subscriptions.whop_customer_id)
//   - Whop "plan"        ←→ our "plan" (plans.whop_plan_id)
//   - Whop "payment"     ←→ our "invoice" (invoices row, matched by metadata)

import * as Sentry from '@sentry/nextjs'
import { asciiSafe } from './utils/ascii-safe'

// ─── Configuration ──────────────────────────────────────────────────

const WHOP_API_URL = process.env.WHOP_API_URL ?? 'https://api.whop.com/api/v1'
const WHOP_API_KEY = process.env.WHOP_API_KEY

if (!WHOP_API_KEY) {
  logger.warn('[whop]', 'WHOP_API_KEY not set — all calls will fail')
}

interface WhopErrorPayload {
  error?: { message?: string; code?: string }
}

// ─── Error class ────────────────────────────────────────────────────

export class WhopApiError extends Error {
  status:     number
  whopCode:   string | null
  endpoint:   string
  body:       unknown

  constructor(message: string, opts: { status: number; whopCode?: string | null; endpoint: string; body?: unknown }) {
    super(message)
    this.name     = 'WhopApiError'
    this.status   = opts.status
    this.whopCode = opts.whopCode ?? null
    this.endpoint = opts.endpoint
    this.body     = opts.body
  }
}


// ─── Internal fetch helper ──────────────────────────────────────────

interface WhopFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?:   unknown
  // Idempotency-Key support — Whop honors the Standard idempotency-key
  // pattern for create endpoints (per https://docs.whop.com/).
  idempotencyKey?: string
}

async function whopFetch<T>(path: string, options: WhopFetchOptions = {}): Promise<T> {
  if (!WHOP_API_KEY) {
    throw new WhopApiError('WHOP_API_KEY not configured', { status: 500, endpoint: path })
  }

  const url = `${WHOP_API_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
  const headers: Record<string, string> = {
    'Authorization': asciiSafe(`Bearer ${WHOP_API_KEY}`, 'Authorization', 'whop'),
    'Accept':        'application/json',
  }
  if (options.body) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = asciiSafe(options.idempotencyKey, 'Idempotency-Key', 'whop')
  }

  let response: Response
  try {
    response = await fetch(url, {
      method:  options.method ?? 'GET',
      headers,
      body:    options.body ? JSON.stringify(options.body) : undefined,
      // Whop API generally returns within a few seconds; failing fast
      // beats hanging a checkout flow.
      signal:  AbortSignal.timeout(15_000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    const apiError = new WhopApiError(`Whop API network error: ${msg}`, { status: 0, endpoint: path })
    Sentry.captureException(apiError, { tags: { integration: 'whop', endpoint: path } })
    throw apiError
  }

  let payload: unknown = null
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null)
  } else {
    payload = await response.text().catch(() => null)
  }

  if (!response.ok) {
    const errPayload = payload as WhopErrorPayload | null
    const message  = errPayload?.error?.message ?? `Whop API error ${response.status}`
    const whopCode = errPayload?.error?.code ?? null
    const apiError = new WhopApiError(message, {
      status:   response.status,
      whopCode,
      endpoint: path,
      body:     payload,
    })
    Sentry.captureException(apiError, {
      tags:  { integration: 'whop', endpoint: path, status: String(response.status) },
      extra: { whopCode, body: payload },
    })
    throw apiError
  }

  return payload as T
}

// ─── Types (defensive — Whop's response schemas are tolerated as
// "may include these fields" rather than strict shapes) ────────────

export interface WhopMembership {
  id:                   string
  user_id?:             string
  plan_id?:             string
  product_id?:          string
  status?:              'active' | 'past_due' | 'canceled' | 'paused' | 'trialing' | string
  valid?:               boolean
  cancel_at_period_end?: boolean
  current_period_start?: number | string
  current_period_end?:   number | string
  renewal_period_start?: number | string
  renewal_period_end?:   number | string
  canceled_at?:         number | string | null
  metadata?:            Record<string, unknown>
  [key: string]: unknown
}

export interface WhopCheckoutSession {
  id:           string
  purchase_url: string
  plan_id?:     string
  expires_at?:  number
  metadata?:    Record<string, unknown>
  [key: string]: unknown
}

export interface WhopPayment {
  id:             string
  amount?:        number
  currency?:      string
  status?:        'succeeded' | 'failed' | 'pending' | string
  membership_id?: string
  metadata?:      Record<string, unknown>
  [key: string]: unknown
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Create a hosted Whop checkout session for the given plan.
 *
 * The frontend redirects the user to `purchase_url`. On successful
 * payment, Whop fires `membership.activated` which our webhook
 * handler at /api/webhooks/whop processes to create the
 * workspace_subscriptions row.
 *
 * We pass our workspace_id in metadata so the webhook can identify
 * which workspace this checkout belongs to.
 */
export async function createCheckoutSession({
  whopPlanId,
  workspaceId,
  successUrl,
  metadata,
}: {
  whopPlanId:  string
  workspaceId: string
  successUrl?: string
  metadata?:   Record<string, unknown>
}): Promise<WhopCheckoutSession> {
  const session = await whopFetch<WhopCheckoutSession>('/checkout_configurations', {
    method: 'POST',
    body: {
      // mode: 'payment' triggers an immediate charge for the plan.
      // ('setup' is for Setup-Intent flows that collect a payment
      // method without charging — not our case.)
      mode:         'payment',
      plan_id:      whopPlanId,
      // Whop calls this `redirect_url` on the wire; we keep
      // `successUrl` as the internal arg name for readability.
      redirect_url: successUrl,
      metadata: {
        workspace_id: workspaceId,
        ...(metadata ?? {}),
      },
    },
    idempotencyKey: `checkout-${workspaceId}-${whopPlanId}-${Date.now()}`,
  })

  return session
}

/**
 * Update an existing membership (plan change).
 * Real Whop endpoint: PATCH /memberships/{id}
 */
export async function updateMembership({
  membershipId,
  newPlanId,
}: {
  membershipId: string
  newPlanId:    string
}): Promise<WhopMembership> {
  return await whopFetch<WhopMembership>(`/memberships/${membershipId}`, {
    method: 'PATCH',
    body:   { plan_id: newPlanId },
  })
}

/**
 * Schedule a cancellation at the end of the current period.
 * Real Whop endpoint: POST /memberships/{id}/cancel
 *
 * Whop semantics: this is a "soft cancel" — keeps access until
 * current_period_end. The membership.cancel_at_period_end_changed
 * webhook fires; our handler flips cancel_at_period_end=true.
 */
export async function cancelMembership({
  membershipId,
}: {
  membershipId: string
}): Promise<WhopMembership> {
  return await whopFetch<WhopMembership>(`/memberships/${membershipId}/cancel`, {
    method: 'POST',
  })
}

/**
 * Reverse a pending cancellation.
 * Real Whop endpoint: POST /memberships/{id}/uncancel
 */
export async function uncancelMembership({
  membershipId,
}: {
  membershipId: string
}): Promise<WhopMembership> {
  return await whopFetch<WhopMembership>(`/memberships/${membershipId}/uncancel`, {
    method: 'POST',
  })
}

/**
 * Retrieve a single membership by id.
 * Real Whop endpoint: GET /memberships/{id}
 */
export async function retrieveMembership({
  membershipId,
}: {
  membershipId: string
}): Promise<WhopMembership> {
  return await whopFetch<WhopMembership>(`/memberships/${membershipId}`, { method: 'GET' })
}

// chargeOverage removed in Model 3 (forced upgrade) — see docs/billing-model.md.
// Overage charging is replaced by hard-cap + upgrade prompt. Whop renewal
// payments are processed by the payment.succeeded webhook handler, which
// also clears workspace_subscriptions.write_locked.

// ─── Legacy stub signatures — kept for backwards compatibility ──────

interface BillingInfoShape {
  billing_email?:     string | null
  organization_name?: string | null
}

/**
 * @deprecated Whop is checkout-driven — users are created by Whop on
 * checkout completion, not via an API call from us. Use
 * createCheckoutSession() instead.
 */
export async function createCustomer(_input: {
  workspaceId: string
  workspaceName: string
  billingInfo?: BillingInfoShape | null
}): Promise<never> {
  throw new WhopApiError(
    'createCustomer is not supported in the checkout-driven model. Use createCheckoutSession() and let the webhook handler create the customer record on membership.activated.',
    { status: 501, endpoint: 'createCustomer (deprecated)' },
  )
}

/**
 * @deprecated Use createCheckoutSession() for first-time subscriptions
 * and updateMembership() for plan changes on existing memberships.
 */
export async function createSubscription(_input: {
  customerId: string
  planId: string
  paymentMethodId?: string | null
}): Promise<never> {
  throw new WhopApiError(
    'createSubscription is not supported. Use createCheckoutSession() for new subscriptions or updateMembership() for plan changes.',
    { status: 501, endpoint: 'createSubscription (deprecated)' },
  )
}

/**
 * Plan-change passthrough. Existing callers in lib/services/billing.ts
 * already use this name; we route it to updateMembership() so the
 * service layer doesn't need a rewrite.
 */
export async function updateSubscription({
  subscriptionId,
  newPlanId,
}: {
  subscriptionId: string
  newPlanId: string
  prorate?: boolean   // ignored — Whop handles proration server-side
}): Promise<WhopMembership> {
  return await updateMembership({ membershipId: subscriptionId, newPlanId })
}

/**
 * Cancel passthrough. Whop's cancel is always at-period-end ("soft");
 * immediate cancellation isn't directly exposed by the v1 API. If
 * atPeriodEnd=false is requested, we still call the soft cancel — log
 * a warning so the caller knows the immediate-cancel semantics weren't
 * honored.
 */
export async function cancelSubscription({
  subscriptionId,
  atPeriodEnd = true,
}: {
  subscriptionId: string
  atPeriodEnd?: boolean
}): Promise<WhopMembership> {
  if (!atPeriodEnd) {
    logger.warn('[whop]', 'cancelSubscription called with atPeriodEnd=false — Whop only supports period-end cancellation, falling back to soft cancel')
  }
  return await cancelMembership({ membershipId: subscriptionId })
}

/**
 * Reactivate passthrough.
 */
export async function reactivateSubscription({
  subscriptionId,
}: {
  subscriptionId: string
}): Promise<WhopMembership> {
  return await uncancelMembership({ membershipId: subscriptionId })
}

/**
 * @deprecated Payment methods are managed entirely by Whop's hosted
 * checkout. There's no API to add/remove cards from our side.
 */
export async function createPaymentMethod(_input: {
  customerId: string
  type: 'card' | 'sepa' | 'paypal'
  token: string
}): Promise<never> {
  throw new WhopApiError(
    'Payment methods are managed via Whop\'s hosted checkout. Direct the user to update their payment method in the Whop customer portal.',
    { status: 501, endpoint: 'createPaymentMethod (deprecated)' },
  )
}

/**
 * @deprecated Same as createPaymentMethod — managed by Whop.
 */
export async function deletePaymentMethod(_input: {
  paymentMethodId: string
}): Promise<never> {
  throw new WhopApiError(
    'Payment methods are managed via Whop\'s hosted checkout.',
    { status: 501, endpoint: 'deletePaymentMethod (deprecated)' },
  )
}

// ─── Webhook signature verification (Standard Webhooks spec) ────────

/**
 * Verify a Whop webhook signature per the Standard Webhooks spec
 * (same as svix / Resend / Whop).
 *
 * Headers expected:
 *   webhook-id:        unique event identifier (also our idempotency key)
 *   webhook-timestamp: unix-seconds string
 *   webhook-signature: "v1,<base64-hmac-sha256>" (may contain multiple
 *                      signatures space-separated for rotation; we
 *                      accept any matching one)
 *
 * Signed content: `${id}.${timestamp}.${rawBody}`
 * Secret: base64-decoded WHOP_WEBHOOK_SECRET (prefix `whsec_` stripped
 *         if present, matching the inbound-email webhook pattern)
 */
export function verifyWebhookSignature({
  webhookId,
  webhookTimestamp,
  webhookSignature,
  rawBody,
  secret,
}: {
  webhookId:        string | null
  webhookTimestamp: string | null
  webhookSignature: string | null
  rawBody:          string
  secret:           string | undefined
}): boolean {
  if (!secret || !webhookId || !webhookTimestamp || !webhookSignature) return false

  // Strip `whsec_` prefix and base64-decode the secret (Standard Webhooks
  // convention). If decode fails, fall back to raw bytes — older
  // dashboards sometimes give a plain string.
  const secretCore = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(secretCore, 'base64')
    if (secretBytes.length === 0) secretBytes = Buffer.from(secretCore, 'utf8')
  } catch {
    secretBytes = Buffer.from(secretCore, 'utf8')
  }

  // crypto imported at top level

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const expected      = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  // Header may contain multiple "v<n>,<base64sig>" tokens space-separated
  return webhookSignature
    .split(' ')
    .some(token => {
      const trimmed   = token.trim()
      const sigPart   = trimmed.replace(/^v\d+,/, '')
      if (sigPart.length !== expected.length) return false
      try {
        return crypto.timingSafeEqual(Buffer.from(sigPart), Buffer.from(expected))
      } catch {
        return false
      }
    })
}
