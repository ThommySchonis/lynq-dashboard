# Backend Service Layer Implementation Design

**Date:** 2026-05-09
**Status:** Approved
**Parent spec:** `2026-04-30-backend-architecture-and-analytics-design.md` (Part 1 only)

---

## Scope

Implement Part 1 of the backend architecture spec: extract business logic from API route handlers into a clean service layer. This is a structural refactor — no change in visible product behavior.

**Additional decision (not in parent spec):** All refactored routes will be standardized to use `getAuthContext()` (workspace-scoped auth) instead of the legacy `getUserFromToken()` pattern.

---

## What Gets Built

### 1. `lib/utils/request.js`

Single helper module:

- `parseDateRange(request)` — reads `?from=YYYY-MM-DD&to=YYYY-MM-DD` query params. Falls back to start-of-current-month to today (Amsterdam timezone, `Europe/Amsterdam`). Returns `{ from: string, to: string }` as bare `YYYY-MM-DD` strings. Callers that need time boundaries (e.g. `T23:59:59.999Z` for inclusive end-of-day) add them themselves.

### 2. Credential Type

All service functions use the workspace-scoped credential shape from `lib/shopifyCredentials.js`:

```js
// { domain: string, accessToken: string }
// Returned by getShopifyCredentialsByWorkspace(workspaceId)
```

The legacy `{ shopify_domain, shopify_api_key }` shape from `lib/shopify.js` is not used by service functions.

### 3. `lib/services/shopify.js`

All Shopify business logic extracted from route handlers. Two categories of functions:

**Supabase-backed (accept `workspaceId`, query `shopify_orders` table — no Shopify API credentials needed):**

| Function | Extracted from | Purpose |
|----------|---------------|---------|
| `getKPIs(workspaceId, dateRange)` | `/api/shopify/kpis` | Revenue, refund rate, cancellations via PostgreSQL stored function |
| `getRevenueTrend(workspaceId, dateRange)` | `/api/shopify/revenue-trend` | Daily revenue with gap-fill via PostgreSQL stored function |
| `checkConnectionStatus(workspaceId)` | `/api/shopify/status` | Check if Shopify credentials exist for workspace (no API call — matches current behavior) |

**Shopify API-backed (accept `credentials` object):**

| Function | Extracted from | Purpose |
|----------|---------------|---------|
| `getAnalytics(credentials, dateRange)` | `/api/shopify/analytics` | Monthly analytics via Shopify GraphQL (net sales, gross sales, discounts, returns) |
| `getOrders(credentials, options)` | `/api/shopify/orders` | Fetch recent orders from Shopify REST API |
| `getOrderDetail(credentials, orderId)` | `/api/shopify/orders/[id]` | Single order with line items, refunds, fulfillments |
| `getRefunds(credentials, dateRange)` | `/api/shopify/refunds` | Paginated refund fetching + aggregation |
| `syncOrders(workspaceId, credentials, options)` | `/api/shopify/sync` | Bulk sync with pagination + batch upsert. `options: { full?: boolean }` — `full=true` syncs entire history, default syncs last 90 days. Also fetches+stores shop currency. |
| `createRefund(credentials, orderId, params)` | `/api/shopify/orders/[id]/refund` | Two-step calculate+commit refund flow |
| `cancelOrder(credentials, orderId, params)` | `/api/shopify/orders/[id]/cancel` | Cancel with optional auto-refund |
| `editOrder(credentials, orderId, params)` | `/api/shopify/orders/[id]/edit` | Three-step begin→set→commit edit flow |
| `duplicateOrder(credentials, orderId, lineItems)` | `/api/shopify/orders/[id]/duplicate` | Order duplication |
| `updateOrderNote(credentials, orderId, note)` | `/api/shopify/orders/[id]/note` | Add/update order note |
| `updateOrderAddress(credentials, orderId, address)` | `/api/shopify/orders/[id]/address` | Edit shipping address |
| `getCustomer(credentials, customerId)` | `/api/shopify/customer` | Customer detail lookup |
| `fulfillOrder(credentials, orderId, params)` | `/api/shopify/orders/[id]/fulfill` | Fetch fulfillment orders, create fulfillment with tracking info |

**Demo data:** The route handler checks `credentials?.domain === DEMO_SHOP` after calling `getShopifyCredentialsByWorkspace()`. If demo, the route returns demo data directly from `lib/demoData.js` without calling the service function. This keeps demo logic out of the service layer.

### 4. Disposition of existing `lib/shopify.js`

`lib/shopify.js` exports `getShopifyClient()` and `shopifyFetch()`. After the refactor:

- `shopifyFetch(credentials, path, options)` is moved into `lib/services/shopify.js` as an **internal** helper (not exported). All service functions use it for Shopify REST API calls.
- `getShopifyClient()` is deleted — it's the legacy single-tenant credential lookup, superseded by `getShopifyCredentialsByWorkspace()`.
- `lib/shopify.js` is deleted entirely.

### 5. Flat wrapper routes

Four flat routes exist as legacy wrappers for the "Lovable" frontend:
- `/api/shopify/cancel-order`
- `/api/shopify/duplicate-order`
- `/api/shopify/edit-address`
- `/api/shopify/refund-order`

**Decision:** Keep them but refactor to thin wrappers that call the same service functions as the nested `[id]` routes. Migrate from `getUserFromToken()` to `getAuthContext()`. This avoids breaking the Lovable frontend while removing duplicated logic.

