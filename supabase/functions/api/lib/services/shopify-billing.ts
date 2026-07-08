import { getAdminClient } from '../supabase.ts'
import { logger } from '../logger.ts'
import {
  buildManagedPricingUrl,
  cancelAppSubscription,
  getAppChargeHistory,
  getCurrentAppSubscription,
  getShopBillingAddress,
  type AppChargeRecord,
  type ShopBillingAddress,
} from '../shopify-admin.ts'

export type WorkspaceSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'paused'
  | 'pending_shopify_subscription'

export type ShopifyChargeStatus =
  | 'pending'
  | 'active'
  | 'cancelled'
  | 'declined'
  | 'expired'
  | 'frozen'

export interface ShopifyBillingSubscription {
  planId: string | null
  status: WorkspaceSubscriptionStatus
  shopifyChargeStatus: ShopifyChargeStatus | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  isGrandfathered: boolean
  billingShopDomain: string | null
  planUnmapped: boolean
  priceAmount: number | null
  priceCurrency: string | null
}

export class ShopifyBillingError extends Error {
  constructor(message: string, public code: string, public statusCode = 400) {
    super(message)
    this.name = 'ShopifyBillingError'
  }
}

interface BillingStoreRow {
  id: string
  workspace_id: string
  shopify_domain: string
  shopify_access_token: string
}

async function getBillingStore(workspaceId: string): Promise<BillingStoreRow | null> {
  const sb = getAdminClient()
  const { data } = await sb
    .from('integrations')
    .select('id, workspace_id, shopify_domain, shopify_access_token')
    .eq('workspace_id', workspaceId)
    .eq('is_billing_store', true)
    .maybeSingle()
  return (data as BillingStoreRow | null) ?? null
}

export function normalizeStatus(raw: string | null | undefined): ShopifyChargeStatus | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (
    lower === 'pending' || lower === 'active' || lower === 'cancelled' ||
    lower === 'declined' || lower === 'expired' || lower === 'frozen'
  ) return lower
  if (lower === 'accepted') return 'active'
  return null
}

export function mapShopifyStatusToLocal(status: string): WorkspaceSubscriptionStatus {
  const lower = status.toLowerCase()
  if (lower === 'active' || lower === 'accepted') return 'active'
  if (lower === 'pending') return 'pending_shopify_subscription'
  if (lower === 'cancelled') return 'canceled'
  if (lower === 'expired' || lower === 'declined' || lower === 'frozen') return 'past_due'
  return 'pending_shopify_subscription'
}

export interface LocalSubscriptionState {
  status: WorkspaceSubscriptionStatus
  planUnmapped: boolean
}

/**
 * Decide the local status for a Shopify-reported subscription.
 * An ACTIVE Shopify charge whose handle we can't resolve to a plan must NOT
 * grant access — we can't apply entitlements we don't know. Block it and flag
 * it so an admin maps the handle.
 */
export function resolveLocalSubscriptionState(
  shopifyStatus: string,
  planFound: boolean,
): LocalSubscriptionState {
  const mapped = mapShopifyStatusToLocal(shopifyStatus)
  if (mapped === 'active' && !planFound) {
    return { status: 'pending_shopify_subscription', planUnmapped: true }
  }
  return { status: mapped, planUnmapped: false }
}

export interface CancellationInput {
  status: WorkspaceSubscriptionStatus
  shopifyChargeId: string | null
  isGrandfathered: boolean
}

export type CancellationAction =
  | { kind: 'noop' }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'cancel'; chargeId: string }

/**
 * Pure decision for a cancel request. `noop` when already canceled (idempotent);
 * `error` when there is no live Shopify charge to cancel (no charge id, or a
 * grandfathered workspace that was never billed by Shopify); otherwise `cancel`.
 */
export function resolveCancellationAction(input: CancellationInput): CancellationAction {
  if (input.status === 'canceled') return { kind: 'noop' }
  if (input.isGrandfathered || !input.shopifyChargeId) {
    return { kind: 'error', code: 'no_active_subscription', message: 'No active subscription to cancel' }
  }
  return { kind: 'cancel', chargeId: input.shopifyChargeId }
}

const USAGE_PERIOD_DAYS = 30

/** Anchor the usage period to Shopify's billing period (EVERY_30_DAYS plans). */
export function deriveUsagePeriod(
  currentPeriodEnd: string,
): { period_start: string; period_end: string } {
  const end = new Date(currentPeriodEnd)
  const start = new Date(end.getTime() - USAGE_PERIOD_DAYS * 86_400_000)
  return { period_start: start.toISOString(), period_end: end.toISOString() }
}

