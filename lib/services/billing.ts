// lib/services/billing.ts
//
// Service layer for the billing system. API routes are thin wrappers
// around these functions — they accept workspaceId + params and return
// data or throw. No NextRequest / NextResponse here.
//
// All writes go through supabaseAdmin (RLS bypass). Callers must have
// already verified the user can act on the workspace via getAuthContext.

import { supabaseAdmin } from '../supabaseAdmin'
import * as whop from '../whop'
import { isEUCountry, isValidVATFormat } from '../billing/issuer'
import type {
  Plan,
  WorkspaceSubscription,
  UsageCounter,
  Invoice,
  BillingInfo,
  PaymentMethod,
  SubscriptionAddon,
  SubscriptionResponse,
  UsageResponse,
  UpdateBillingInfoInput,
  WorkspaceAddonStatus,
} from '@/types/billing'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ─── Internal row shapes (avoids inline `as { … }` assertions) ──────

interface PaymentMethodRef {
  id: string
  whop_payment_method_id: string | null
}

interface WorkspaceAddonRow {
  addon_id: string
  status: WorkspaceAddonStatus
}

// ─── Error class for service-layer failures ──────────────────────────

export class BillingServiceError extends Error {
  code:       string
  statusCode: number
  constructor(message: string, code: string, statusCode = 400) {
    super(message)
    this.name       = 'BillingServiceError'
    this.code       = code
    this.statusCode = statusCode
  }
}

// ─── Subscription / usage ────────────────────────────────────────────

export async function getSubscription(workspaceId: string): Promise<WorkspaceSubscription | null> {
  const result = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (result.error) {
    console.error('[billing.getSubscription] failed:', result.error.message)
    return null
  }
  return result.data as WorkspaceSubscription | null
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const result = await supabaseAdmin
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()

  if (result.error) {
    console.error('[billing.getPlan] failed:', result.error.message)
    return null
  }
  return result.data as Plan | null
}

export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[billing.listPlans] failed:', error.message)
    return []
  }
  return (data as Plan[]) || []
}

/**
 * Ensures a usage_counters row exists for the current subscription
 * period. Race-safe via the (workspace_id, period_start) UNIQUE index.
 */
async function ensureCurrentPeriod(
  workspaceId: string,
  sub: WorkspaceSubscription,
): Promise<UsageCounter | null> {
  const existingResult = await supabaseAdmin
    .from('usage_counters')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('period_start', sub.current_period_start)
    .maybeSingle()

  if (existingResult.data) return existingResult.data as UsageCounter

  const createResult = await supabaseAdmin
    .from('usage_counters')
    .insert({
      workspace_id: workspaceId,
      period_start: sub.current_period_start,
      period_end:   sub.current_period_end,
    })
    .select('*')
    .single()

  if (createResult.error) {
    if (createResult.error.code === '23505') {
      const refetchResult = await supabaseAdmin
        .from('usage_counters')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('period_start', sub.current_period_start)
        .single()
      return refetchResult.data as UsageCounter | null
    }
    console.error('[billing.ensureCurrentPeriod] insert failed:', createResult.error.message)
    return null
  }
  return createResult.data as UsageCounter
}

/**
 * Composite read returning subscription + plan + current usage with
 * percentages + limit-state flags. Drives the entire Usage & Plans tab.
 */
export async function getSubscriptionWithUsage(workspaceId: string): Promise<SubscriptionResponse> {
  const sub = await getSubscription(workspaceId)
  if (!sub) {
    return {
      subscription:        null,
      plan:                null,
      usage:               null,
      percentages:         { tickets: 0, ai_suggest: 0 },
      limits:              { tickets_reached: false, ai_suggest_reached: false, tickets_at_80: false, ai_suggest_at_80: false },
      trial_days_remaining: null,
    }
  }

  const [plan, usage] = await Promise.all([
    getPlan(sub.plan_id),
    ensureCurrentPeriod(workspaceId, sub),
  ])

  const ticketLimit = plan?.ticket_limit ?? null
  const aiLimit     = plan?.ai_suggest_limit ?? null
  const ticketsUsed = usage?.tickets_used    ?? 0
  const aiUsed      = usage?.ai_suggest_used ?? 0

  const ticketsPct = ticketLimit ? Math.min(100, Math.round((ticketsUsed / ticketLimit) * 100)) : 0
  const aiPct      = aiLimit     ? Math.min(100, Math.round((aiUsed      / aiLimit)     * 100)) : 0

  const trialDays = sub.trial_ends_at && sub.status === 'trial'
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / MS_PER_DAY))
    : null

  return {
    subscription: sub,
    plan,
    usage,
    percentages: { tickets: ticketsPct, ai_suggest: aiPct },
    limits: {
      tickets_reached:    ticketLimit ? ticketsUsed >= ticketLimit         : false,
      ai_suggest_reached: aiLimit     ? aiUsed      >= aiLimit             : false,
      tickets_at_80:      ticketLimit ? ticketsUsed >= ticketLimit * 0.8   : false,
      ai_suggest_at_80:   aiLimit     ? aiUsed      >= aiLimit     * 0.8   : false,
    },
    trial_days_remaining: trialDays,
  }
}

