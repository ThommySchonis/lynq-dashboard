// Whop payment-processor stub layer.
//
// Whop integration is intentionally last in the billing rollout —
// build the data model + UI against this stub, then swap the bodies
// (not the signatures) when Whop credentials land.
//
// Every function:
//   - Logs a clear "[WHOP STUB]" line so it's grep-able in Vercel logs
//   - Returns a shape that matches Whop's expected response
//   - Generates IDs prefixed with "whop_stub_" so they're identifiable
//     as fake when they later coexist with real Whop IDs during the
//     cutover
//
// Replacement plan (separate sprint):
//   1. Add WHOP_API_KEY env var
//   2. Replace each function body with a real fetch call against the
//      Whop API. Keep the signatures + return shapes identical.
//   3. Drop the "_stub" prefix on the generated IDs.
//   4. Real Whop webhook (already exists at app/api/whop/webhook/route.ts)
//      starts firing — its handler reads the same workspace_subscriptions
//      table the stub flow already populates.

import crypto from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────

export interface BillingInfoShape {
  billing_email?:     string | null
  organization_name?: string | null
}

export interface WhopCustomer {
  id:         string
  email:      string | null
  name:       string | null
  metadata:   Record<string, unknown>
  created_at: string
}

export interface WhopSubscription {
  id:                    string
  customer_id:           string
  plan_id:               string
  status:                'active' | 'past_due' | 'canceled' | 'paused'
  current_period_start:  string
  current_period_end:    string
  cancel_at_period_end:  boolean
}

export interface WhopSubscriptionUpdate {
  id:                    string
  plan_id:               string
  status:                'active' | 'past_due' | 'canceled' | 'paused'
  proration_amount_eur:  number | null
  effective_at:          string  // ISO timestamp or 'period_end'
}

export interface WhopSubscriptionCancel {
  id:                   string
  status:               'active' | 'canceled'
  cancel_at_period_end: boolean
  canceled_at:          string | null
}

export interface WhopCharge {
  id:           string
  subscription: string
  amount_eur:   number
  description:  string
  status:       'pending' | 'paid' | 'failed'
  created_at:   string
}

export interface WhopPaymentMethod {
  id:         string
  customer:   string
  type:       'card' | 'sepa' | 'paypal'
  last_four:  string | null
  brand:      string | null
  is_default: boolean
}

// ─── Internal helpers ────────────────────────────────────────────────

function stubId(prefix: string): string {
  return `whop_stub_${prefix}_${crypto.randomBytes(8).toString('hex')}`
}

function logStub(fn: string, payload: unknown): void {
  console.log(`[WHOP STUB] ${fn} called with`, JSON.stringify(payload))
}

// ─── Public API — matches the future Whop SDK shape ──────────────────

/**
 * Create a Whop customer record for a workspace.
 * Real Whop endpoint: POST /v5/customers
 */
export async function createCustomer({
  workspaceId,
  workspaceName,
  billingInfo,
}: {
  workspaceId: string
  workspaceName: string
  billingInfo?: BillingInfoShape | null
}): Promise<WhopCustomer> {
  logStub('createCustomer', { workspaceId, workspaceName, email: billingInfo?.billing_email })
  return {
    id:          stubId('cust'),
    email:       billingInfo?.billing_email ?? null,
    name:        billingInfo?.organization_name ?? workspaceName,
    metadata:    { workspace_id: workspaceId },
    created_at:  new Date().toISOString(),
  }
}

/**
 * Create a subscription for a customer on a given plan.
 * Real Whop endpoint: POST /v5/subscriptions
 */
export async function createSubscription({
  customerId,
  planId,
  paymentMethodId,
}: {
  customerId: string
  planId: string
  paymentMethodId?: string | null
}): Promise<WhopSubscription> {
  logStub('createSubscription', { customerId, planId, paymentMethodId })
  const now = Date.now()
  const periodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString()
  return {
    id:                    stubId('sub'),
    customer_id:           customerId,
    plan_id:               planId,
    status:                'active',
    current_period_start:  new Date(now).toISOString(),
    current_period_end:    periodEnd,
    cancel_at_period_end:  false,
  }
}