/**
 * Log + create an admin-visible notification when Shopify reports a plan handle
 * we can't map. De-duped: one open alert per workspace until it's cleared.
 * Inserted with the admin client (bypasses RLS); visible in the admin panel
 * (SELECT * over notifications) and the affected workspace's feed.
 */
export async function notifyAdminUnmappedPlan(
  workspaceId: string,
  handle: string,
  shopDomain: string | null,
): Promise<void> {
  logger.error('[shopify-billing]', 'unmapped Shopify plan handle — workspace hard-blocked', {
    workspaceId, handle, shopDomain,
  })
  const sb = getAdminClient()
  const { data: existing } = await sb
    .from('notifications')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('category', 'system_alert')
    .is('cleared_at', null)
    .limit(1)
    .maybeSingle()
  if (existing) return
  await sb.from('notifications').insert({
    workspace_id: workspaceId,
    category: 'system_alert',
    title: 'Subscription plan not recognized',
    body: `Shopify reported plan handle "${handle}" which is not mapped to a Lynq plan. `
      + `This workspace is blocked until an admin adds the handle to the plans table.`,
    source_type: 'billing',
  })
}

interface SubscriptionRow {
  plan_id: string | null
  status: WorkspaceSubscriptionStatus
  shopify_charge_status: string | null
  shopify_trial_ends_at: string | null
  trial_ends_at: string | null
  shopify_current_period_end: string | null
  current_period_end: string | null
  shopify_billing_shop_domain: string | null
  is_grandfathered: boolean
  plan_unmapped: boolean
  shopify_price_amount: number | null
  shopify_price_currency: string | null
}

export async function getSubscription(workspaceId: string): Promise<ShopifyBillingSubscription> {
  const sb = getAdminClient()
  const { data } = await sb
    .from('workspace_subscriptions')
    .select(
      'plan_id, status, shopify_charge_status, shopify_trial_ends_at, trial_ends_at, ' +
      'shopify_current_period_end, current_period_end, shopify_billing_shop_domain, is_grandfathered, ' +
      'plan_unmapped, shopify_price_amount, shopify_price_currency',
    )
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const row = data as SubscriptionRow | null
  if (!row) {
    return {
      planId: null,
      status: 'pending_shopify_subscription',
      shopifyChargeStatus: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      isGrandfathered: false,
      billingShopDomain: null,
      planUnmapped: false,
      priceAmount: null,
      priceCurrency: null,
    }
  }
  return {
    planId: row.plan_id,
    status: row.status,
    shopifyChargeStatus: normalizeStatus(row.shopify_charge_status),
    trialEndsAt: row.shopify_trial_ends_at ?? row.trial_ends_at,
    currentPeriodEnd: row.shopify_current_period_end ?? row.current_period_end,
    isGrandfathered: row.is_grandfathered,
    billingShopDomain: row.shopify_billing_shop_domain,
    planUnmapped: row.plan_unmapped,
    priceAmount: row.shopify_price_amount,
    priceCurrency: row.shopify_price_currency,
  }
}