export async function getUsageBreakdown(workspaceId: string): Promise<UsageResponse | null> {
  const sub = await getSubscription(workspaceId)
  if (!sub) return null

  const [plan, usage] = await Promise.all([
    getPlan(sub.plan_id),
    ensureCurrentPeriod(workspaceId, sub),
  ])
  if (!usage) return null

  const ticketLimit = plan?.ticket_limit ?? null
  const aiLimit     = plan?.ai_suggest_limit ?? null

  const ticketsPct = ticketLimit ? Math.min(100, Math.round((usage.tickets_used    / ticketLimit) * 100)) : 0
  const aiPct      = aiLimit     ? Math.min(100, Math.round((usage.ai_suggest_used / aiLimit)     * 100)) : 0

  return {
    period_start:        usage.period_start,
    period_end:          usage.period_end,
    tickets_used:        usage.tickets_used,
    tickets_limit:       ticketLimit,
    tickets_overage:     usage.tickets_overage,
    ai_suggest_used:     usage.ai_suggest_used,
    ai_suggest_limit:    aiLimit,
    ai_suggest_overage:  usage.ai_suggest_overage,
    ai_resolutions_used: usage.ai_resolutions_used,
    percentages:         { tickets: ticketsPct, ai_suggest: aiPct },
  }
}

// ─── Plan change / cancel / reactivate ───────────────────────────────

/**
 * Change the workspace's plan. Two flows depending on whether the
 * workspace already has a Whop membership:
 *
 *   1. Existing membership (sub.whop_subscription_id set)
 *      → PATCH /memberships/{id} on Whop, then update our DB row.
 *      → Returns { mode: 'updated', subscription }.
 *
 *   2. No Whop membership yet (trial → first paid plan, or upgrade
 *      after cancellation)
 *      → Create a hosted checkout session, return its URL.
 *      → DB row is NOT updated; the `membership.activated` webhook
 *        will populate whop_subscription_id, whop_customer_id, and
 *        flip status to 'active' once payment completes.
 *      → Returns { mode: 'checkout', checkout_url }.
 *
 * Edge cases:
 *   - Custom plans (Elite) require contacting sales; cannot self-change to
 *   - Same-plan change with an active membership is a no-op
 */
export type ChangePlanOutcome =
  | { mode: 'updated';  subscription: WorkspaceSubscription }
  | { mode: 'checkout'; checkout_url: string }

export async function changePlan(
  workspaceId: string,
  planId: string,
  options: { successUrl?: string } = {},
): Promise<ChangePlanOutcome> {
  const sub = await getSubscription(workspaceId)
  if (!sub) throw new BillingServiceError('No subscription for this workspace', 'no_subscription', 404)

  const targetPlan = await getPlan(planId)
  if (!targetPlan)           throw new BillingServiceError('Unknown plan',                            'unknown_plan',              400)
  if (!targetPlan.is_active) throw new BillingServiceError('Plan is not active',                     'inactive_plan',             400)
  if (targetPlan.is_custom)  throw new BillingServiceError('Custom plans require contact with sales','custom_plan_contact_sales', 400)
  if (!targetPlan.whop_plan_id) {
    throw new BillingServiceError(
      'Plan is missing a Whop plan ID — contact support',
      'plan_not_provisioned',
      500,
    )
  }

  // Path 1 — existing membership → in-place plan change via Whop API
  if (sub.whop_subscription_id) {
    if (sub.plan_id === planId) {
      return { mode: 'updated', subscription: sub }  // no-op
    }
    await whop.updateMembership({
      membershipId: sub.whop_subscription_id,
      newPlanId:    targetPlan.whop_plan_id,
    })

    const updateResult = await supabaseAdmin
      .from('workspace_subscriptions')
      .update({ plan_id: planId })
      .eq('id', sub.id)
      .select('*')
      .single()

    if (updateResult.error) {
      console.error('[billing.changePlan] DB update failed:', updateResult.error.message)
      throw new BillingServiceError(updateResult.error.message, 'update_failed', 500)
    }
    return { mode: 'updated', subscription: updateResult.data as WorkspaceSubscription }
  }

  // Path 2 — no membership yet → start a checkout. Webhook completes.
  const session = await whop.createCheckoutSession({
    whopPlanId:  targetPlan.whop_plan_id,
    workspaceId,
    successUrl:  options.successUrl,
    metadata:    { target_plan_id: planId },
  })

  if (!session.purchase_url) {
    throw new BillingServiceError(
      'Whop returned no purchase URL — checkout could not be started',
      'checkout_url_missing',
      500,
    )
  }

  return { mode: 'checkout', checkout_url: session.purchase_url }
}

