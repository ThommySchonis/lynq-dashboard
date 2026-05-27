# Webhook Retry Logic — Design Spec

## Problem

When a webhook handler fails (Supabase unreachable, downstream API timeout, transient error), the system relies entirely on the external provider (Shopify, Whop, etc.) to retry. If the provider gives up or the outage outlasts the provider's retry window, that data is permanently lost.

## Goal

A self-healing retry system that automatically re-processes failed webhooks on a progressive backoff schedule, independent of provider retry behavior. After exhausting retries, events are surfaced in the admin panel for manual intervention.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Retry strategy | Progressive backoff with dead-letter | Handles transient issues quickly, backs off for longer outages, prevents infinite loops |
| Max attempts | 8 (over ~7.5 hours) | Covers most provider incidents without leaving failures unaddressed too long |
| Dead-letter notification | Admin panel only | Email notifications unnecessary for now; admin panel provides inspection and retry tools |
| Retry processor runtime | Supabase Edge Function (cron) | Matches architecture rule: scheduled jobs run as Edge Functions, independent of Next.js |
| Cron interval | Every 5 minutes | Conservative, low invocation cost |
| Handler reuse strategy | Internal retry HTTP endpoints | Keeps handler logic in one place (Node.js), Edge Function stays a thin scheduler |

## Backoff Schedule

| Attempt | Delay | Cumulative |
|---------|-------|------------|
| 1 | 30s | 30s |
| 2 | 2m | 2.5m |
| 3 | 10m | 12.5m |
| 4 | 30m | 42.5m |
| 5 | 1h | 1h 42m |
| 6 | 2h | 3h 42m |
| 7 | 4h | 7h 42m |
| 8 | dead letter | — |

## Status Lifecycle

```
processing → completed     (success)
processing → failed        (handler error, retry scheduled via next_retry_at)
failed     → processing    (retry processor picks it up)
failed     → dead_letter   (attempt_count reaches 8)
dead_letter → failed       (admin manual retry)
dead_letter → dismissed    (admin reviewed, not retryable)
```

---

## Component 1: Schema Changes

### `webhook_events` table updates

**New status values:** `dead_letter`, `dismissed` (in addition to existing `processing`, `completed`, `failed`).

**New column:**

