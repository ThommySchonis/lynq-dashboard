import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { type WhopMembership, type WhopPayment } from '@/lib/whop'
import { unlockWorkspace } from '@/lib/services/limit-check'
import { processInboundMessage } from '@/lib/conversationEngine'
import { parcelPanelWebhookPayload } from '@/lib/schemas/parcel-panel'

// ─── Shopify ──────────────────────────────────────────────────

interface ShopifyWebhookResult {
  workspaceId: string
}

type MoneySet = { presentment_money?: { amount?: string } }
type Transaction = { amount_set?: MoneySet; amount?: string | number }
type Refund = { transactions?: Transaction[] }
type Customer = { first_name?: string; last_name?: string; email?: string }

function upsertOrder(
  order: Record<string, unknown>,
  clientId: string,
  workspaceId: string,
  storeId: string | null
) {
  const subtotal = parseFloat(
    (order.subtotal_price_set as MoneySet | undefined)?.presentment_money?.amount ||
    (order.subtotal_price as string) || '0'
  )
  const totalPrice = parseFloat(
    (order.total_price_set as MoneySet | undefined)?.presentment_money?.amount ||
    (order.total_price as string) || '0'
  )
  const totalDiscounts = parseFloat(
    (order.total_discounts_set as MoneySet | undefined)?.presentment_money?.amount ||
    (order.total_discounts as string) || '0'
  )
  const refundAmount = ((order.refunds as Refund[] | undefined) || []).reduce(
    (sum: number, r: Refund) =>
      sum +
      (r.transactions || []).reduce(
        (ts: number, t: Transaction) =>
          ts +
          parseFloat(
            (t.amount_set as MoneySet | undefined)?.presentment_money?.amount ||
            String(t.amount || 0)
          ),
        0
      ),
    0
  )

  const customer = order.customer as Customer | null | undefined
  const customerName = customer
    ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    : null

  return supabaseAdmin.from('shopify_orders').upsert(
    {
      id: order.id,
      client_id: clientId,
      workspace_id: workspaceId,
      order_number: order.name,
      financial_status: order.financial_status,
      cancel_reason: order.cancel_reason || null,
      subtotal_price: subtotal,
      total_price: totalPrice,
      total_discounts: totalDiscounts,
      refund_amount: refundAmount,
      source_name: order.source_name || null,
      customer_email: customer?.email || (order.email as string | null) || null,
      customer_name: customerName,
      processed_at: order.processed_at,
      created_at_shopify: order.created_at,
      updated_at_shopify: order.updated_at,
      store_id: storeId || null,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,id' }
  )
}

export async function handleShopifyWebhook(
  eventType: string,
  payload: Record<string, unknown>,
  workspaceId: string,
  storeId: string | null,
  clientId: string
): Promise<ShopifyWebhookResult> {
  if (eventType === 'orders/create' || eventType === 'orders/updated') {
    await upsertOrder(payload, clientId, workspaceId, storeId)
  }

  if (eventType === 'orders/cancelled') {
    await supabaseAdmin
      .from('shopify_orders')
      .update({
        cancel_reason: payload.cancel_reason || 'other',
        synced_at: new Date().toISOString(),
      })
      .eq('id', payload.id)
      .eq('workspace_id', workspaceId)
  }

  if (eventType === 'refunds/create') {
    const orderId = payload.order_id
    const { data: existing } = await supabaseAdmin
      .from('shopify_orders')
      .select('refund_amount')
      .eq('id', orderId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (existing) {
      const newRefund = (
        (payload.transactions as Array<{ amount?: string | number }> | undefined) || []
      ).reduce(
        (s: number, t: { amount?: string | number }) =>
          s + parseFloat(String(t.amount || 0)),
        0
      )
      await supabaseAdmin
        .from('shopify_orders')
        .update({
          refund_amount: (existing.refund_amount || 0) + newRefund,
          synced_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('workspace_id', workspaceId)
    }
  }

  logger.info('[webhook-handler/shopify]', eventType, { workspaceId })
  return { workspaceId }
}

// ─── Whop ─────────────────────────────────────────────────────

interface WorkspaceIdRow {
  workspace_id: string
}

interface IdRow {
  id: string
}

interface PlanIdRow {
  id: string
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
  membershipId?:            string
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
    logger.error('[whop]', 'membership.activated DB update failed', { error: error.message })
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'membership.activated' } })
    throw error
  }

  logger.info('[whop]', 'membership.activated', { workspaceId, membershipId: membership.id, planId })
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
    logger.error('[whop]', 'membership.deactivated update failed', { error: error.message })
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'membership.deactivated' } })
    throw error
  }

  logger.info('[whop]', 'membership.deactivated', { membershipId: membership.id })
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
    logger.error('[whop]', 'cancel_at_period_end_changed update failed', { error: error.message })
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'membership.cancel_at_period_end_changed' } })
    throw error
  }

  logger.info('[whop]', 'cancel_at_period_end_changed', { membershipId: membership.id, cancelAtPeriodEnd: membership.cancel_at_period_end })
}

