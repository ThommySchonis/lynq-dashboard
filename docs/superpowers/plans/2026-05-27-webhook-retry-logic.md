# Webhook Retry Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-healing webhook retry system with progressive backoff, dead-lettering, and admin panel management.

**Architecture:** Failed webhooks are automatically retried by a Supabase Edge Function cron (every 5 min) that calls internal Next.js retry endpoints. After 8 attempts (~7.5 hours), events are dead-lettered and surfaced in the admin panel for manual retry or dismissal.

**Tech Stack:** Next.js 16 (app router), Supabase (pg_cron, Edge Functions), TanStack React Query, shadcn UI

**Spec:** `docs/superpowers/specs/2026-05-27-webhook-retry-logic-design.md`

---

## File Map

### New files
| File | Responsibility |
|------|----------------|
| `supabase/migrations/YYYYMMDD_webhook_retry.sql` | Schema changes: CHECK constraint, metadata column, indexes, pg_cron |
| `lib/services/webhookHandlers.ts` | Pure handler functions extracted from 4 webhook routes |
| `lib/services/webhookRetry.ts` | Shared retry constants and `computeNextRetryAt()` helper |
| `app/api/webhooks/retry/shopify/route.ts` | Internal retry endpoint for Shopify |
| `app/api/webhooks/retry/whop/route.ts` | Internal retry endpoint for Whop |
| `app/api/webhooks/retry/email/route.ts` | Internal retry endpoint for Email |
| `app/api/webhooks/retry/parcelpanel/route.ts` | Internal retry endpoint for ParcelPanel |
| `supabase/functions/webhook-retry/index.ts` | Cron Edge Function: query failed events, dispatch retries |
| `app/api/admin/webhooks/route.ts` | Admin GET: list webhook events with filters |
| `app/api/admin/webhooks/retry/route.ts` | Admin POST: reset events for retry |
| `app/api/admin/webhooks/dismiss/route.ts` | Admin POST: dismiss dead-lettered events |
| `app/admin/webhooks/page.tsx` | Admin page shell |
| `components/features/admin/webhooks/webhooks-view.tsx` | Admin webhooks UI |
| `hooks/admin/use-admin-webhooks.ts` | TanStack Query hooks for webhook admin |

### Modified files
| File | Change |
|------|--------|
| `lib/services/webhookIdempotency.ts` | Retry scheduling on failure, dead-letter logic, metadata, respect scheduled retries |
| `app/api/webhooks/shopify/route.ts` | Extract handler to shared module, pass metadata |
| `app/api/webhooks/whop/route.ts` | Extract handler to shared module |
| `app/api/webhooks/email/inbound/route.ts` | Extract handler to shared module |
| `app/api/parcel-panel/webhook/[token]/route.ts` | Extract handler to shared module |
| `supabase/functions/webhook-cleanup/index.ts` | Exclude `dead_letter` from cleanup |
| `lib/admin-constants.ts` | Add Webhooks nav entry + TAB_META |
| `hooks/admin/index.ts` | Re-export webhook hooks |
| `CLAUDE.md` | Add `WEBHOOK_RETRY_SECRET` to environment variables section |

**Note:** `proxy.ts` does NOT need modification — the existing `'/api/webhooks/'` prefix in `AUTH_BYPASS_PREFIXES` already covers `/api/webhooks/retry/*` via `startsWith` matching.

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDD_webhook_retry.sql`

- [ ] **Step 1: Generate migration file**

Run: `cd lynq-dashboard && npx supabase migration new webhook_retry`

- [ ] **Step 2: Write migration SQL**

Write the generated file with:

```sql
-- ============================================================
-- Webhook retry system: schema changes + cron schedule
--
-- 1. Update CHECK constraint to allow dead_letter + dismissed
-- 2. Add metadata column for retry context
-- 3. Update/add indexes for retry processor queries
-- 4. Schedule webhook-retry Edge Function via pg_cron
--
-- Idempotent. Single transaction.
-- ============================================================

begin;

-- 1. Replace status CHECK constraint
alter table public.webhook_events
  drop constraint chk_webhook_event_status;