export async function cancelSubscription(workspaceId: string, atPeriodEnd = true): Promise<WorkspaceSubscription> {
  const sub = await getSubscription(workspaceId)
  if (!sub) throw new BillingServiceError('No subscription', 'no_subscription', 404)
  if (sub.status === 'canceled') return sub

  if (sub.whop_subscription_id) {
    await whop.cancelSubscription({
      subscriptionId: sub.whop_subscription_id,
      atPeriodEnd,
    })
  }

  const updates = atPeriodEnd
    ? { cancel_at_period_end: true }
    : { status: 'canceled' as const, cancel_at_period_end: false, canceled_at: new Date().toISOString() }

  const cancelResult = await supabaseAdmin
    .from('workspace_subscriptions')
    .update(updates)
    .eq('id', sub.id)
    .select('*')
    .single()

  if (cancelResult.error) throw new BillingServiceError(cancelResult.error.message, 'update_failed', 500)
  return cancelResult.data as WorkspaceSubscription
}

export async function reactivateSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
  const sub = await getSubscription(workspaceId)
  if (!sub) throw new BillingServiceError('No subscription', 'no_subscription', 404)
  if (!sub.cancel_at_period_end && sub.status !== 'canceled') {
    return sub  // already active, no-op
  }

  if (sub.whop_subscription_id) {
    await whop.reactivateSubscription({ subscriptionId: sub.whop_subscription_id })
  }

  const reactivateResult = await supabaseAdmin
    .from('workspace_subscriptions')
    .update({
      status:               'active',
      cancel_at_period_end: false,
      canceled_at:          null,
    })
    .eq('id', sub.id)
    .select('*')
    .single()

  if (reactivateResult.error) throw new BillingServiceError(reactivateResult.error.message, 'update_failed', 500)
  return reactivateResult.data as WorkspaceSubscription
}

// ─── Billing info ────────────────────────────────────────────────────

export async function getBillingInfo(workspaceId: string): Promise<BillingInfo | null> {
  const infoResult = await supabaseAdmin
    .from('billing_info')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (infoResult.error) {
    console.error('[billing.getBillingInfo] failed:', infoResult.error.message)
    return null
  }
  return infoResult.data as BillingInfo | null
}

/**
 * Country-dependent validation:
 *   - EU customer: organization_name + vat_number both required
 *   - US customer: state required
 *   - Rest-of-world: only organization_name required (plus core address fields)
 */
