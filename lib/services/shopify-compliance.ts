import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { sendCustomerDataExportEmail } from '@/lib/emails/customer-data-export'

// ── Shopify compliance webhook payload shapes ───────────────────────────────

export interface CustomersDataRequestPayload {
  shop_id: number
  shop_domain: string
  orders_requested?: number[]
  customer: { id: number; email: string; phone?: string }
  data_request: { id: number }
}

export interface CustomersRedactPayload {
  shop_id: number
  shop_domain: string
  customer: { id: number; email: string; phone?: string }
  orders_to_redact?: number[]
}

export interface ShopRedactPayload {
  shop_id: number
  shop_domain: string
}

export type ComplianceTopic =
  | 'customers/data_request'
  | 'customers/redact'
  | 'shop/redact'

/**
 * Deterministic placeholder email used to anonymize redacted customer rows.
 * Form: redacted+<sha256(email)[:12]>@deleted.local
 * Idempotent: re-hashing the same source email gives the same placeholder, so
 * re-running redact on already-anonymized rows is a safe no-op.
 */
export function hashedRedactedEmail(email: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim(), 'utf8')
    .digest('hex')
    .slice(0, 12)
  return `redacted+${digest}@deleted.local`
}

// ── HMAC verification ───────────────────────────────────────────────────────