alter table public.webhook_events
  add constraint chk_webhook_event_status
  check (status in ('processing', 'completed', 'failed', 'dead_letter', 'dismissed'));

-- 2. Add metadata column
alter table public.webhook_events
  add column if not exists metadata jsonb default null;

-- 3. Replace partial index on status (old filter was: status != 'completed')
drop index if exists idx_webhook_events_status;

create index idx_webhook_events_status
  on public.webhook_events (status)
  where status not in ('completed', 'dismissed');

-- 4. Add composite index for retry processor queries
create index if not exists idx_webhook_events_retry
  on public.webhook_events (status, next_retry_at)
  where status not in ('completed', 'dismissed');

-- 5. Schedule webhook-retry Edge Function (every 5 minutes)
select cron.unschedule('webhook-retry-5min')
where exists (
  select 1 from cron.job where jobname = 'webhook-retry-5min'
);

select cron.schedule(
  'webhook-retry-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/webhook-retry',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verification
do $$
declare
  v_has_metadata bool;
  v_constraint_ok bool;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'webhook_events'
      and column_name = 'metadata'
  ) into v_has_metadata;
  if not v_has_metadata then
    raise exception 'metadata column missing from webhook_events';
  end if;

  -- Verify the new CHECK allows dead_letter
  begin
    insert into public.webhook_events (event_id, source, event_type, payload, status)
    values ('__verify_check__', 'shopify', 'test', '{}', 'dead_letter');
    delete from public.webhook_events where event_id = '__verify_check__';
  exception when check_violation then
    raise exception 'CHECK constraint does not allow dead_letter status';
  end;

  raise notice 'OK — webhook_retry migration verified';
end $$;

commit;

notify pgrst, 'reload schema';
```

- [ ] **Step 3: Apply migration**

Run: `cd lynq-dashboard && npx supabase db push`
Expected: Migration applies without errors.

---

## Task 2: Retry Constants Module

**Files:**
- Create: `lib/services/webhookRetry.ts`

- [ ] **Step 1: Create the shared constants file**

```typescript
// Progressive backoff delays: 30s, 2m, 10m, 30m, 1h, 2h, 4h
export const RETRY_DELAYS_MS = [
  30_000,
  120_000,
  600_000,
  1_800_000,
  3_600_000,
  7_200_000,
  14_400_000,
] as const

export const MAX_ATTEMPTS = 8

/**
 * Compute the next retry timestamp based on attempt count.
 * Returns null when max attempts are exhausted (dead letter).
 */
