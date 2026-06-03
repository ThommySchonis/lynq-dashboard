import { getAdminClient } from '../supabase.ts'
import * as whop from '../whop.ts'
import { isEUCountry, isValidVATFormat } from '../billing-issuer.ts'
import { logger } from '../logger.ts'

const MS_PER_DAY = 24 * 60 * 60 * 1000

interface Plan {
  id: string
  name: string
  is_active: boolean
  is_custom: boolean
  whop_plan_id: string | null
  ticket_limit: number | null
  ai_suggest_limit: number | null
  sort_order: number
  features: Record<string, unknown>
  [key: string]: unknown
}

interface WorkspaceSubscription {
  id: string
  workspace_id: string
  plan_id: string
  status: string
  whop_subscription_id: string | null
  whop_customer_id: string | null
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  [key: string]: unknown
}

interface UsageCounter {
  id: string
  workspace_id: string
  period_start: string
  period_end: string
  tickets_used: number
  tickets_overage: number
  ai_suggest_used: number
  ai_suggest_overage: number
  ai_resolutions_used: number
  [key: string]: unknown
}

interface PlanFeatures {
  academy_access: boolean
  email_limit: number | null
  priority_support: boolean
}

type WorkspaceAddonStatus = 'active' | 'inactive' | 'coming_soon'

interface WorkspaceAddonRow {
  addon_id: string
  status: WorkspaceAddonStatus
}

interface PaymentMethodRef {
  id: string
  whop_payment_method_id: string | null
}

interface UpdateBillingInfoInput {
  billing_email?: string
  organization_name?: string
  phone_number?: string | null
  address_line1?: string
  address_line2?: string | null
  city?: string
  postal_code?: string
  country?: string
  state?: string | null
  vat_number?: string | null
}

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

export async function getSubscription(workspaceId: string): Promise<WorkspaceSubscription | null> {
  const sb = getAdminClient()
  const result = await sb
    .from('workspace_subscriptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (result.error) {
    logger.error('[billing]', 'getSubscription failed', { error: result.error.message })
    return null
  }
  return result.data as WorkspaceSubscription | null
}

const DEFAULT_FEATURES: PlanFeatures = {
  academy_access: false,
  email_limit: null,
  priority_support: false,
}

export async function getWorkspaceFeatures(workspaceId: string): Promise<PlanFeatures> {
  const sub = await getSubscription(workspaceId)
  if (!sub) return DEFAULT_FEATURES

  const plan = await getPlan(sub.plan_id)
  if (!plan) return DEFAULT_FEATURES

  return {
    ...DEFAULT_FEATURES,
    ...plan.features,
  }
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const sb = getAdminClient()
  const result = await sb
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()

  if (result.error) {
    logger.error('[billing]', 'getPlan failed', { error: result.error.message })
    return null
  }
  return result.data as Plan | null
}

export async function listPlans(): Promise<Plan[]> {
  const sb = getAdminClient()
  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    logger.error('[billing]', 'listPlans failed', { error: error.message })
    return []
  }
  return (data as Plan[]) || []
}

async function ensureCurrentPeriod(
  workspaceId: string,
  sub: WorkspaceSubscription,
): Promise<UsageCounter | null> {
  const sb = getAdminClient()
  const existingResult = await sb
    .from('usage_counters')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('period_start', sub.current_period_start)
    .maybeSingle()

  if (existingResult.data) return existingResult.data as UsageCounter

  const createResult = await sb
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
      const refetchResult = await sb
        .from('usage_counters')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('period_start', sub.current_period_start)
        .single()
      return refetchResult.data as UsageCounter | null
    }
    logger.error('[billing]', 'ensureCurrentPeriod insert failed', { error: createResult.error.message })
    return null
  }
  return createResult.data as UsageCounter
}