export async function updateBillingInfo(workspaceId: string, input: UpdateBillingInfoInput): Promise<BillingInfo> {
  const existing = await getBillingInfo(workspaceId)
  const merged = { ...existing, ...input } as UpdateBillingInfoInput

  // Required fields
  if (!merged.billing_email?.trim())     throw new BillingServiceError('Billing email is required',   'billing_email_required',   400)
  if (!merged.organization_name?.trim()) throw new BillingServiceError('Organization name is required', 'organization_name_required', 400)
  if (!merged.address_line1?.trim())     throw new BillingServiceError('Address line 1 is required',   'address_line1_required',   400)
  if (!merged.city?.trim())              throw new BillingServiceError('City is required',             'city_required',            400)
  if (!merged.postal_code?.trim())       throw new BillingServiceError('Postal code is required',      'postal_code_required',     400)
  if (!merged.country?.trim())           throw new BillingServiceError('Country is required',          'country_required',         400)

  const country = merged.country!.toUpperCase()

  if (isEUCountry(country) && !merged.vat_number?.trim()) {
    throw new BillingServiceError('VAT number is required for EU customers (B2B reverse-charge)', 'vat_required_eu', 400)
  }
  if (country === 'US' && !merged.state?.trim()) {
    throw new BillingServiceError('State is required for US customers', 'state_required_us', 400)
  }
  if (merged.vat_number && !isValidVATFormat(merged.vat_number)) {
    throw new BillingServiceError('VAT number format is invalid (expected 2-letter country code + 8-12 alphanumerics)', 'vat_invalid_format', 400)
  }

  const row = {
    workspace_id:      workspaceId,
    billing_email:     merged.billing_email!,
    organization_name: merged.organization_name!,
    phone_number:      merged.phone_number ?? null,
    address_line1:     merged.address_line1!,
    address_line2:     merged.address_line2 ?? null,
    city:              merged.city!,
    postal_code:       merged.postal_code!,
    country,
    state:             merged.state ?? null,
    vat_number:        merged.vat_number?.trim() ?? null,
  }

  const upsertResult = await supabaseAdmin
    .from('billing_info')
    .upsert(row, { onConflict: 'workspace_id' })
    .select('*')
    .single()

  if (upsertResult.error) throw new BillingServiceError(upsertResult.error.message, 'upsert_failed', 500)
  return upsertResult.data as BillingInfo
}

// ─── Invoices ────────────────────────────────────────────────────────

export async function listInvoices(workspaceId: string, page = 0, perPage = 25): Promise<{ invoices: Invoice[]; total: number }> {
  const from = page * perPage
  const to   = from + perPage - 1

  const { data, error, count } = await supabaseAdmin
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new BillingServiceError(error.message, 'query_failed', 500)
  return {
    invoices: (data as Invoice[]) || [],
    total:    count ?? 0,
  }
}

export async function getInvoice(workspaceId: string, invoiceId: string): Promise<Invoice | null> {
  const invoiceResult = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (invoiceResult.error) {
    console.error('[billing.getInvoice] failed:', invoiceResult.error.message)
    return null
  }
  return invoiceResult.data as Invoice | null
}

// ─── Payment methods ─────────────────────────────────────────────────

export async function listPaymentMethods(workspaceId: string): Promise<PaymentMethod[]> {
  const { data, error } = await supabaseAdmin
    .from('payment_methods')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new BillingServiceError(error.message, 'query_failed', 500)
  return (data as PaymentMethod[]) || []
}