export async function cancelSubscription(workspaceId: string): Promise<ShopifyBillingSubscription> {
  const sb = getAdminClient()

  const { data } = await sb
    .from('workspace_subscriptions')
    .select('status, shopify_charge_id, is_grandfathered')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const row = data as
    | { status: WorkspaceSubscriptionStatus; shopify_charge_id: string | null; is_grandfathered: boolean }
    | null

  const action = resolveCancellationAction({
    status: row?.status ?? 'pending_shopify_subscription',
    shopifyChargeId: row?.shopify_charge_id ?? null,
    isGrandfathered: row?.is_grandfathered ?? false,
  })

  if (action.kind === 'noop') return getSubscription(workspaceId)
  if (action.kind === 'error') throw new ShopifyBillingError(action.message, action.code, 400)

  const billingStore = await getBillingStore(workspaceId)
  if (!billingStore) throw new ShopifyBillingError('No billing store connected', 'no_billing_store', 400)

  try {
    await cancelAppSubscription(billingStore.shopify_domain, billingStore.shopify_access_token, action.chargeId)
  } catch (err) {
    // Surface Shopify userErrors / API failures as a clean 4xx with the message.
    const message = err instanceof Error ? err.message : 'Shopify cancellation failed'
    throw new ShopifyBillingError(message, 'shopify_cancel_failed', 400)
  }

  // Mirror the billing webhook so the UI reflects cancellation immediately;
  // the webhook still reconciles asynchronously.
  const { error: updateError } = await sb
    .from('workspace_subscriptions')
    .update({
      status: 'canceled',
      shopify_charge_status: 'cancelled',
      canceled_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
  if (updateError) {
    throw new ShopifyBillingError(updateError.message, 'update_failed', 500)
  }

  return getSubscription(workspaceId)
}

export interface SubscriptionWithUsage {
  subscription: ShopifyBillingSubscription
  plan: { id: string; display_name: string; ticket_limit: number | null; ai_suggest_limit: number | null } | null
  usage: { tickets_used: number; ai_suggest_used: number; period_start: string; period_end: string } | null
  blocked: { tickets: boolean; aiSuggest: boolean; planUnmapped: boolean }
}

export async function getSubscriptionWithUsage(workspaceId: string): Promise<SubscriptionWithUsage> {
  const sb = getAdminClient()
  const subscription = await getSubscription(workspaceId)

  let plan: SubscriptionWithUsage['plan'] = null
  if (subscription.planId) {
    const { data } = await sb
      .from('plans')
      .select('id, display_name, ticket_limit, ai_suggest_limit')
      .eq('id', subscription.planId)
      .maybeSingle()
    plan = (data as SubscriptionWithUsage['plan']) ?? null
  }

  const { data: usageRow } = await sb
    .from('usage_counters')
    .select('tickets_used, ai_suggest_used, period_start, period_end')
    .eq('workspace_id', workspaceId)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()
  const usage = (usageRow as SubscriptionWithUsage['usage']) ?? null

  const blocked = {
    tickets: !subscription.isGrandfathered
      && plan?.ticket_limit !== null
      && usage !== null
      && (usage.tickets_used >= (plan?.ticket_limit ?? Infinity)),
    aiSuggest: !subscription.isGrandfathered
      && plan?.ai_suggest_limit !== null
      && usage !== null
      && (usage.ai_suggest_used >= (plan?.ai_suggest_limit ?? Infinity)),
    planUnmapped: subscription.planUnmapped && !subscription.isGrandfathered,
  }

  return { subscription, plan, usage, blocked }
}

export async function getManageUrl(workspaceId: string): Promise<string | null> {
  const billingStore = await getBillingStore(workspaceId)
  if (!billingStore) return null
  return buildManagedPricingUrl(billingStore.shopify_domain)
}

export interface ConnectedStore {
  id: string
  shopifyDomain: string
  isBillingStore: boolean
}

export async function listConnectedStores(workspaceId: string): Promise<ConnectedStore[]> {
  const sb = getAdminClient()
  const { data } = await sb
    .from('integrations')
    .select('id, shopify_domain, is_billing_store')
    .eq('workspace_id', workspaceId)
    .not('shopify_domain', 'is', null)
    .order('shopify_connected_at', { ascending: true })
  type Row = { id: string; shopify_domain: string; is_billing_store: boolean }
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    shopifyDomain: r.shopify_domain,
    isBillingStore: r.is_billing_store,
  }))
}

export interface SetBillingStoreResult {
  newBillingStoreDomain: string
  managedPricingUrl: string
}