async function handlePaymentSucceeded(payment: WhopPayment): Promise<void> {
  const invoiceIdFromMeta = (payment.metadata as Record<string, unknown> | undefined)?.invoice_id
  const amount = typeof payment.amount === 'number' ? payment.amount : 0

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
    logger.error('[whop]', 'payment.succeeded update failed', { error: error.message })
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'payment.succeeded' } })
    throw error
  }

  logger.info('[whop]', 'payment.succeeded', { invoiceId, amount })

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
    logger.error('[whop]', 'unlockWorkspace failed', { error: err instanceof Error ? err.message : String(err) })
    Sentry.captureException(err, { tags: { integration: 'whop', event: 'payment.succeeded' } })
    // Continue to counter reset — the two are independent.
  }

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
    logger.error('[whop]', 'usage_counters reset failed', { error: resetErr.message })
    Sentry.captureException(resetErr, { tags: { integration: 'whop', event: 'payment.succeeded' } })
  } else {
    logger.info('[whop]', 'payment.succeeded: unlocked + reset counters', { workspaceId })
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
    logger.error('[whop]', 'payment.failed update failed', { error: error.message })
    Sentry.captureException(error, { tags: { integration: 'whop', event: 'payment.failed' } })
    throw error
  }

  // TODO: queue payment-failed notification email
  Sentry.captureMessage('[whop] payment.failed processed — notification email TODO', {
    level: 'info',
    tags:  { integration: 'whop', event: 'payment.failed' },
    extra: { invoice_id: invoiceId, payment_id: payment.id },
  })

  logger.info('[whop]', 'payment.failed', { invoiceId, paymentId: payment.id })
}

export async function handleWhopWebhook(
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ workspaceId?: string }> {
  const data = payload.data ?? payload

  let resolvedWorkspaceId: string | undefined

  switch (eventType) {
    case 'membership.activated':
      await handleMembershipActivated(data as WhopMembership)
      resolvedWorkspaceId =
        (await resolveWorkspaceIdFromMembership(data as WhopMembership)) ?? undefined
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
      logger.info('[webhook-handler/whop]', 'unhandled event', { eventType })
  }

  return { workspaceId: resolvedWorkspaceId }
}

// ─── Email ────────────────────────────────────────────────────

interface EmailFromObj {
  email?: string
  name?: string
}

export async function handleEmailWebhook(
  payload: Record<string, unknown>
): Promise<{ workspaceId?: string }> {
  const to =
    (payload.to as Array<{ email: string }> | undefined)?.[0]?.email ||
    (payload.to as string | undefined)
  const fromObj = payload.from as EmailFromObj | string | undefined
  const fromEmail =
    typeof fromObj === 'object' && fromObj?.email ? fromObj.email : (fromObj as string | undefined)
  const fromName =
    (typeof fromObj === 'object' && fromObj?.name ? fromObj.name : fromEmail) as string | undefined
  const subject = (payload.subject as string | undefined) || '(no subject)'
  const bodyHtml =
    (payload.html as string | undefined) || (payload.text as string | undefined) || ''
  const bodyText = (payload.text as string | undefined) || ''
  const headers = payload.headers as Record<string, string> | undefined
  const messageId = headers?.['message-id'] || (payload.message_id as string | undefined)
  const inReplyTo = headers?.['in-reply-to'] || (payload.in_reply_to as string | undefined)

  if (!to) return {}

  const accountResult = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('forwarding_address', to)
    .maybeSingle()

  const account = accountResult.data as Parameters<typeof processInboundMessage>[0] | null
  if (!account) return {}

  // Check for forwarding verification token
  const verifyMatch = (subject as string)?.match(/\[lynq-verify:([^\]]+)\]/)
  if (verifyMatch) {
    const token = verifyMatch[1]
    const acct = account as Record<string, unknown>
    if (
      acct.verification_token === token &&
      acct.verification_token_expires_at &&
      new Date(acct.verification_token_expires_at as string) > new Date()
    ) {
      const updates: Record<string, unknown> = {
        forwarding_verified: true,
        verification_token: null,
      }
      if (acct.domain_verified) updates.status = 'active'

      await supabaseAdmin
        .from('email_accounts')
        .update(updates)
        .eq('id', acct.id as string)

      return { workspaceId: acct.workspace_id as string | undefined }
    }
  }

  const normalizedMessage = {
    providerMessageId: messageId || `inbound_${Date.now()}`,
    messageId: inReplyTo || messageId || undefined,
    from: { email: fromEmail ?? '', name: fromName },
    to: [{ email: to, name: '' }],
    cc: [],
    subject,
    bodyHtml,
    bodyText,
    date: new Date().toISOString(),
    isOutbound: false,
  }

  await processInboundMessage(account, normalizedMessage)

  return { workspaceId: account.workspace_id as string | undefined }
}

// ─── ParcelPanel ──────────────────────────────────────────────

export async function handleParcelPanelWebhook(
  payload: unknown,
  workspaceId: string,
  storeId: string
): Promise<{ workspaceId: string }> {
  const result = parcelPanelWebhookPayload.safeParse(payload)
  if (!result.success) {
    logger.warn('[webhook-handler/parcelpanel]', 'payload validation failed')
    return { workspaceId }
  }

  const parsed = result.data

  const { error } = await supabaseAdmin.from('shipments').upsert(
    {
      workspace_id: workspaceId,
      store_id: storeId,
      order_number: parsed.order_number,
      tracking_number: parsed.tracking_number,
      carrier: parsed.carrier.name,
      status: parsed.status,
      customer_name: parsed.customer?.name ?? null,
      estimated_delivery: parsed.estimated_delivery_date ?? null,
      last_updated: new Date().toISOString(),
      raw_data: payload,
    },
    { onConflict: 'workspace_id, tracking_number' }
  )

  if (error) {
    logger.error('[webhook-handler/parcelpanel]', 'upsert error', { error: error.message })
    throw error
  }

  logger.info('[webhook-handler/parcelpanel]', 'upserted', {
    trackingNumber: parsed.tracking_number,
  })
  return { workspaceId }
}