export function computeNextRetryAt(attemptCount: number): string | null {
  const index = attemptCount - 1
  if (index < 0 || index >= RETRY_DELAYS_MS.length) return null
  return new Date(Date.now() + RETRY_DELAYS_MS[index]).toISOString()
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd lynq-dashboard && npx eslint lib/services/webhookRetry.ts`
Expected: No errors.

---

## Task 3: Extract Shopify Webhook Handler

**Files:**
- Create: `lib/services/webhookHandlers.ts`
- Modify: `app/api/webhooks/shopify/route.ts`

- [ ] **Step 1: Create webhookHandlers.ts with Shopify handler**

Extract `upsertOrder()` and the topic-based handler logic from `app/api/webhooks/shopify/route.ts` (lines 49-211) into a pure function. The function accepts parsed data and throws on error — no Request/Response objects.

```typescript
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

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
```

- [ ] **Step 2: Update Shopify webhook route to use shared handler**

Modify `app/api/webhooks/shopify/route.ts`:
- Remove `upsertOrder()` and all inline handler logic (the topic-based `if` blocks inside `handler:`)
- Import `handleShopifyWebhook` from `@/lib/services/webhookHandlers`
- In the `withIdempotency` call, replace the `handler` callback body with a call to the shared function
- Add `metadata: { storeId, clientId: resolvedClientId }` to the `withIdempotency` options

The handler callback becomes:

```typescript
handler: async (body) => {
  const payload = body as Record<string, unknown>
  const result = await handleShopifyWebhook(
    topic || 'unknown',
    payload,
    resolvedWorkspaceId,
    storeId,
    resolvedClientId
  )
  return {
    response: NextResponse.json({ ok: true }),
    workspaceId: result.workspaceId,
  }
},
metadata: { storeId, clientId: resolvedClientId },
```

- [ ] **Step 3: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint lib/services/webhookHandlers.ts app/api/webhooks/shopify/route.ts`
Expected: No errors.

---

## Task 4: Extract Whop Webhook Handler

**Files:**
- Modify: `lib/services/webhookHandlers.ts`
- Modify: `app/api/webhooks/whop/route.ts`

- [ ] **Step 1: Move Whop handler functions to webhookHandlers.ts**

Move these functions from `app/api/webhooks/whop/route.ts` to `lib/services/webhookHandlers.ts`:
- `isoFromMaybeUnix()`
- `_findSubscription()`
- `resolveWorkspaceIdFromMembership()`
- `handleMembershipActivated()`
- `handleMembershipDeactivated()`
- `handleMembershipCancelAtPeriodEndChanged()`
- `handlePaymentSucceeded()`
- `unlockAndResetForMembership()`
- `handlePaymentFailed()`

Add the type imports (`WhopMembership`, `WhopPayment` from `@/lib/whop`) and the `unlockWorkspace` import.

Then add the top-level dispatcher:

```typescript
// ─── Whop ─────────────────────────────────────────────────────

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
```

- [ ] **Step 2: Update Whop webhook route to use shared handler**

Modify `app/api/webhooks/whop/route.ts`:
- Remove all moved functions (keep only signature verification + `getEventType()`)
- Import `handleWhopWebhook` from `@/lib/services/webhookHandlers`
- Replace the `handler` callback in `withIdempotency`:

```typescript
handler: async () => {
  const result = await handleWhopWebhook(eventType, envelope as Record<string, unknown>)
  return {
    response: NextResponse.json({ received: true, event: eventType }),
    workspaceId: result.workspaceId,
  }
},
```

- [ ] **Step 3: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint lib/services/webhookHandlers.ts app/api/webhooks/whop/route.ts`
Expected: No errors.

---

## Task 5: Extract Email Webhook Handler

**Files:**
- Modify: `lib/services/webhookHandlers.ts`
- Modify: `app/api/webhooks/email/inbound/route.ts`

- [ ] **Step 1: Add Email handler to webhookHandlers.ts**

```typescript
// ─── Email ────────────────────────────────────────────────────

import { processInboundMessage } from '@/lib/conversationEngine'

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
```

- [ ] **Step 2: Update Email webhook route to use shared handler**

Modify `app/api/webhooks/email/inbound/route.ts`:
- Remove inline handler logic
- Import `handleEmailWebhook` from `@/lib/services/webhookHandlers`
- Replace the `handler` callback:

```typescript
handler: async (body) => {
  const result = await handleEmailWebhook(body as Record<string, unknown>)
  return {
    response: NextResponse.json({ ok: true }),
    workspaceId: result.workspaceId,
  }
},
```

- [ ] **Step 3: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint lib/services/webhookHandlers.ts app/api/webhooks/email/inbound/route.ts`
Expected: No errors.

---

## Task 6: Extract ParcelPanel Webhook Handler

**Files:**
- Modify: `lib/services/webhookHandlers.ts`
- Modify: `app/api/parcel-panel/webhook/[token]/route.ts`

- [ ] **Step 1: Add ParcelPanel handler to webhookHandlers.ts**

```typescript
// ─── ParcelPanel ──────────────────────────────────────────────

import { parcelPanelWebhookPayload } from '@/lib/schemas/parcel-panel'

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
```

- [ ] **Step 2: Update ParcelPanel webhook route to use shared handler**

Modify `app/api/parcel-panel/webhook/[token]/route.ts`:
- Remove inline handler logic
- Import `handleParcelPanelWebhook` from `@/lib/services/webhookHandlers`
- Replace the `handler` callback:

```typescript
handler: async (body) => {
  const result = await handleParcelPanelWebhook(body, workspace_id, store_id)
  return { response: OK(), workspaceId: result.workspaceId }
},
metadata: { storeId: store_id },
```

- [ ] **Step 3: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint lib/services/webhookHandlers.ts app/api/parcel-panel/webhook/\\[token\\]/route.ts`
Expected: No errors.

---

## Task 7: Update `withIdempotency` for Retry Support

**Files:**
- Modify: `lib/services/webhookIdempotency.ts`

- [ ] **Step 1: Add imports and metadata to interface**

At the top of the file, add:

```typescript
import { computeNextRetryAt, MAX_ATTEMPTS } from '@/lib/services/webhookRetry'
```

Add `metadata` to the `WithIdempotencyOptions` interface:

```typescript
interface WithIdempotencyOptions {
  rawBody: string
  request: Request
  source: WebhookSource
  eventType: string
  extractEventId: (request: Request, body: unknown) => string | null
  workspaceId?: string
  metadata?: Record<string, unknown>  // <-- add this
  handler: (body: unknown) => Promise<HandlerResult>
}
```

- [ ] **Step 2: Pass metadata through to insert calls**

In the initial insert (line 52-62), add `metadata: options.metadata ?? null` to the insert object.

Also add it to the retry re-insert (line 93-101) and stale re-insert (line 126-135).

- [ ] **Step 3: Update the failed event re-delivery logic**

First, update the existing select on the conflicting row (line 70) to include `next_retry_at`:

```typescript
.select('id, status, created_at, attempt_count, next_retry_at')
```

Then replace the failed event handling block (lines 86-109). When a provider re-delivers a failed event:

```typescript
if (existing.status === 'failed') {
  // If our retry system has a future retry scheduled, let it handle it
  if (existing.next_retry_at && new Date(existing.next_retry_at as string) > new Date()) {
    logger.info(`[webhook/${source}]`, 'retry scheduled, deferring to retry system', { eventId })
    return NextResponse.json({ received: true, duplicate: true })
  }
  // Otherwise allow provider retry to proceed (our system hasn't picked it up)
  logger.warn(`[webhook/${source}]`, 'retrying previously failed event', { eventId })
  await supabaseAdmin
    .from('webhook_events')
    .delete()
    .eq('id', existing.id)

  const { error: retryInsertError } = await supabaseAdmin
    .from('webhook_events')
    .insert({
      event_id: eventId,
      source,
      event_type: eventType,
      payload: body,
      status: 'processing',
      workspace_id: options.workspaceId ?? null,
      metadata: options.metadata ?? null,
      attempt_count: ((existing.attempt_count as number) ?? 1) + 1,
    })

  if (retryInsertError) {
    logger.info(`[webhook/${source}]`, 'lost race on failed retry re-insert', { eventId })
    return NextResponse.json({ received: true, duplicate: true })
  }
  // Fall through to execute handler
}
```

Add a dead_letter check after the failed block:

```typescript
if (existing.status === 'dead_letter' || existing.status === 'dismissed') {
  logger.info(`[webhook/${source}]`, 'event is dead-lettered/dismissed, skipping', { eventId })
  return NextResponse.json({ received: true, duplicate: true })
}
```

- [ ] **Step 4: Update the failure handler to schedule retries**

Replace the failure update block (lines 170-179):

```typescript
} catch (err) {
  const durationMs = Date.now() - startTime
  const errorMessage = err instanceof Error ? err.message : String(err)

  // Determine current attempt count
  const { data: currentEvent } = await supabaseAdmin
    .from('webhook_events')
    .select('attempt_count')
    .eq('source', source)
    .eq('event_id', eventId)
    .single()

  const attemptCount = (currentEvent?.attempt_count as number) ?? 1
  const nextRetry = computeNextRetryAt(attemptCount)
  const newStatus = attemptCount >= MAX_ATTEMPTS ? 'dead_letter' : 'failed'

  await supabaseAdmin
    .from('webhook_events')
    .update({
      status: newStatus,
      error_message: errorMessage,
      processing_duration_ms: durationMs,
      next_retry_at: nextRetry,
    })
    .eq('source', source)
    .eq('event_id', eventId)

  logger.error(`[webhook/${source}]`, 'handler error', {
    error: errorMessage,
    status: newStatus,
    nextRetry,
  })
  Sentry.captureException(err, {
    tags: { webhook_source: source, event_type: eventType },
    extra: { event_id: eventId, duration_ms: durationMs, status: newStatus },
  })
  return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
}
```

- [ ] **Step 5: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint lib/services/webhookIdempotency.ts`
Expected: No errors.

