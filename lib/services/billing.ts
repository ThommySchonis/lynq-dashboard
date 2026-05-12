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
  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[billing.getSubscription] failed:', error.message)
    return null
  }
  return data as WorkspaceSubscription | null
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()

  if (error) {
    console.error('[billing.getPlan] failed:', error.message)
    return null
  }
  return data as Plan | null
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
  const { data: existing } = await supabaseAdmin
    .from('usage_counters')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('period_start', sub.current_period_start)
    .maybeSingle()

  if (existing) return existing as UsageCounter

  const { data: created, error: insertError } = await supabaseAdmin
    .from('usage_counters')
    .insert({
      workspace_id: workspaceId,
      period_start: sub.current_period_start,
      period_end:   sub.current_period_end,
    })
    .select('*')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: refetched } = await supabaseAdmin
        .from('usage_counters')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('period_start', sub.current_period_start)
        .single()
      return refetched as UsageCounter | null
    }
    console.error('[billing.ensureCurrentPeriod] insert failed:', insertError.message)
    return null
  }
  return created as UsageCounter
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
 * Change the workspace's plan. For v1 this is a soft change — we
 * update the DB row and stub the Whop call. The stub returns
 * proration info but no real charge happens until Whop wires up.
 *
 * Edge cases:
 *   - Custom plans (Elite) require contacting sales; cannot self-change to
 *   - Same-plan change is a no-op (returns the current sub)
 */
export async function changePlan(workspaceId: string, planId: string, options: { prorate?: boolean } = {}): Promise<WorkspaceSubscription> {
  const sub = await getSubscription(workspaceId)
  if (!sub) throw new BillingServiceError('No subscription for this workspace', 'no_subscription', 404)

  const targetPlan = await getPlan(planId)
  if (!targetPlan)        throw new BillingServiceError('Unknown plan',                 'unknown_plan',     400)
  if (!targetPlan.is_active) throw new BillingServiceError('Plan is not active',         'inactive_plan',    400)
  if (targetPlan.is_custom)  throw new BillingServiceError('Custom plans require contact with sales', 'custom_plan_contact_sales', 400)

  if (sub.plan_id === planId) return sub  // no-op

  // Stub Whop call — real implementation will trigger proration
  if (sub.whop_subscription_id) {
    await whop.updateSubscription({
      subscriptionId: sub.whop_subscription_id,
      newPlanId:      planId,
      prorate:        options.prorate ?? true,
    })
  }

  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update({ plan_id: planId })
    .eq('id', sub.id)
    .select('*')
    .single()

  if (error) {
    console.error('[billing.changePlan] update failed:', error.message)
    throw new BillingServiceError(error.message, 'update_failed', 500)
  }
  return data as WorkspaceSubscription
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

  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update(updates)
    .eq('id', sub.id)
    .select('*')
    .single()

  if (error) throw new BillingServiceError(error.message, 'update_failed', 500)
  return data as WorkspaceSubscription
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

  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update({
      status:               'active',
      cancel_at_period_end: false,
      canceled_at:          null,
    })
    .eq('id', sub.id)
    .select('*')
    .single()

  if (error) throw new BillingServiceError(error.message, 'update_failed', 500)
  return data as WorkspaceSubscription
}

// ─── Billing info ────────────────────────────────────────────────────

export async function getBillingInfo(workspaceId: string): Promise<BillingInfo | null> {
  const { data, error } = await supabaseAdmin
    .from('billing_info')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[billing.getBillingInfo] failed:', error.message)
    return null
  }
  return data as BillingInfo | null
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

  const { data, error } = await supabaseAdmin
    .from('billing_info')
    .upsert(row, { onConflict: 'workspace_id' })
    .select('*')
    .single()

  if (error) throw new BillingServiceError(error.message, 'upsert_failed', 500)
  return data as BillingInfo
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
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[billing.getInvoice] failed:', error.message)
    return null
  }
  return data as Invoice | null
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
  const { data: method } = await supabaseAdmin
    .from('payment_methods')
    .select('id, whop_payment_method_id')
    .eq('id', methodId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

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
    ((workspaceAddons as { addon_id: string; status: WorkspaceAddonStatus }[]) ?? [])
      .map(w => [w.addon_id, w.status])
  )

  return ((catalog as SubscriptionAddon[]) || []).map(addon => ({
    ...addon,
    workspace_status: wsStatusById[addon.id] ?? 'inactive',
  }))
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
  return { ok: true, status: (data as { status: WorkspaceAddonStatus }).status }
}
