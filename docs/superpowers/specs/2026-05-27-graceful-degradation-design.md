# Graceful Degradation for External APIs

## Overview

When external services (Shopify, Gmail, Outlook, Anthropic, Whop) experience outages or transient failures, the platform should remain partially operational with clear status feedback to users.

## Services in Scope

| Service | Usage | Cached Data in Supabase |
|---------|-------|------------------------|
| Shopify | Orders, KPIs, refunds, product data | Yes — `shopify_orders` table via sync cron |
| Gmail | Email threads, sending replies/compose | Yes — `email_messages`, `email_conversations` |
| Outlook | Email threads, sending replies/compose | Yes — `email_messages`, `email_conversations` |
| Anthropic | AI reply generation, AI chat streaming | No |
| Whop | Billing, subscriptions, checkout | Partial — `workspace_subscriptions`, `invoices` |

## Design Decisions

- **Data display on failure:** Show cached Supabase data with a "service unavailable" banner. Fall back to error state only when no cached data exists.
- **Failed user actions:** Automatic retry (1-2 attempts, exponential backoff) behind the scenes, then surface error with a manual "Retry" button if all attempts fail.
- **Health awareness:** Reactive — detect failures per-request and track failure rates in memory. No proactive health-check pings.
- **Architecture:** Shared `resilientFetch()` utility wrapping all external calls + per-service config. Zustand store for frontend health state.
- **Scope:** Full stack — backend resilience + frontend components (banners, retry buttons, degraded state indicators).

## Section 1: Shared Resilient Fetch Utility

**File:** `lib/resilient-fetch.ts`

A `resilientFetch()` function wrapping native `fetch` with:

### Retry Logic

- Exponential backoff: default 2 retries, 500ms then 1000ms delays.
- Only retries on transient errors: 5xx status codes, network failures (`TypeError`), timeouts.
- Never retries 4xx responses (auth errors, validation, rate limits with no `Retry-After`).
- Respects `Retry-After` headers when present (e.g., Shopify 429s).

### Timeout

- Per-request timeout via `AbortSignal.timeout()`.
- Default: 10 seconds.
- Configurable per service (e.g., Anthropic streaming may need longer).

### Error Classification

Returns a structured `ResilientResponse<T>`:

```typescript
type ResilientResponse<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; isTransient: boolean; service: ServiceName; retryAfter?: number }
```