export async function getSubscriptionWithUsage(workspaceId: string) {
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

export async function getUsageBreakdown(workspaceId: string) {
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

export type ChangePlanOutcome =
  | { mode: 'updated';  subscription: WorkspaceSubscription }
  | { mode: 'checkout'; checkout_url: string }

export async function changePlan(
  workspaceId: string,
  planId: string,
  options: { successUrl?: string } = {},
): Promise<ChangePlanOutcome> {
  const sb = getAdminClient()
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

  if (sub.whop_subscription_id) {
    if (sub.plan_id === planId) {
      return { mode: 'updated', subscription: sub }
    }
    await whop.updateMembership({
      membershipId: sub.whop_subscription_id,
      newPlanId:    targetPlan.whop_plan_id,
    })

    const updateResult = await sb
      .from('workspace_subscriptions')
      .update({ plan_id: planId })
      .eq('id', sub.id)
      .select('*')
      .single()

    if (updateResult.error) {
      logger.error('[billing]', 'changePlan DB update failed', { error: updateResult.error.message })
      throw new BillingServiceError(updateResult.error.message, 'update_failed', 500)
    }
    return { mode: 'updated', subscription: updateResult.data as WorkspaceSubscription }
  }

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
  const sb = getAdminClient()
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

  const cancelResult = await sb
    .from('workspace_subscriptions')
    .update(updates)
    .eq('id', sub.id)
    .select('*')
    .single()

  if (cancelResult.error) throw new BillingServiceError(cancelResult.error.message, 'update_failed', 500)
  return cancelResult.data as WorkspaceSubscription
}

export async function reactivateSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
  const sb = getAdminClient()
  const sub = await getSubscription(workspaceId)
  if (!sub) throw new BillingServiceError('No subscription', 'no_subscription', 404)
  if (!sub.cancel_at_period_end && sub.status !== 'canceled') {
    return sub
  }

  if (sub.whop_subscription_id) {
    await whop.reactivateSubscription({ subscriptionId: sub.whop_subscription_id })
  }

  const reactivateResult = await sb
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

export async function getBillingInfo(workspaceId: string) {
  const sb = getAdminClient()
  const infoResult = await sb
    .from('billing_info')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (infoResult.error) {
    logger.error('[billing]', 'getBillingInfo failed', { error: infoResult.error.message })
    return null
  }
  return infoResult.data
}

export async function updateBillingInfo(workspaceId: string, input: UpdateBillingInfoInput) {
  const sb = getAdminClient()
  const existing = await getBillingInfo(workspaceId)
  const merged = { ...existing, ...input } as UpdateBillingInfoInput

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

  const upsertResult = await sb
    .from('billing_info')
    .upsert(row, { onConflict: 'workspace_id' })
    .select('*')
    .single()

  if (upsertResult.error) throw new BillingServiceError(upsertResult.error.message, 'upsert_failed', 500)
  return upsertResult.data
}

export async function listInvoices(workspaceId: string, page = 0, perPage = 25) {
  const sb = getAdminClient()
  const from = page * perPage
  const to   = from + perPage - 1

  const { data, error, count } = await sb
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new BillingServiceError(error.message, 'query_failed', 500)
  return {
    invoices: data || [],
    total:    count ?? 0,
  }
}

export async function getInvoice(workspaceId: string, invoiceId: string) {
  const sb = getAdminClient()
  const invoiceResult = await sb
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (invoiceResult.error) {
    logger.error('[billing]', 'getInvoice failed', { error: invoiceResult.error.message })
    return null
  }
  return invoiceResult.data
}

export async function listPaymentMethods(workspaceId: string) {
  const sb = getAdminClient()
  const { data, error } = await sb
    .from('payment_methods')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new BillingServiceError(error.message, 'query_failed', 500)
  return data || []
}

export async function deletePaymentMethod(workspaceId: string, methodId: string): Promise<void> {
  const sb = getAdminClient()
  const methodResult = await sb
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

  const { error } = await sb
    .from('payment_methods')
    .delete()
    .eq('id', methodId)
    .eq('workspace_id', workspaceId)

  if (error) throw new BillingServiceError(error.message, 'delete_failed', 500)
}

export async function listAddons(workspaceId: string) {
  const sb = getAdminClient()
  const [{ data: catalog }, { data: workspaceAddons }] = await Promise.all([
    sb
      .from('subscription_addons')
      .select('*')
      .order('sort_order', { ascending: true }),
    sb
      .from('workspace_addons')
      .select('addon_id, status')
      .eq('workspace_id', workspaceId),
  ])

  const wsStatusById: Record<string, WorkspaceAddonStatus> = Object.fromEntries(
    ((workspaceAddons as WorkspaceAddonRow[]) ?? [])
      .map(w => [w.addon_id, w.status])
  )

  return (catalog || []).map((addon: Record<string, unknown>) => ({
    ...addon,
    workspace_status: wsStatusById[addon.id as string] ?? 'inactive',
  }))
}

export async function subscribeAddon(workspaceId: string, addonId: string) {
  const sb = getAdminClient()
  const { data: addon } = await sb
    .from('subscription_addons')
    .select('id, status')
    .eq('id', addonId)
    .maybeSingle()

  if (!addon) throw new BillingServiceError('Addon not found', 'not_found', 404)

  if ((addon as Record<string, unknown>).status === 'coming_soon') {
    throw new BillingServiceError('This module is coming soon', 'coming_soon', 400)
  }

  const { data, error } = await sb
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

export async function recordOutboundMessage(
  workspaceId: string,
  conversationId: string,
) {
  const sb = getAdminClient()

  const { data: conv, error: convError } = await sb
    .from('email_conversations')
    .select('id, workspace_id, status, is_spam, counted_in_usage_period')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (convError) logger.error('[billing]', 'recordOutboundMessage fetch failed', { error: convError.message })

  if (!conv) {
    return { counted: false, overage: false, reason: 'conversation_not_found' as const }
  }

  const row = conv as Record<string, unknown>
  const nowIso = new Date().toISOString()

  if (row.is_spam) {
    await sb
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'spam' as const }
  }

  if (row.counted_in_usage_period) {
    await sb
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'continuation' as const }
  }

  const sub = await getSubscription(workspaceId)
  if (!sub) {
    await sb
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'no_subscription' as const }
  }

  const counter = await ensureCurrentPeriod(workspaceId, sub)
  if (!counter) {
    await sb
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'no_subscription' as const }
  }

  const plan = await getPlan(sub.plan_id)
  const ticketLimit = plan?.ticket_limit ?? null
  const isOverage = ticketLimit != null && counter.tickets_used >= ticketLimit

  const counterUpdates = isOverage
    ? { tickets_overage: counter.tickets_overage + 1 }
    : { tickets_used:    counter.tickets_used    + 1 }

  const { error: counterError } = await sb
    .from('usage_counters')
    .update(counterUpdates)
    .eq('id', counter.id)

  if (counterError) {
    logger.error('[billing]', 'recordOutboundMessage counter update failed', { error: counterError.message })
    await sb
      .from('email_conversations')
      .update({ last_outbound_at: nowIso })
      .eq('id', conversationId)
    return { counted: false, overage: false, reason: 'no_subscription' as const }
  }

  await sb
    .from('email_conversations')
    .update({
      counted_in_usage_period: counter.id,
      billable_event_at:       nowIso,
      last_outbound_at:        nowIso,
    })
    .eq('id', conversationId)

  return { counted: true, overage: isOverage, reason: 'first_outbound' as const }
}