interface HmacResult {
  ok: boolean
  secretUsed: 'pub' | 'main' | null
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function hmacB64(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
}

/**
 * Verifies Shopify's X-Shopify-Hmac-Sha256 header against the app's client secret.
 * Tries SHOPIFY_CLIENT_SECRET_PUB first, then SHOPIFY_CLIENT_SECRET. Always evaluates
 * both checks (no early return) so the timing doesn't leak which secret matched.
 */
export function verifyHmacAgainstAppSecret(
  rawBody: string,
  hmacHeader: string | null
): HmacResult {
  if (!hmacHeader) return { ok: false, secretUsed: null }

  const pubSecret = process.env.SHOPIFY_CLIENT_SECRET_PUB ?? ''
  const mainSecret = process.env.SHOPIFY_CLIENT_SECRET ?? ''

  const pubOk = pubSecret
    ? timingSafeEqualStrings(hmacB64(rawBody, pubSecret), hmacHeader)
    : false
  const mainOk = mainSecret
    ? timingSafeEqualStrings(hmacB64(rawBody, mainSecret), hmacHeader)
    : false

  if (pubOk) return { ok: true, secretUsed: 'pub' }
  if (mainOk) return { ok: true, secretUsed: 'main' }
  return { ok: false, secretUsed: null }
}

// ── Log helper ──────────────────────────────────────────────────────────────

export interface ComplianceLogInput {
  topic: ComplianceTopic
  shopDomain: string
  shopifyShopId: number | null
  shopifyCustomerId: number | null
  customerEmail: string | null
  workspaceId: string | null
  hmacOk: boolean
  hmacSecretUsed: 'pub' | 'main' | null
  payload: unknown
  shopifyWebhookId: string | null
}

export interface ComplianceWebhookLogRow {
  id: string
  topic: ComplianceTopic
  shop_domain: string
  shopify_shop_id: number | null
  shopify_customer_id: number | null
  customer_email: string | null
  workspace_id: string | null
  hmac_ok: boolean
  hmac_secret_used: 'pub' | 'main' | null
  payload: unknown
  shopify_webhook_id: string | null
  received_at: string
  processed_at: string | null
  processing_error: string | null
}

/**
 * Inserts a row into compliance_webhook_log. Returns the inserted row, or
 * { duplicate: true } if (topic, shopify_webhook_id) already exists.
 */
export async function logComplianceWebhook(
  input: ComplianceLogInput
): Promise<{ row: ComplianceWebhookLogRow } | { duplicate: true }> {
  const result = await supabaseAdmin
    .from('compliance_webhook_log')
    .insert({
      topic: input.topic,
      shop_domain: input.shopDomain,
      shopify_shop_id: input.shopifyShopId,
      shopify_customer_id: input.shopifyCustomerId,
      customer_email: input.customerEmail,
      workspace_id: input.workspaceId,
      hmac_ok: input.hmacOk,
      hmac_secret_used: input.hmacSecretUsed,
      payload: input.payload as Record<string, unknown>,
      shopify_webhook_id: input.shopifyWebhookId,
    })
    .select('*')
    .single()
  const data = result.data as ComplianceWebhookLogRow | null
  const { error } = result

  if (error) {
    if (error.code === '23505') {
      // Unique violation on (topic, shopify_webhook_id) — duplicate retry from Shopify.
      logger.info('[shopify-compliance]', 'duplicate webhook ignored', {
        topic: input.topic,
        shopifyWebhookId: input.shopifyWebhookId,
      })
      return { duplicate: true }
    }
    throw new Error(`compliance_webhook_log insert failed: ${error.message}`)
  }

  return { row: data! }
}

/**
 * Resolves workspace_id (and optionally store_id) from a shop_domain. Returns
 * { workspaceId: null, storeId: null } if no integration row exists.
 */
export async function resolveWorkspaceForShop(
  shopDomain: string
): Promise<{ workspaceId: string | null; storeId: string | null }> {
  const { data } = await supabaseAdmin
    .from('integrations')
    .select('workspace_id, store_id')
    .eq('shopify_domain', shopDomain)
    .maybeSingle()
  if (!data) return { workspaceId: null, storeId: null }
  return {
    workspaceId: (data as { workspace_id: string }).workspace_id,
    storeId: (data as { store_id: string | null }).store_id ?? null,
  }
}

// ── Worker entrypoints (Phase 2 will fill these in) ─────────────────────────

async function markProcessed(logId: string, errorMessage?: string): Promise<void> {
  const update: Record<string, unknown> = errorMessage
    ? { processing_error: errorMessage.slice(0, 1000) }
    : { processed_at: new Date().toISOString() }
  await supabaseAdmin.from('compliance_webhook_log').update(update).eq('id', logId)
}

export async function processCustomersDataRequest(
  log: ComplianceWebhookLogRow
): Promise<void> {
  try {
    const email = log.customer_email
    const workspaceId = log.workspace_id

    if (!workspaceId || !email) {
      await markProcessed(log.id)
      return
    }

    // 1. Find the workspace owner's email.
    const { data: ownerMember } = await supabaseAdmin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
      .maybeSingle()

    if (!ownerMember) {
      throw new Error('No workspace owner found')
    }

    const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(
      (ownerMember as { user_id: string }).user_id
    )
    const ownerEmail = ownerUser?.user?.email
    if (!ownerEmail) {
      throw new Error('Owner user has no email address')
    }

    // 2. Collect everything Lynq holds for this customer.
    const { data: conversations } = await supabaseAdmin
      .from('email_conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('customer_email', email)

    const conversationIds = (conversations || []).map(
      (c) => (c as { id: string }).id
    )

    const messagesQuery = supabaseAdmin
      .from('email_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
    const notesQuery = supabaseAdmin
      .from('conversation_notes')
      .select('*')
      .eq('workspace_id', workspaceId)

    const [{ data: messages }, { data: notes }, { data: tasks }] = await Promise.all([
      conversationIds.length > 0
        ? messagesQuery.in('conversation_id', conversationIds)
        : Promise.resolve({ data: [] as unknown[] }),
      conversationIds.length > 0
        ? notesQuery.in('conversation_id', conversationIds)
        : Promise.resolve({ data: [] as unknown[] }),
      supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('customer_email', email),
    ])

    // 3. Build the JSON payload.
    const jsonAttachment = {
      generated_at: new Date().toISOString(),
      customer: {
        shopify_id: log.shopify_customer_id,
        email,
      },
      shop: {
        id: log.shopify_shop_id,
        domain: log.shop_domain,
      },
      conversations: conversations ?? [],
      messages: messages ?? [],
      notes: notes ?? [],
      tasks: tasks ?? [],
    }

    // 4. Send the email.
    const result = await sendCustomerDataExportEmail({
      to: ownerEmail,
      customerEmail: email,
      shopDomain: log.shop_domain,
      jsonAttachment,
    })

    if (result.status !== 'sent') {
      // 'not_configured' (missing RESEND_API_KEY) and 'failed' both mean the
      // GDPR data request was NOT delivered. Don't silently mark processed.
      throw new Error(result.error || `Email send status: ${result.status}`)
    }

    await markProcessed(log.id)
  } catch (err: unknown) {
    await markWorkerFailed(log.id, err)
  }
}

export async function processCustomersRedact(
  log: ComplianceWebhookLogRow
): Promise<void> {
  try {
    const email = log.customer_email
    const workspaceId = log.workspace_id

    if (!workspaceId || !email) {
      // Nothing to redact. Mark processed and return.
      await markProcessed(log.id)
      return
    }

    const hashed = hashedRedactedEmail(email)

    const { error } = await supabaseAdmin.rpc('compliance_redact_customer', {
      p_workspace: workspaceId,
      p_email: email,
      p_hashed_email: hashed,
    })

    if (error) {
      throw new Error(`compliance_redact_customer RPC failed: ${error.message}`)
    }

    await markProcessed(log.id)
  } catch (err: unknown) {
    await markWorkerFailed(log.id, err)
  }
}

export async function processShopRedact(log: ComplianceWebhookLogRow): Promise<void> {
  try {
    // Re-resolve store_id at worker time. log.workspace_id was captured at
    // ingest, but the integration row could be in either state by now; we
    // re-fetch to be sure we have the freshest mapping.
    const { workspaceId, storeId } = await resolveWorkspaceForShop(log.shop_domain)

    if (!workspaceId) {
      // Integration row already gone (typical for shop/redact 48h after uninstall).
      // Nothing more we can do; the orphaned data can't be reliably matched
      // to this shop. Mark processed.
      await markProcessed(log.id)
      return
    }

    const { error } = await supabaseAdmin.rpc('compliance_redact_shop', {
      p_workspace: workspaceId,
      p_shop_domain: log.shop_domain,
      p_store_id: storeId,
    })

    if (error) {
      throw new Error(`compliance_redact_shop RPC failed: ${error.message}`)
    }

    await markProcessed(log.id)
  } catch (err: unknown) {
    await markWorkerFailed(log.id, err)
  }
}

export async function markWorkerFailed(
  logId: string,
  err: unknown
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  logger.error('[shopify-compliance]', 'worker failed', { logId, error: message })
  await markProcessed(logId, message)
}