export async function setBillingStore(
  workspaceId: string,
  integrationId: string,
): Promise<SetBillingStoreResult> {
  const sb = getAdminClient()

  const { data: target } = await sb
    .from('integrations')
    .select('id, shopify_domain, shopify_access_token')
    .eq('id', integrationId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const targetRow = target as { id: string; shopify_domain: string; shopify_access_token: string } | null
  if (!targetRow?.shopify_domain) {
    throw new ShopifyBillingError('Store not found in workspace', 'store_not_found', 404)
  }

  const previous = await getBillingStore(workspaceId)
  if (previous && previous.id !== integrationId) {
    const { data: subRow } = await sb
      .from('workspace_subscriptions')
      .select('shopify_charge_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    const chargeId = (subRow as { shopify_charge_id: string | null } | null)?.shopify_charge_id
    if (chargeId) {
      try {
        await cancelAppSubscription(previous.shopify_domain, previous.shopify_access_token, chargeId)
      } catch (e) {
        logger.warn('[shopify-billing]', 'failed to cancel previous subscription', {
          chargeId, error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  await sb.from('integrations').update({ is_billing_store: false }).eq('workspace_id', workspaceId)
  await sb.from('integrations').update({ is_billing_store: true }).eq('id', integrationId)

  await sb
    .from('workspace_subscriptions')
    .update({
      status: 'pending_shopify_subscription',
      shopify_charge_id: null,
      shopify_charge_status: null,
      shopify_billing_shop_domain: targetRow.shopify_domain,
    })
    .eq('workspace_id', workspaceId)

  return {
    newBillingStoreDomain: targetRow.shopify_domain,
    managedPricingUrl: buildManagedPricingUrl(targetRow.shopify_domain),
  }
}

export async function grandfatherWorkspace(
  workspaceId: string,
  enabled: boolean,
  reason: string | null,
): Promise<void> {
  const sb = getAdminClient()
  const { data: existing } = await sb
    .from('workspace_subscriptions')
    .select('shopify_charge_id, shopify_billing_shop_domain')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const existingRow = existing as
    | { shopify_charge_id: string | null; shopify_billing_shop_domain: string | null }
    | null

  if (!existingRow) {
    await sb.from('workspace_subscriptions').insert({
      workspace_id: workspaceId,
      status: enabled ? 'active' : 'pending_shopify_subscription',
      is_grandfathered: enabled,
      grandfather_reason: enabled ? reason : null,
    })
    return
  }

  if (enabled && existingRow.shopify_charge_id && existingRow.shopify_billing_shop_domain) {
    const billingStore = await getBillingStore(workspaceId)
    if (billingStore) {
      try {
        await cancelAppSubscription(
          billingStore.shopify_domain,
          billingStore.shopify_access_token,
          existingRow.shopify_charge_id,
        )
      } catch (e) {
        logger.warn('[shopify-billing]', 'failed to cancel charge during grandfather', {
          workspaceId, error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  await sb
    .from('workspace_subscriptions')
    .update({
      is_grandfathered: enabled,
      grandfather_reason: enabled ? reason : null,
      status: enabled ? 'active' : 'pending_shopify_subscription',
    })
    .eq('workspace_id', workspaceId)
}

export async function syncFromShopify(workspaceId: string): Promise<ShopifyBillingSubscription> {
  const billingStore = await getBillingStore(workspaceId)
  if (!billingStore) return getSubscription(workspaceId)

  const remote = await getCurrentAppSubscription(billingStore.shopify_domain, billingStore.shopify_access_token)
  const sb = getAdminClient()

  if (!remote) {
    await sb
      .from('workspace_subscriptions')
      .update({
        status: 'pending_shopify_subscription',
        shopify_charge_id: null,
        shopify_charge_status: null,
        shopify_current_period_end: null,
        plan_unmapped: false,
        shopify_price_amount: null,
        shopify_price_currency: null,
      })
      .eq('workspace_id', workspaceId)
    return getSubscription(workspaceId)
  }

  const handle = remote.handle
  let planId: string | null = null
  if (handle) {
    const { data: plan } = await sb
      .from('plans')
      .select('id')
      .eq('shopify_handle', handle)
      .maybeSingle()
    planId = (plan as { id: string } | null)?.id ?? null
  }
  const planFound = planId !== null

  const { status: localStatus, planUnmapped } = resolveLocalSubscriptionState(remote.status, planFound)
  const chargeStatus = normalizeStatus(remote.status)
  if (planUnmapped) {
    await notifyAdminUnmappedPlan(workspaceId, handle ?? '(none)', billingStore.shopify_domain)
  }

  const period = remote.currentPeriodEnd ? deriveUsagePeriod(remote.currentPeriodEnd) : null

  await sb.from('workspace_subscriptions').upsert(
    {
      workspace_id: workspaceId,
      plan_id: planId,
      plan_unmapped: planUnmapped,
      status: localStatus,
      shopify_charge_id: remote.id,
      shopify_charge_status: chargeStatus,
      shopify_billing_shop_domain: billingStore.shopify_domain,
      shopify_current_period_end: remote.currentPeriodEnd,
      shopify_price_amount: remote.priceAmount,
      shopify_price_currency: remote.priceCurrency,
      ...(period ? { current_period_start: period.period_start, current_period_end: period.period_end } : {}),
    },
    { onConflict: 'workspace_id' },
  )

  return getSubscription(workspaceId)
}

export async function getBillingAddress(workspaceId: string): Promise<ShopBillingAddress | null> {
  const billingStore = await getBillingStore(workspaceId)
  if (!billingStore) return null
  return getShopBillingAddress(billingStore.shopify_domain, billingStore.shopify_access_token)
}

export async function listInvoices(workspaceId: string): Promise<AppChargeRecord[]> {
  const billingStore = await getBillingStore(workspaceId)
  if (!billingStore) return []
  return getAppChargeHistory(billingStore.shopify_domain, billingStore.shopify_access_token)
}