### 6. Routes excluded from this refactor

These routes are not refactored because they are setup/config routes (not business logic) or debug utilities:

| Route | Reason |
|-------|--------|
| `/api/shopify/link` | OAuth setup — already uses `getAuthContext()`, minimal logic |
| `/api/shopify/manual-connect` | Manual setup — already uses `getAuthContext()`, minimal logic |
| `/api/shopify/debug-channels` | Debug utility — no business logic to extract |
| `/api/auth/shopify/*` | OAuth flow — belongs in auth, not service layer |

### 7. `lib/services/refunds.js`

| Function | Purpose |
|----------|---------|
| `classifyRefundReason(cancelReason)` | Map Shopify `cancel_reason` to taxonomy values |
| `aggregateRefunds(orders, dateRange)` | Group refund line items by order, calculate percentages |
| `getRefundInsights(refunds)` | Prepare refund data for AI analysis (aggregation logic only, not the AI call) |

### 8. `lib/services/inbox.js`

Interface layer for unified inbox operations. Exports:

| Function | Wraps | Purpose |
|----------|-------|---------|
| `sendReply(provider, threadId, body, agentId)` | Provider-specific send from `lib/providers/` | Send a reply in a thread |
| `resolveThread(provider, threadId, agentId)` | `conversationEngine.resolveThread()` | Mark thread as resolved |
| `getThreads(provider, workspaceId, filters)` | Provider-specific list from `lib/providers/` | List threads with filtering |
| `getThread(provider, threadId)` | Provider-specific fetch | Get single thread with messages |

The `provider` parameter is `'gmail' | 'outlook' | 'custom'`. Gorgias is excluded from this interface (handled by webhook in Part 2). These functions are thin pass-throughs for now — Part 2 will add analytics instrumentation (`track()` calls) inside them.

### 9. PostgreSQL Stored Functions

Created via Supabase SQL migrations in `supabase/migrations/`:

**`get_kpis(p_workspace_id UUID, p_from DATE, p_to DATE)`**

Returns: `JSON` object with `{ totalOrders, totalRevenue, cancelledOrders, totalRefunds, refundRate, refundPct, discounts, returns }`

Logic: Aggregates from `shopify_orders` where `workspace_id = p_workspace_id` and `COALESCE(processed_at, created_at_shopify) BETWEEN p_from AND p_to`. Uses the same `COALESCE(processed_at, created_at_shopify)` fallback as current JS code.

**`get_revenue_trend(p_workspace_id UUID, p_from DATE, p_to DATE)`**

Returns: `TABLE(date DATE, revenue NUMERIC)` with one row per day in the range. Days with no orders return `revenue = 0` (gap-fill via `generate_series`).

### 10. Refactored API Routes

All Shopify-related routes become thin wrappers following this pattern:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { someServiceFn } from '../../../../lib/services/shopify'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // For Shopify API-backed functions:
  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not connected' }, { status: 400 })
  if (credentials.domain === DEMO_SHOP) return NextResponse.json(DEMO_DATA)

  const result = await someServiceFn(credentials, ...)
  return NextResponse.json(result)
}
```

### 11. Error Handling Contract

Service functions **throw** on errors. Two error types:

- **`ShopifyApiError`** — wraps Shopify REST API errors (status code, message, endpoint). Thrown when Shopify returns 4xx/5xx.
- **Standard `Error`** — for invalid arguments or unexpected states.

Route handlers catch errors and map them to HTTP responses:

```js
try {
  const result = await someServiceFn(...)
  return NextResponse.json(result)
} catch (err) {
  if (err instanceof ShopifyApiError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode })
  }
  console.error('Service error:', err)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
```

`ShopifyApiError` is defined in `lib/services/shopify.js` and exported.

### 12. Supabase Edge Functions

Located in `supabase/functions/`:

| Function | Trigger | Purpose |
|----------|---------|---------|
| `shopify-webhook/index.ts` | HTTP (Shopify webhook URL) | Verify HMAC signature, process order/refund events, upsert into `shopify_orders` |
| `shopify-sync/index.ts` | Cron (every 30 min via pg_cron) | Pull latest orders for all active workspaces with Shopify credentials |

Both use Supabase's Deno runtime and the `supabase-js` client with the service role key.

---

## Execution Order

1. `lib/utils/request.js` (no dependencies)
2. PostgreSQL stored functions (migrations)
3. `lib/services/shopify.js` including `ShopifyApiError` (depends on 1, 2)
4. `lib/services/refunds.js` (depends on 3 for types)
5. `lib/services/inbox.js` (independent)
6. Refactor all Shopify API routes to thin wrappers + delete `lib/shopify.js` (depends on 3, 4)
7. Supabase Edge Functions (independent of 6, but logically last)

---

## Auth Migration

All routes are migrated atomically in step 6. The `getAuthContext()` function in `lib/auth.js` internally calls `getUserFromToken()`, so the same Bearer token format works. No frontend changes needed — `dashboard.html` and the Next.js app both send the same Supabase JWT.

---

## Testing Strategy

- Manual smoke testing via the dashboard after each route group is refactored
- Verify each refactored route returns identical JSON shape to the original
- Edge Functions tested via Supabase CLI (`supabase functions serve` locally)

---

## Constraints

- Feature branch — no direct commits to main
- No visible behavior change — this is a structural refactor
- Services are pure functions (no request/response objects)
- All workspace-owned queries must include `workspace_id` filter
- Demo data support must be preserved in all refactored routes