/**
 * Update an existing subscription (e.g., plan change).
 * `prorate: true` → bill the prorated diff immediately for the rest
 * of the current period; `false` → switch at period end.
 * Real Whop endpoint: PATCH /v5/subscriptions/{id}
 */
export async function updateSubscription({
  subscriptionId,
  newPlanId,
  prorate = true,
}: {
  subscriptionId: string
  newPlanId: string
  prorate?: boolean
}): Promise<WhopSubscriptionUpdate> {
  logStub('updateSubscription', { subscriptionId, newPlanId, prorate })
  return {
    id:                   subscriptionId,
    plan_id:              newPlanId,
    status:               'active',
    proration_amount_eur: prorate ? 0 : null,
    effective_at:         prorate ? new Date().toISOString() : 'period_end',
  }
}

/**
 * Cancel a subscription.
 * `atPeriodEnd: true` → grace-cancel (keeps access until period_end).
 * `atPeriodEnd: false` → immediate cancel + refund prorated remainder.
 * Real Whop endpoint: DELETE /v5/subscriptions/{id}
 */
export async function cancelSubscription({
  subscriptionId,
  atPeriodEnd = true,
}: {
  subscriptionId: string
  atPeriodEnd?: boolean
}): Promise<WhopSubscriptionCancel> {
  logStub('cancelSubscription', { subscriptionId, atPeriodEnd })
  return {
    id:                   subscriptionId,
    status:               atPeriodEnd ? 'active' : 'canceled',
    cancel_at_period_end: atPeriodEnd,
    canceled_at:          atPeriodEnd ? null : new Date().toISOString(),
  }
}

/**
 * Reactivate a previously-canceled subscription (only valid before
 * the period_end if atPeriodEnd was true).
 * Real Whop endpoint: POST /v5/subscriptions/{id}/reactivate
 */
export async function reactivateSubscription({
  subscriptionId,
}: {
  subscriptionId: string
}): Promise<WhopSubscriptionCancel> {
  logStub('reactivateSubscription', { subscriptionId })
  return {
    id:                   subscriptionId,
    status:               'active',
    cancel_at_period_end: false,
    canceled_at:          null,
  }
}

/**
 * Charge an overage line item against a subscription. Will appear on
 * the next regular invoice as a separate line.
 * Real Whop endpoint: POST /v5/subscriptions/{id}/charges
 */
export async function chargeOverage({
  subscriptionId,
  amountEur,
  description,
}: {
  subscriptionId: string
  amountEur: number
  description: string
}): Promise<WhopCharge> {
  logStub('chargeOverage', { subscriptionId, amountEur, description })
  return {
    id:           stubId('charge'),
    subscription: subscriptionId,
    amount_eur:   amountEur,
    description,
    status:       'pending',
    created_at:   new Date().toISOString(),
  }
}

/**
 * Attach a new payment method to a customer.
 * Real Whop endpoint: POST /v5/customers/{id}/payment_methods
 */
export async function createPaymentMethod({
  customerId,
  type,
  token,
}: {
  customerId: string
  type: 'card' | 'sepa' | 'paypal'
  token: string
}): Promise<WhopPaymentMethod> {
  logStub('createPaymentMethod', { customerId, type, token: '<redacted>' })
  return {
    id:         stubId('pm'),
    customer:   customerId,
    type,
    last_four:  type === 'card' ? '0001' : null,
    brand:      type === 'card' ? 'mastercard' : null,
    is_default: true,
  }
}

/**
 * Remove a payment method.
 * Real Whop endpoint: DELETE /v5/payment_methods/{id}
 */
export async function deletePaymentMethod({
  paymentMethodId,
}: {
  paymentMethodId: string
}): Promise<{ id: string; deleted: true }> {
  logStub('deletePaymentMethod', { paymentMethodId })
  return { id: paymentMethodId, deleted: true }
}