export async function deletePaymentMethod(workspaceId: string, methodId: string): Promise<void> {
  // Confirm the method belongs to this workspace before deleting
  const methodResult = await supabaseAdmin
    .from('payment_methods')
    .select('id, whop_payment_method_id')
    .eq('id', methodId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const method = methodResult.data as PaymentMethodRef | null
  if (!method) throw new BillingServiceError('Payment method not found', 'not_found', 404)

  if (method.whop_payment_method_id) {
    await whop.deletePaymentMethod({ paymentMethodId: method.whop_payment_method_id })
  }

  const { error } = await supabaseAdmin
    .from('payment_methods')
    .delete()
    .eq('id', methodId)
    .eq('workspace_id', workspaceId)

  if (error) throw new BillingServiceError(error.message, 'delete_failed', 500)
}

// ─── Addons ──────────────────────────────────────────────────────────

export async function listAddons(workspaceId: string): Promise<SubscriptionAddon[]> {
  const [{ data: catalog }, { data: workspaceAddons }] = await Promise.all([
    supabaseAdmin
      .from('subscription_addons')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('workspace_addons')
      .select('addon_id, status')
      .eq('workspace_id', workspaceId),
  ])

  const wsStatusById: Record<string, WorkspaceAddonStatus> = Object.fromEntries(
    ((workspaceAddons as WorkspaceAddonRow[]) ?? [])
      .map(w => [w.addon_id, w.status])
  )

  return ((catalog as SubscriptionAddon[]) || []).map(addon => ({
    ...addon,
    workspace_status: wsStatusById[addon.id] ?? 'inactive',
  }))
}

// ─── Ticket counting — recordOutboundMessage ─────────────────────────
//
// Called from the inbox reply path on every outbound message.
// Determines whether this outbound is the first one on a conversation
// that should count toward billable usage, and updates the counter row
// accordingly.
//
// Rules (mirrors spec § "Counter increment timing"):
//
//   1. Outbound on a spam conversation → never counts.
//
//   2. Outbound on a conversation whose `counted_in_usage_period` is
//      NULL → count this period (increment tickets_used or
//      tickets_overage), set the conversation's counted_in_usage_period
//      + billable_event_at + last_outbound_at.
//
//   3. Outbound on a conversation already marked as counted (any
//      prior period) → no count. Just bump last_outbound_at.
//
// The 10-day reactivation rule lives in processInboundMessage(): when
// a customer replies to a closed conversation after >10 days, the
// inbound handler creates a NEW conversation row. That row has
// counted_in_usage_period=NULL by definition, so the next outbound
// naturally counts via rule (2) above. No special "count again in
// new period" branch is needed.

interface ConversationBillingRow {
  id: string
  workspace_id: string
  status: string
  is_spam: boolean
  counted_in_usage_period: string | null
}

interface RecordOutboundResult {
  counted: boolean
  overage: boolean
  reason:  'first_outbound' | 'continuation' | 'spam' | 'no_subscription' | 'conversation_not_found'
}

export async function recordOutboundMessage(
  workspaceId: string,
  conversationId: string,
): Promise<RecordOutboundResult> {
  // 1. Fetch the conversation
  const { data: conv, error: convError } = await supabaseAdmin
    .from('email_conversations')
    .select('id, workspace_id, status, is_spam, counted_in_usage_period')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .maybeSingle<ConversationBillingRow>()

  if (convError) console.error('[recordOutboundMessage] fetch failed:', convError.message)

  if (!conv) {
    return { counted: false, overage: false, reason: 'conversation_not_found' }
  }

  const nowIso = new Date().toISOString()

  // 2. Spam exclusion — don't count, but still stamp last_outbound_at
  if (conv.is_spam) {
    await supabaseAdmin
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'spam' }
  }

  // 3. Already counted in some prior period → continuation
  if (conv.counted_in_usage_period) {
    await supabaseAdmin
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'continuation' }
  }

  // 4. First outbound — count this period
  const sub = await getSubscription(workspaceId)
  if (!sub) {
    // Defensive: still set last_outbound_at so reactivation rule works
    await supabaseAdmin
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'no_subscription' }
  }

  const counter = await ensureCurrentPeriod(workspaceId, sub)
  if (!counter) {
    await supabaseAdmin
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'no_subscription' }
  }

  // Pull plan limit to decide tickets_used vs tickets_overage bucket
  const plan = await getPlan(sub.plan_id)
  const ticketLimit = plan?.ticket_limit ?? null
  const isOverage = ticketLimit != null && counter.tickets_used >= ticketLimit

  // Update counter — atomic via single UPDATE
  const counterUpdates = isOverage
    ? { tickets_overage: counter.tickets_overage + 1 }
    : { tickets_used:    counter.tickets_used    + 1 }

  const { error: counterError } = await supabaseAdmin
    .from('usage_counters')
    .update(counterUpdates)
    .eq('id', counter.id)

  if (counterError) {
    console.error('[recordOutboundMessage] counter update failed:', counterError.message)
    // Don't claim we counted if the increment failed
    await supabaseAdmin
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'no_subscription' }
  }

  // Mark the conversation as counted
  await supabaseAdmin
    .from('email_conversations')
    .update({
      counted_in_usage_period: counter.id,
      billable_event_at:       nowIso,
      last_outbound_at:        nowIso,
    })
    .eq('id', conversationId)

  return { counted: true, overage: isOverage, reason: 'first_outbound' }
}

export async function subscribeAddon(workspaceId: string, addonId: string): Promise<{ ok: true; status: WorkspaceAddonStatus }> {
  const { data: addon } = await supabaseAdmin
    .from('subscription_addons')
    .select('id, status')
    .eq('id', addonId)
    .maybeSingle()

  if (!addon) throw new BillingServiceError('Addon not found', 'not_found', 404)

  if (addon.status === 'coming_soon') {
    throw new BillingServiceError('This module is coming soon', 'coming_soon', 400)
  }

  // For 'beta' / 'live' addons — upsert workspace_addons to active
  const { data, error } = await supabaseAdmin
    .from('workspace_addons')
    .upsert({
      workspace_id: workspaceId,
      addon_id:     addonId,
      status:       'active' as const,
      activated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,addon_id' })
    .select('status')
    .single()

  if (error) throw new BillingServiceError(error.message, 'upsert_failed', 500)
  return { ok: true, status: (data as WorkspaceAddonRow).status }
}