---

## Task 8: Internal Retry Endpoints

**Files:**
- Create: `app/api/webhooks/retry/shopify/route.ts`
- Create: `app/api/webhooks/retry/whop/route.ts`
- Create: `app/api/webhooks/retry/email/route.ts`
- Create: `app/api/webhooks/retry/parcelpanel/route.ts`

- [ ] **Step 1: Create Shopify retry endpoint**

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { handleShopifyWebhook } from '@/lib/services/webhookHandlers'
import { logger } from '@/lib/logger'

interface RetryRequest {
  event_type: string
  payload: Record<string, unknown>
  workspace_id: string | null
  metadata: Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-retry-secret')
  if (!secret || secret !== process.env.WEBHOOK_RETRY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as RetryRequest

  try {
    await handleShopifyWebhook(
      body.event_type,
      body.payload,
      body.workspace_id || '',
      (body.metadata?.storeId as string) || null,
      (body.metadata?.clientId as string) || ''
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('[webhook-retry/shopify]', 'handler failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create Whop retry endpoint**

Same pattern, calling `handleWhopWebhook(body.event_type, body.payload)`.

- [ ] **Step 3: Create Email retry endpoint**

Same pattern, calling `handleEmailWebhook(body.payload)`.

- [ ] **Step 4: Create ParcelPanel retry endpoint**

Same pattern, calling `handleParcelPanelWebhook(body.payload, body.workspace_id || '', (body.metadata?.storeId as string) || '')`.

- [ ] **Step 5: Add retry prefix to AUTH_BYPASS_PREFIXES in proxy.ts**

The existing `/api/webhooks/` prefix in `AUTH_BYPASS_PREFIXES` already covers `/api/webhooks/retry/*`, so no change is needed — verify this by reading `proxy.ts` and confirming the prefix match logic uses `startsWith`.

- [ ] **Step 6: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint app/api/webhooks/retry/`
Expected: No errors.

---

## Task 9: Retry Processor Edge Function

**Files:**
- Create: `supabase/functions/webhook-retry/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const appBaseUrl = Deno.env.get('APP_BASE_URL')!
const retrySecret = Deno.env.get('WEBHOOK_RETRY_SECRET')!

const supabase = createClient(supabaseUrl, supabaseKey)

// Same schedule as lib/services/webhookRetry.ts
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000]
const MAX_ATTEMPTS = 8

function computeNextRetryAt(attemptCount: number): string | null {
  const index = attemptCount - 1
  if (index < 0 || index >= RETRY_DELAYS_MS.length) return null
  return new Date(Date.now() + RETRY_DELAYS_MS[index]).toISOString()
}

const RETRY_ENDPOINTS: Record<string, string> = {
  shopify: '/api/webhooks/retry/shopify',
  whop: '/api/webhooks/retry/whop',
  email: '/api/webhooks/retry/email',
  parcelpanel: '/api/webhooks/retry/parcelpanel',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  // 1. Reset stale processing events from previous retry cycles
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: staleEvents } = await supabase
    .from('webhook_events')
    .update({ status: 'failed' })
    .eq('status', 'processing')
    .gt('attempt_count', 0)
    .lt('created_at', staleThreshold)
    .select('id')

  if (staleEvents?.length) {
    console.log(`[webhook-retry] reset ${staleEvents.length} stale processing events`)
  }

  // 2. Fetch failed events due for retry
  const { data: events, error: fetchError } = await supabase
    .from('webhook_events')
    .select('id, event_id, source, event_type, payload, workspace_id, metadata, attempt_count')
    .eq('status', 'failed')
    .lte('next_retry_at', new Date().toISOString())
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('next_retry_at', { ascending: true })
    .limit(20)

  if (fetchError) {
    console.error('[webhook-retry] fetch failed:', fetchError.message)
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!events?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let completed = 0
  let rescheduled = 0
  let deadLettered = 0

  for (const event of events) {
    const endpoint = RETRY_ENDPOINTS[event.source]
    if (!endpoint) {
      console.warn(`[webhook-retry] unknown source: ${event.source}`)
      continue
    }

    // Mark as processing to prevent concurrent pickup
    await supabase
      .from('webhook_events')
      .update({ status: 'processing' })
      .eq('id', event.id)

    const startTime = Date.now()

    try {
      const res = await fetch(`${appBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-retry-secret': retrySecret,
        },
        body: JSON.stringify({
          event_id: event.event_id,
          event_type: event.event_type,
          payload: event.payload,
          workspace_id: event.workspace_id,
          metadata: event.metadata,
        }),
      })

      const durationMs = Date.now() - startTime

      if (res.ok) {
        await supabase
          .from('webhook_events')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            processing_duration_ms: durationMs,
          })
          .eq('id', event.id)
        completed++
      } else {
        const newAttemptCount = (event.attempt_count ?? 1) + 1
        const nextRetry = computeNextRetryAt(newAttemptCount)
        const newStatus = newAttemptCount >= MAX_ATTEMPTS ? 'dead_letter' : 'failed'

        let errorMessage = `HTTP ${res.status}`
        try {
          const errBody = await res.json()
          errorMessage = errBody.error || errorMessage
        } catch { /* ignore */ }

        await supabase
          .from('webhook_events')
          .update({
            status: newStatus,
            attempt_count: newAttemptCount,
            next_retry_at: nextRetry,
            error_message: errorMessage,
            processing_duration_ms: durationMs,
          })
          .eq('id', event.id)

        if (newStatus === 'dead_letter') {
          deadLettered++
        } else {
          rescheduled++
        }
      }
    } catch (err) {
      // Network error — increment attempt count and schedule next retry
      const errorMessage = err instanceof Error ? err.message : String(err)
      const newAttemptCount = (event.attempt_count ?? 1) + 1
      const nextRetry = computeNextRetryAt(newAttemptCount)
      const newStatus = newAttemptCount >= MAX_ATTEMPTS ? 'dead_letter' : 'failed'

      await supabase
        .from('webhook_events')
        .update({
          status: newStatus,
          attempt_count: newAttemptCount,
          next_retry_at: nextRetry,
          error_message: `Retry fetch error: ${errorMessage}`,
        })
        .eq('id', event.id)

      if (newStatus === 'dead_letter') {
        deadLettered++
      } else {
        rescheduled++
      }
    }
  }

  const summary = `[webhook-retry] processed ${events.length} events: ${completed} completed, ${rescheduled} rescheduled, ${deadLettered} dead-lettered`
  console.log(summary)

  return new Response(
    JSON.stringify({ processed: events.length, completed, rescheduled, deadLettered }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

- [ ] **Step 2: Set Edge Function secrets**

Run (requires Supabase CLI access to the remote project):
```bash
cd lynq-dashboard
npx supabase secrets set APP_BASE_URL=https://lynq-dashboard.vercel.app
npx supabase secrets set WEBHOOK_RETRY_SECRET=<generate-a-random-secret>
```

Also add `WEBHOOK_RETRY_SECRET` to Vercel environment variables (for the retry endpoints).

---

## Task 10: Update Webhook Cleanup Edge Function

**Files:**
- Modify: `supabase/functions/webhook-cleanup/index.ts`

- [ ] **Step 1: Exclude dead_letter from cleanup**

Change the delete query from:

```typescript
.neq('status', 'processing')
```

to:

```typescript
.not('status', 'in', '("processing","dead_letter")')
```

- [ ] **Step 2: Verify the change is correct**

The cleanup should now delete events older than 90 days where status is `completed`, `failed`, or `dismissed` — but NOT `processing` or `dead_letter`.

---

## Task 11: Admin API Routes

**Files:**
- Create: `app/api/admin/webhooks/route.ts`
- Create: `app/api/admin/webhooks/retry/route.ts`
- Create: `app/api/admin/webhooks/dismiss/route.ts`

- [ ] **Step 1: Create GET /api/admin/webhooks (list endpoint)**

```typescript
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/admin-constants'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'dead_letter'
  const source = searchParams.get('source')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = 25
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('webhook_events')
    .select('id, event_id, source, event_type, status, error_message, attempt_count, next_retry_at, workspace_id, metadata, created_at, completed_at', { count: 'exact' })

  // Filter by status — support comma-separated values (e.g., "dead_letter,failed")
  const statuses = status.split(',').map((s) => s.trim())
  if (statuses.length === 1) {
    query = query.eq('status', statuses[0])
  } else {
    query = query.in('status', statuses)
  }

  if (source) {
    query = query.eq('source', source)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [], total: count ?? 0, page, limit })
}
```

- [ ] **Step 2: Create POST /api/admin/webhooks/retry**

```typescript
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/admin-constants'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ids } = (await request.json()) as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const { error, count } = await supabaseAdmin
    .from('webhook_events')
    .update({
      status: 'failed',
      attempt_count: 0,
      next_retry_at: new Date().toISOString(),
    })
    .in('id', ids)
    .in('status', ['dead_letter'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: count ?? 0 })
}
```

- [ ] **Step 3: Create POST /api/admin/webhooks/dismiss**

Same auth pattern. Updates matching events to `status = 'dismissed'`:

```typescript
const { error, count } = await supabaseAdmin
  .from('webhook_events')
  .update({ status: 'dismissed' })
  .in('id', ids)
  .in('status', ['dead_letter'])
```

- [ ] **Step 4: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint app/api/admin/webhooks/`
Expected: No errors.

---

## Task 12: Admin Panel Constants + Page

**Files:**
- Modify: `lib/admin-constants.ts`
- Create: `app/admin/webhooks/page.tsx`

- [ ] **Step 1: Add Webhooks to ADMIN_NAV and TAB_META**

In `lib/admin-constants.ts`:

Add `AlertTriangle` (or `RefreshCw`) to the lucide-react import.

Add a new nav item. Place it in the existing OVERVIEW group or create a SYSTEM group:

```typescript
{ group: 'SYSTEM', items: [
  { id: 'webhooks', label: 'Webhooks', icon: RefreshCw, href: '/admin/webhooks' },
]},
```

Add to `TAB_META`:

```typescript
webhooks: { title: 'Webhooks', sub: 'Failed and dead-lettered webhook events' },
```

- [ ] **Step 2: Create the admin page shell**

Create `app/admin/webhooks/page.tsx`:

```typescript
import { WebhooksView } from '@/components/features/admin/webhooks/webhooks-view'

export default function WebhooksPage() {
  return <WebhooksView />
}
```

- [ ] **Step 3: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint lib/admin-constants.ts app/admin/webhooks/page.tsx`
Expected: No errors.

---

## Task 13: Admin Webhooks Hooks

**Files:**
- Create: `hooks/admin/use-admin-webhooks.ts`
- Modify: `hooks/admin/index.ts`

- [ ] **Step 1: Create the TanStack Query hooks**

@component-rules

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { adminKeys } from './use-admin-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

interface WebhookEvent {
  id: string
  event_id: string
  source: string
  event_type: string
  status: string
  error_message: string | null
  attempt_count: number
  next_retry_at: string | null
  workspace_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

interface WebhookListResponse {
  events: WebhookEvent[]
  total: number
  page: number
  limit: number
}

export const webhookKeys = {
  all: [...adminKeys.all, 'webhooks'] as const,
  list: (filters: Record<string, string>) =>
    [...webhookKeys.all, 'list', filters] as const,
}

export function useWebhookEvents(filters: {
  status?: string
  source?: string
  page?: number
}) {
  const token = useToken()
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.source) params.set('source', filters.source)
  if (filters.page) params.set('page', String(filters.page))

  return useQuery<WebhookListResponse>({
    queryKey: webhookKeys.list(Object.fromEntries(params)),
    queryFn: async () => {
      const res = await fetch(`/api/admin/webhooks?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch webhook events')
      return parseJson<WebhookListResponse>(res)
    },
    enabled: !!token,
    staleTime: 30_000,
  })
}

export function useRetryWebhooks() {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch('/api/admin/webhooks/retry', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error('Failed to retry webhooks')
      return parseJson<{ ok: boolean; updated: number }>(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}

export function useDismissWebhooks() {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch('/api/admin/webhooks/dismiss', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error('Failed to dismiss webhooks')
      return parseJson<{ ok: boolean; updated: number }>(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}
```

- [ ] **Step 2: Update hooks/admin/index.ts**

Add the re-export:

```typescript
export * from './use-admin-webhooks'
```

- [ ] **Step 3: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint hooks/admin/`
Expected: No errors.

---

## Task 14: Admin Webhooks View Component

**Files:**
- Create: `components/features/admin/webhooks/webhooks-view.tsx`

- [ ] **Step 1: Create the component**

@component-rules

Build the webhooks admin view following the existing admin component patterns (e.g., `clients-list.tsx`):

- `'use client'` directive
- Uses `useWebhookEvents`, `useRetryWebhooks`, `useDismissWebhooks` hooks
- shadcn `Card`, `Button`, `Badge`, `Select` components
- Status filter dropdown (default: `dead_letter`, options: `dead_letter`, `failed`, `dead_letter,failed`)
- Source filter dropdown (All, Shopify, Whop, Email, ParcelPanel)
- Events table with columns: Source, Event Type, Error, Attempts, Created, Last Retry (`next_retry_at` formatted as relative time — shows when the last retry was scheduled), Workspace (may be empty), Actions
- Row expansion via click to show formatted `payload` JSON in a `<pre>` block
- Per-row Retry and Dismiss buttons (only for `dead_letter` status)
- Bulk selection with "Retry Selected" / "Dismiss Selected" buttons
- Pagination controls (Previous / Next) based on `total` and `page`
- Color-coded status badges: `dead_letter` = red, `failed` = amber, `dismissed` = gray

This is a standard admin CRUD view — follow the patterns in existing admin components for styling and layout. The component should be approximately 150-250 lines.

- [ ] **Step 2: Verify lint passes**

Run: `cd lynq-dashboard && npx eslint components/features/admin/webhooks/`
Expected: No errors.

---

## Task 15: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add WEBHOOK_RETRY_SECRET to environment variables**

In the CLAUDE.md environment variables section, add `WEBHOOK_RETRY_SECRET` to the list of server-only variables:

```
**Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (server-only), `OAUTH_STATE_SECRET`, `EMAIL_WEBHOOK_SECRET`, `WHOP_WEBHOOK_SECRET`, `WEBHOOK_RETRY_SECRET` (server-only), `PAYMENTS_ENABLED`. Stored in `.env.local` and Vercel Settings.
```

---

## Task 16: Full Lint Check

- [ ] **Step 1: Run project-wide lint**

Run: `cd lynq-dashboard && npm run lint`
Expected: No new errors. Fix any that appear.

- [ ] **Step 2: Verify the app builds**

Run: `cd lynq-dashboard && npm run build`
Expected: Build succeeds without errors.

---

## Task 17: Deploy Edge Functions

- [ ] **Step 1: Deploy webhook-retry Edge Function**

Run: `cd lynq-dashboard && npx supabase functions deploy webhook-retry`
Expected: Function deploys successfully.

- [ ] **Step 2: Deploy updated webhook-cleanup Edge Function**

Run: `cd lynq-dashboard && npx supabase functions deploy webhook-cleanup`
Expected: Function deploys successfully.

- [ ] **Step 3: Apply migration (if not done in Task 1)**

Run: `cd lynq-dashboard && npx supabase db push`
Expected: Migration applies, pg_cron job is scheduled.