| Column | Type | Purpose |
|--------|------|---------|
| `metadata` | `jsonb` | Source-specific context needed for retries (e.g., Shopify's `store_id`, `client_id`) |

**Existing columns now used:**

- `next_retry_at` (already exists, currently unused) — set by `withIdempotency` on failure, read by retry processor
- `attempt_count` (already exists) — incremented on each retry

**Cleanup update:** The `webhook-cleanup` Edge Function's delete query changes from `status != 'processing'` to `status NOT IN ('processing', 'dead_letter')` — dead-lettered events persist until admin resolves them. Dismissed events follow normal 90-day cleanup.

### Migration

Single migration file covering:

- Drop existing CHECK constraint `chk_webhook_event_status` and replace with: `CHECK (status IN ('processing', 'completed', 'failed', 'dead_letter', 'dismissed'))`
- Add `metadata` jsonb column (nullable, default null)
- Drop and recreate partial index on `status`: `WHERE status NOT IN ('completed', 'dismissed')`
- Add composite partial index `(status, next_retry_at)` with filter `WHERE status NOT IN ('completed', 'dismissed')` for efficient retry processor queries
- Configure pg_cron schedule for the `webhook-retry` Edge Function (every 5 minutes)

---

## Component 2: Handler Extraction

### New file: `lib/services/webhookHandlers.ts`

Four exported pure service functions extracted from the existing webhook routes:

| Function | Source Route | Logic Extracted |
|----------|-------------|-----------------|
| `handleShopifyWebhook(eventType, payload, workspaceId, storeId, clientId)` | `app/api/webhooks/shopify/route.ts` | `upsertOrder()`, order cancel, refund processing |
| `handleWhopWebhook(eventType, payload)` | `app/api/webhooks/whop/route.ts` | `handleMembershipActivated()`, `handleMembershipDeactivated()`, `handleMembershipCancelAtPeriodEndChanged()`, `handlePaymentSucceeded()`, `handlePaymentFailed()` |
| `handleEmailWebhook(payload)` | `app/api/webhooks/email/inbound/route.ts` | Account lookup, verification check, `processInboundMessage()` |
| `handleParcelPanelWebhook(payload, workspaceId, storeId)` | `app/api/parcel-panel/webhook/[token]/route.ts` | Shipment upsert |

**Constraints:**

- Pure functions: accept parsed data, return result or throw on error. No `Request`/`Response` objects.
- No signature verification (already verified on first receipt; not needed on retry).
- The original webhook routes become thin wrappers: verify signature → extract IDs → call `withIdempotency()` which calls the shared handler.

### Metadata storage

When `withIdempotency` inserts the `webhook_events` row, it also stores source-specific context in the `metadata` column so the retry processor has everything it needs:

| Source | Metadata stored |
|--------|----------------|
| Shopify | `{ storeId, clientId }` |
| Whop | `{}` (event type + payload sufficient) |
| Email | `{}` (account lookup uses payload) |
| ParcelPanel | `{ storeId }` |

The `WithIdempotencyOptions` interface gains an optional `metadata?: Record<string, unknown>` field.

---

## Component 3: `withIdempotency` Updates

### Change 1: Set `next_retry_at` on failure

In the failure branch (current lines 168-179), after setting `status: 'failed'`, compute `next_retry_at` from the backoff schedule:

```ts
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000]
const MAX_ATTEMPTS = 8

function computeNextRetryAt(attemptCount: number): string | null {
  const index = attemptCount - 1
  if (index >= RETRY_DELAYS_MS.length) return null // dead letter
  return new Date(Date.now() + RETRY_DELAYS_MS[index]).toISOString()
}
```

On failure:
- If `attemptCount < MAX_ATTEMPTS`: set `status = 'failed'`, `next_retry_at = computeNextRetryAt(attemptCount)`
- If `attemptCount >= MAX_ATTEMPTS`: set `status = 'dead_letter'`, `next_retry_at = null`

### Change 2: Respect scheduled retries on provider re-delivery

Currently, when a provider re-delivers a failed event, `withIdempotency` deletes the old row and re-inserts. With the retry system active:

- If `status = 'failed'` AND `next_retry_at` is in the future: return `200` immediately (our retry system will handle it)
- If `status = 'failed'` AND `next_retry_at` is in the past or null: allow provider retry to proceed as before (our system hasn't picked it up yet)
- If `status = 'dead_letter'`: return `200` (exhausted, needs admin intervention)

### Change 3: Store metadata

Pass the optional `metadata` field through to the insert call.

---

## Component 4: Internal Retry Endpoints

### New routes

| Route | Handler |
|-------|---------|
| `POST /api/webhooks/retry/shopify` | `handleShopifyWebhook()` |
| `POST /api/webhooks/retry/whop` | `handleWhopWebhook()` |
| `POST /api/webhooks/retry/email` | `handleEmailWebhook()` |
| `POST /api/webhooks/retry/parcelpanel` | `handleParcelPanelWebhook()` |

### Idempotency

These endpoints are called by the retry processor with a pre-existing `webhook_events` row. They do **not** call `withIdempotency()` — the event already exists in the table. Status management (marking completed/failed/dead_letter) is exclusively owned by the retry processor Edge Function after the endpoint responds.

### Security

- No provider signature verification (payload already trusted from DB)
- Secured by `WEBHOOK_RETRY_SECRET` env var
- The Edge Function sends it as `x-retry-secret` header
- Routes reject requests where the header doesn't match
- Added to `AUTH_BYPASS_PREFIXES` in `proxy.ts` (root-level file, not `lib/proxy.ts`)

### Request body

```ts
interface RetryRequest {
  event_id: string
  event_type: string
  payload: unknown
  workspace_id: string | null
  metadata: Record<string, unknown> | null
}
```

### Response

- `200` — handler succeeded
- `500` — handler failed (Edge Function schedules next retry)

---

## Component 5: Retry Processor Edge Function

### New file: `supabase/functions/webhook-retry/index.ts`

### Cron schedule

Every 5 minutes via pg_cron (configured in migration).

### Processing flow

1. Query `webhook_events`:
   - `status = 'failed'`
   - `next_retry_at <= now()`
   - `attempt_count < 8`
   - Order by `next_retry_at ASC`
   - Limit 20 (batch size cap)

2. For each event:
   - Update `status = 'processing'` (prevents concurrent pickup by next cron cycle)
   - Build request body from stored `payload`, `event_type`, `workspace_id`, `metadata`
   - POST to the corresponding internal retry endpoint based on `source`
   - On `200`: update `status = 'completed'`, set `completed_at`, record `processing_duration_ms`
   - On `500`: increment `attempt_count`, compute `next_retry_at` from backoff schedule. If `attempt_count >= 8`, set `status = 'dead_letter'` instead

3. Log summary: `"[webhook-retry] processed 3 events: 2 completed, 1 rescheduled"`

### Endpoint mapping

```ts
const RETRY_ENDPOINTS: Record<string, string> = {
  shopify:     '/api/webhooks/retry/shopify',
  whop:        '/api/webhooks/retry/whop',
  email:       '/api/webhooks/retry/email',
  parcelpanel: '/api/webhooks/retry/parcelpanel',
}
```

Base URL: `APP_BASE_URL` env var (stored in Supabase Edge Function secrets). Not prefixed with `NEXT_PUBLIC_` since this is only used server-side by the Deno runtime, not by Next.js.

### Stale processing recovery

Before querying for failed events, the retry processor also detects stale `processing` events from previous retry cycles that never completed (e.g., the retry endpoint was unreachable):

- Query: `status = 'processing' AND attempt_count > 0 AND created_at < now() - interval '10 minutes'`
- The `attempt_count > 0` condition distinguishes retry-set `processing` events from first-receipt events still being handled by `withIdempotency`
- These events are reset to `status = 'failed'` with their existing `next_retry_at` so they get picked up on the next cycle

### Workspace scoping exception

The retry processor queries `webhook_events` without a `workspace_id` filter. This is a justified exception to the workspace-scoping rule — the retry processor is a system-level cron job processing events across all workspaces, not a user-initiated request.

### Error handling

- If the Edge Function itself fails (e.g., can't reach the database), it logs the error and returns 500. The next cron cycle retries.
- If an individual event's retry endpoint is unreachable, the stale processing recovery (above) resets it on the next cycle.

---

## Component 6: Admin Panel — Webhooks Page

### Location

New page in the existing admin panel at `/admin/webhooks`, alongside Clients, Broadcasts, and Notifications. Add entry to `ADMIN_NAV` in `lib/admin-constants.ts` and `TAB_META`.

### Access control

Follows the existing admin panel auth pattern: `getUserFromToken()` + `ADMIN_EMAILS` allowlist (imported from `@/lib/admin-constants`), consistent with existing admin routes like suspend/unsuspend. Does **not** use `getAuthContext()` since that resolves a workspace context, which is inappropriate for cross-workspace admin operations.

### UI

**Events table** with columns:

| Column | Content |
|--------|---------|
| Source | Shopify / Whop / Email / ParcelPanel |
| Event Type | e.g., `orders/create`, `membership.activated` |
| Error Message | Last error from handler |
| Attempts | e.g., `8 / 8` |
| Created At | When webhook was first received |
| Last Retry | When last retry was attempted |
| Workspace | Workspace name (linked) — may be empty for Whop/Email events where `workspace_id` is null |
| Actions | Retry / Dismiss buttons |

**Default filter:** `status = 'dead_letter'`. Toggle to include `failed` (pending retry) events.

**Row expansion:** Click to inspect full `payload` JSON (read-only, formatted).

**Actions:**

- **Retry** (per-row): Resets `status = 'failed'`, `attempt_count = 0`, `next_retry_at = now()`. Gives a full retry cycle (8 attempts) since dead-lettered events typically failed due to a prolonged outage that has since been resolved.
- **Bulk retry**: Select multiple events, retry all.
- **Dismiss** (per-row): Sets `status = 'dismissed'`. Event follows normal 90-day cleanup.

### API routes

| Route | Purpose |
|-------|---------|
| `GET /api/admin/webhooks` | List events with status/source filters, pagination |
| `POST /api/admin/webhooks/retry` | Accept array of event IDs, reset for retry |
| `POST /api/admin/webhooks/dismiss` | Accept array of event IDs, mark dismissed |

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `WEBHOOK_RETRY_SECRET` | Vercel + Supabase Edge Function secrets | Shared secret for internal retry endpoints |
| `APP_BASE_URL` | Supabase Edge Function secrets | Base URL for the Next.js app (retry endpoint target, e.g., `https://lynq-dashboard.vercel.app`) |

Update CLAUDE.md's environment variables section to include `WEBHOOK_RETRY_SECRET` (server-only).

---

## Files Changed / Created

### New files

| File | Purpose |
|------|---------|
| `lib/services/webhookHandlers.ts` | Shared handler functions |
| `supabase/functions/webhook-retry/index.ts` | Retry processor Edge Function |
| `app/api/webhooks/retry/shopify/route.ts` | Internal retry endpoint |
| `app/api/webhooks/retry/whop/route.ts` | Internal retry endpoint |
| `app/api/webhooks/retry/email/route.ts` | Internal retry endpoint |
| `app/api/webhooks/retry/parcelpanel/route.ts` | Internal retry endpoint |
| `app/api/admin/webhooks/route.ts` | Admin list endpoint |
| `app/api/admin/webhooks/retry/route.ts` | Admin retry action |
| `app/api/admin/webhooks/dismiss/route.ts` | Admin dismiss action |
| `components/features/admin/webhooks/webhooks-view.tsx` | Admin panel Webhooks page view |
| `app/admin/webhooks/page.tsx` | Admin Webhooks page |
| `hooks/admin/useAdminWebhooks.ts` | TanStack Query hooks for admin webhook endpoints |
| `supabase/migrations/YYYYMMDD_webhook_retry.sql` | Schema + cron migration |

### Modified files

| File | Change |
|------|--------|
| `lib/services/webhookIdempotency.ts` | Add `next_retry_at` on failure, dead-letter logic, metadata pass-through, respect scheduled retries |
| `app/api/webhooks/shopify/route.ts` | Extract handler logic to shared module, pass metadata |
| `app/api/webhooks/whop/route.ts` | Extract handler logic to shared module |
| `app/api/webhooks/email/inbound/route.ts` | Extract handler logic to shared module |
| `app/api/parcel-panel/webhook/[token]/route.ts` | Extract handler logic to shared module |
| `supabase/functions/webhook-cleanup/index.ts` | Exclude `dead_letter` from cleanup |
| `lib/admin-constants.ts` | Add Webhooks entry to `ADMIN_NAV` and `TAB_META` |
| `proxy.ts` | Add `/api/webhooks/retry` to AUTH_BYPASS_PREFIXES |