- `isTransient: true` — 5xx, network error, timeout (retry might help)
- `isTransient: false` — 4xx, auth failure, validation (don't retry)
- `retryAfter` — parsed from `Retry-After` header when present (seconds)

### Per-Service Configuration

```typescript
type ServiceName = 'shopify' | 'gmail' | 'outlook' | 'anthropic' | 'whop'

interface ServiceConfig {
  retries: number
  timeoutMs: number
  retryDelayMs: number
}
```

Default configs:

| Service | Retries | Timeout | Base Delay |
|---------|---------|---------|------------|
| Shopify | 2 | 10s | 500ms |
| Gmail | 2 | 10s | 500ms |
| Outlook | 2 | 10s | 500ms |
| Whop | 2 | 15s | 500ms |

Note: Anthropic is excluded from this table — it uses the Vercel AI SDK, not raw `fetch`. See "Anthropic SDK Handling" below.

### Integration with Existing Code

- Service files using raw `fetch` (shopify.ts, gmail.ts, outlook.ts, whop.ts) replace those calls with `resilientFetch()`.
- Existing custom error classes (`ShopifyApiError`, `WhopApiError`) remain — `resilientFetch` handles retry/timeout, services throw typed errors for business-logic failures.
- `resilientFetch` calls `ServiceHealthRegistry.record()` after every request.

### Anthropic SDK Handling

The AI routes use the Vercel AI SDK (`generateText` / `streamText` from `ai` with `@ai-sdk/anthropic`), not raw `fetch`. These cannot be wrapped by `resilientFetch`.

Instead, a separate `resilientSdkCall()` wrapper in the same file handles SDK-based calls:

```typescript
async function resilientSdkCall<T>(
  service: ServiceName,
  fn: () => Promise<T>,
  config?: Partial<ServiceConfig>
): Promise<T>
```

- Wraps the SDK call in try/catch with retry (default: 1 retry, 1000ms delay).
- Only retries on errors that look transient (network errors, 5xx from Anthropic). Does not retry rate limit (429) or auth errors.
- Records success/failure to `ServiceHealthRegistry`.
- **Streaming calls (`streamText`) are not retried** — a partially consumed stream cannot be transparently retried. These fail immediately and record the failure. The frontend already handles stream failure gracefully (replaces with "Something went wrong" message).
- **Non-streaming calls (`generateText`) are retried** normally.

Default Anthropic config:

| Retries | Timeout | Base Delay |
|---------|---------|------------|
| 1 | 30s | 1000ms |

### Out of Scope Providers

`lib/providers/custom.ts` (custom SMTP) and `lib/providers/forwarding.ts` (email forwarding) are excluded from this work. They use different transport mechanisms (SMTP/Resend) and have their own failure modes. They can be added in a follow-up.

## Section 2: Service Health Registry

**File:** `lib/service-health.ts`

A singleton class tracking per-service success/failure rates using a sliding time window.

### API

```typescript
class ServiceHealthRegistry {
  record(service: ServiceName, success: boolean): void
  getStatus(service: ServiceName): 'healthy' | 'degraded' | 'down'
  getAll(): Record<ServiceName, 'healthy' | 'degraded' | 'down'>
}
```

### Status Thresholds

Based on failure rate within the last 60 seconds:

| Status | Failure Rate | Meaning |
|--------|-------------|---------|
| `healthy` | <25% | Service operating normally |
| `degraded` | 25-75% | Intermittent failures |
| `down` | >75% | Service effectively unavailable |

Minimum sample size: 3 requests within the window before changing status from `healthy`. Prevents a single failure from marking a service degraded.

### Limitations

- In-memory, per Vercel instance. Resets on cold starts. Not shared across instances or across routes on different instances.
- This means: a failure recorded by `/api/shopify/kpis` on instance A will not be visible to `/api/health/services` if it hits instance B. The health endpoint is a secondary signal only.
- **Primary path for frontend health state** is the React Query error callbacks → Zustand store flow (client-side, consistent within a user session). The health endpoint supplements this during recovery polling.
- Acceptable because it catches sustained outages within a user's active session and prevents hammering a down service.

### Health Endpoint

**Route:** `GET /api/health/services`

Returns:

```json
{
  "statuses": {
    "shopify": "healthy",
    "gmail": "degraded",
    "outlook": "healthy",
    "anthropic": "healthy",
    "whop": "healthy"
  }
}
```

Used by the frontend only during recovery polling (when a service is already non-healthy).

## Section 3: Zustand Service Health Store + Frontend Components

### Zustand Store

**File:** `stores/service-health.ts`

```typescript
interface ServiceHealthState {
  statuses: Record<ServiceName, 'healthy' | 'degraded' | 'down'>
  lastUpdated: Record<ServiceName, number>

  setStatus: (service: ServiceName, status: ServiceStatus) => void
  setAll: (statuses: Record<ServiceName, ServiceStatus>) => void
  isHealthy: (service: ServiceName) => boolean
}
```

### How the Store Gets Updated

1. **From failed API responses:** Error callbacks registered on `QueryCache` and `MutationCache` (passed to the `QueryClient` constructor) inspect structured error responses. When a response includes `service` and `isTransient` fields, the callback calls `setStatus(service, 'degraded'|'down')`. This is the TanStack Query v5 pattern (global `onError` on QueryClient was removed in v5).
2. **Recovery polling:** A `useServiceHealthPoller` hook activates when any service is non-healthy. Polls `GET /api/health/services` every 30 seconds. Stops polling when all services return to healthy.

### Frontend Components

#### `<ServiceBanner />`

- Placed in the main app layout.
- Reads `useServiceHealthStore` and renders a dismissible warning bar when any service is non-healthy.
- Examples:
  - "Shopify is temporarily unavailable — showing cached data"
  - "Email service is experiencing issues — sending may be delayed"
  - "AI features are temporarily unavailable"
- Only renders when at least one service is non-healthy. Not visible during normal operation.

#### `<RetryButton />`

- A reusable component for mutation error states.
- Shows when a mutation fails with `isTransient: true`.
- Calls the mutation's `mutate()` on click.
- Hidden for non-transient errors (shows a different message: "Something went wrong" without retry).

### No Changes to Existing Pages

- `<ServiceBanner />` added to `app/(protected)/layout.tsx` — visible on all authenticated pages. Not shown on login, admin, or public pages.
- `<RetryButton />` used in existing mutation error handlers where actions can fail (email compose/reply, AI generation, Shopify connect).

## Section 4: API Route Error Response Contract

### Structured Error Format

All API routes calling external services adopt a consistent error response shape:

```typescript
// Success
{ data: T }

// Error
{
  error: string,          // human-readable message
  service: ServiceName,   // which service failed
  isTransient: boolean,   // true = retry might help
  retryAfter?: number,    // seconds, from Retry-After header
  degraded?: boolean      // true = partial/cached data returned
}

// Degraded success (cached data available)
{
  data: T,
  degraded: true,
  service: ServiceName,
  message: string         // "Showing cached data — Shopify is temporarily unavailable"
}
```

### Shared Error Handler

A `serviceCatchHandler(error: unknown, service: ServiceName)` helper that:

1. Classifies the error (transient vs permanent).
2. Produces the structured error response.
3. Keeps API routes thin — one line in the catch block.

### Degraded Success for Read Routes

For API routes that serve data also cached in Supabase:

- **Orders/KPIs** — if Shopify API fails, query `shopify_orders` table and return degraded success.
- **Email threads** — if Gmail/Outlook API fails, query `email_messages`/`email_conversations` and return degraded success.
- **Billing info** — if Whop API fails, query `workspace_subscriptions`/`invoices` and return degraded success.
- **AI features** — no cache available, return structured error.

The fallback Supabase query is added in the catch block of read-oriented API routes, before calling `serviceCatchHandler`.

## Files to Create

| File | Purpose |
|------|---------|
| `lib/resilient-fetch.ts` | Shared retry/timeout/error-classification wrapper |
| `lib/service-health.ts` | In-memory service health registry singleton |
| `stores/service-health.ts` | Zustand store for frontend health state |
| `hooks/use-service-health-poller.ts` | Recovery polling hook |
| `components/shared/service-banner.tsx` | Degradation warning banner |
| `components/shared/retry-button.tsx` | Retry button for failed mutations |
| `app/api/health/services/route.ts` | Health status endpoint |
| `lib/service-catch-handler.ts` | Shared API route error handler |
| `types/service-health.ts` | Shared types (`ServiceName`, `ServiceStatus`, response shapes) |

## Files to Modify

### Service layer — replace raw `fetch` with `resilientFetch`

| File | Change |
|------|--------|
| `lib/services/shopify.ts` | Replace `shopifyFetch()`/`shopifyFetchJSON()` internals with `resilientFetch` |
| `lib/providers/gmail.ts` | Replace raw `fetch` calls with `resilientFetch` |
| `lib/providers/outlook.ts` | Replace raw `fetch` calls with `resilientFetch` |
| `lib/whop.ts` | Replace raw `fetch` calls with `resilientFetch` (keep `WhopApiError`) |

### AI routes — wrap SDK calls with `resilientSdkCall` + structured errors

| File | Change |
|------|--------|
| `app/api/ai/reply/route.ts` | Wrap `generateText` with `resilientSdkCall`, add structured error response |
| `app/api/ai/chat/route.ts` | Add try/catch around `streamText`, record to health registry (no retry for streams) |
| `app/api/ai/translate/route.ts` | Wrap SDK call with `resilientSdkCall`, add structured error response |
| `app/api/ai/macros/route.ts` | Wrap SDK call with `resilientSdkCall`, add structured error response |
| `app/api/ai/analyze/route.ts` | Wrap SDK call with `resilientSdkCall`, add structured error response |
| `app/api/translate/route.ts` | Wrap SDK call with `resilientSdkCall`, add structured error response |
| `app/api/analytics/refund-insights/route.ts` | Wrap SDK call with `resilientSdkCall`, add structured error response |
| `app/api/exams/submit/route.ts` | Wrap SDK call with `resilientSdkCall`, add structured error response |

### Read routes — add degraded success fallback (cached Supabase data)

| File | Change |
|------|--------|
| Shopify read routes (KPIs, orders list, order detail) | Catch block falls back to `shopify_orders` table query |
| Inbox read routes (conversations list, thread detail) | Catch block falls back to `email_messages`/`email_conversations` |
| Billing read routes (subscription status, invoices) | Catch block falls back to `workspace_subscriptions`/`invoices` |

Note: Mutation routes (edit-address, cancel-order, email send/reply, checkout) get structured error responses only — no cached fallback, since the action either succeeds or fails.

### Frontend integration

| File | Change |
|------|--------|
| `app/(protected)/layout.tsx` | Add `<ServiceBanner />` component |
| React Query client config (QueryCache/MutationCache) | Add `onError` callbacks for service health tracking |

### Sentry integration

- `serviceCatchHandler` calls `Sentry.captureException()` only for **permanent errors** (non-transient) and for **transient errors after all retries are exhausted**.
- Transient errors on intermediate retry attempts are not reported to Sentry to avoid noise.
- Tags: `{ integration: service, transient: boolean, retries_exhausted: boolean }`.
