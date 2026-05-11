# Backend Architecture & Analytics System Design

**Date:** 2026-04-30
**Status:** Approved
**Covers:** `tasks/back-end-realization.md`, `tasks/analytics-aggregation.md`

---

## Context

The current system uses Next.js API routes as a backend layer sitting between the frontend and Supabase. Business logic (KPI calculations, data transformations, external integrations) is co-located with route handlers, making routes large and difficult to maintain. Separately, the analytics requirements (response time, resolution time, per-agent productivity) cannot be served from Supabase/PostgreSQL alone at scale.

This spec covers two interrelated changes:
1. Reorganize the backend into a clean service layer
2. Introduce Tinybird as a dedicated analytics store with a documented ClickHouse migration path

### New Environment Variables Required

| Variable | Used by | Format |
|----------|---------|--------|
| `TINYBIRD_INGEST_URL` | `lib/analytics/track.js` | Tinybird Events API URL, e.g. `https://api.tinybird.co/v0/events?name=support_events` |
| `TINYBIRD_API_KEY` | `lib/analytics/track.js`, analytics API routes | Tinybird token with `DATA:INGEST` + `PIPES:READ` scopes |
| `GORGIAS_WEBHOOK_SECRET` | `/api/webhooks/gorgias` | Shared HMAC secret for verifying Gorgias webhook signatures |

All existing environment variables remain unchanged.

### Existing Infrastructure Relevant to This Spec

- `lib/supabaseAdmin.js` already exports `getUserFromToken(token: string): Promise<User | null>` — used by all authenticated API routes
- `shopify_orders` table exists in Supabase (not documented in CLAUDE.md but actively used) — stores synced Shopify orders with fields: `client_id`, `subtotal_price`, `total_discounts`, `refund_amount`, `cancel_reason`, `financial_status`, `processed_at`, `created_at_shopify`, `source_name`
- `agents` table exists in Supabase — stores support agents with fields: `id` (UUID), `name`, `email`, `role`
- `agent_actions` table exists in Supabase — stores `agent_id`, `action_type` (`reply` | `close`), `response_time_seconds`, `thread_id`. This is partial prior art for analytics tracking; the new Tinybird system supersedes it for analytics queries but the table remains for operational use.

---

## Part 1 — Backend Service Layer

### Decision

The existing Next.js API routes already fulfill the role of a backend bridge (frontend → API routes → Supabase). Introducing a separate backend server (Node.js/Express on Railway, etc.) would add deployment complexity and latency without meaningful benefit at the current scale.

**Chosen approach:** Keep Next.js API routes as the backend layer. Introduce a `lib/services/` module layer so routes become thin orchestrators. Move heavy data aggregations to PostgreSQL stored functions. Use Supabase Edge Functions for async/background work only.

### Directory Structure

```
lib/
  services/
    shopify.js      — Shopify data fetching, KPI math, order/refund transformations
    inbox.js        — Unified inbox operations (Gorgias + Gmail + Outlook + custom)
    refunds.js      — Refund processing logic and structured reason classification
  analytics/
    track.js        — Single entry point for all event tracking → Tinybird Events API
    events.js       — Event type constants (EVENT_TYPES enum)
  supabase.js       — Unchanged (public client)
  supabaseAdmin.js  — Unchanged (server-only admin client)
```

### Shared Helpers

A `lib/utils/request.js` module is introduced with:
- `parseDateRange(request: Request): { from: string, to: string }` — reads `?from=YYYY-MM-DD&to=YYYY-MM-DD` query params, falls back to start-of-current-month to today if absent. Returns ISO date strings.

### API Route Pattern (after refactor)

`getUserFromToken` already exists in `lib/supabaseAdmin.js`. API routes become thin wrappers:

```js
// app/api/shopify/kpis/route.js
import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getKPIs } from '../../../../lib/services/shopify'
import { parseDateRange } from '../../../../lib/utils/request'

export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const kpis = await getKPIs(user.id, parseDateRange(request))
  return NextResponse.json(kpis)
}
```

All business logic, calculations, and external API calls live inside `lib/services/`.

### PostgreSQL Stored Functions

Complex multi-row aggregations that are already stored in Supabase (e.g. refund rate over a period, revenue trend) should be expressed as PostgreSQL functions or materialized views rather than fetching all rows into JS and computing there. Services call these via `supabaseAdmin.rpc('function_name', params)`.

### Supabase Edge Functions

Used exclusively for async/background work that should not block a user-facing request:

| Edge Function | Trigger | Purpose |
|---------------|---------|---------|
| `shopify-webhook` | HTTP (Shopify webhook URL registered per client) | Process order/refund events from Shopify, upsert into `shopify_orders` |
| `shopify-sync` | Cron (scheduled, e.g. every 30 min) | Pull latest Shopify orders into `shopify_orders` for all active clients |

---

## Part 2 — Analytics System

### Decision

The required metrics (response time, resolution time, per-agent productivity) are event-based time-series analytics. PostgreSQL handles operational data well but degrades on large-scale analytical queries with complex window functions over millions of event rows.

**Chosen approach:** Tinybird as a dedicated analytics store from day one. Events are ingested via the Tinybird Events API (fire-and-forget). ClickHouse is the documented migration target when self-hosted scale or cost becomes a reason to move — the migration is a configuration change, not a rewrite, because Tinybird runs on ClickHouse internally.

### Agent Identity

"Agents" are support staff records in the Supabase `agents` table. `agent_id` in analytics events = `agents.id` (UUID). Inbound customer messages use `agent_id = ""` (empty string). The client account owner (`clients.id`) is stored separately as `client_id`.

### Store Identity

A "store" is a Shopify store connected to a client account. Currently the data model is one store per client, so `store_id = client_id` until the multi-store feature is implemented (see `tasks/multi-store-setup.md`). When multi-store is built, `store_id` will reference a new `stores` table. For this spec, set `store_id = client_id` everywhere.

### Unified Event Schema

All inbox sources (Gorgias, Gmail, Outlook, custom email) emit events in a single normalized schema to Tinybird datasource `support_events`:

| Field | Type | Values / Notes |
|-------|------|----------------|
| `event_type` | String | `message_received`, `message_sent`, `ticket_opened`, `ticket_resolved`, `ticket_assigned` |
| `ticket_id` | String | Gorgias ticket ID or internal thread UUID |
| `source` | String | `gorgias`, `gmail`, `outlook`, `custom` |
| `agent_id` | String | `agents.id` UUID; `""` for inbound customer messages. For `ticket_assigned` events: the agent being assigned to (not the actor performing the assignment) |
| `client_id` | String | `clients.id` UUID (the Lynq account) |
| `store_id` | String | `client_id` value until multi-store is implemented (see Store Identity section) |
| `timestamp` | DateTime | Event time (not ingestion time), ISO 8601 UTC |
| `metadata` | String | JSON string: `{ refund_reason?, channel?, subject? }` |

### Refund Reason Taxonomy

`metadata.refund_reason` uses the following values (based on Shopify's `cancel_reason` field plus custom extension):

| Value | Meaning |
|-------|---------|
| `customer` | Customer changed mind |
| `fraud` | Fraudulent order |
| `inventory` | Item out of stock |
| `declined` | Payment declined |
| `quality` | Product quality issue |
| `shipping` | Shipping problem |
| `wrong_item` | Wrong item received |
| `other` | Unclassified |

The agent explicitly selects the refund reason in the dashboard UI when processing a refund. The reason is passed to the refund API route, stored in `metadata.refund_reason` of the `ticket_resolved` event emitted at that point. It is NOT automatically derived from Shopify's `cancel_reason`. The taxonomy can be extended by adding new values — the `refund_reasons` Tinybird pipe counts by value, so new values appear automatically.

### Event Capture Sources

- **Custom inbox (Gmail / Outlook / custom email):** Instrument existing reply/resolve API routes directly. Each route that handles a user action calls `track()` after the primary operation succeeds.
- **Gorgias:** A single `/api/webhooks/gorgias` endpoint handles all clients. Incoming requests are verified via HMAC signature: Gorgias signs payloads with `GORGIAS_WEBHOOK_SECRET` and sends the signature in the `X-Gorgias-Signature` header; the endpoint rejects requests that fail verification. Client identity is resolved by matching `payload.account.domain` against `clients.gorgias_domain` in Supabase. Gorgias webhook is registered once per client (during onboarding) pointing to this shared endpoint.

### `lib/analytics/track.js`

Single function used everywhere:

```js
await track(EVENT_TYPES.MESSAGE_SENT, {
  ticket_id,
  source: 'gmail',
  agent_id,        // agents.id UUID, or '' for customer messages
  client_id,
  store_id,        // or '' if not applicable
  timestamp,       // event time as ISO 8601 string, not Date.now()
  metadata: {}
})
```

**Fire-and-forget contract:**
- The `track()` call is wrapped in a `try/catch` internally and never throws
- On Tinybird failure: the error is logged via `console.error` with the event payload for debuggability, then silently swallowed
- The inbox action that triggered the call always completes regardless of analytics outcome
- No retry logic in MVP — events lost during Tinybird outages are accepted as a known limitation at this stage

### Tinybird Pipes (Metrics)

Five analytical pipes are defined. All pipes accept the following optional filter parameters: `client_id`, `store_id`, `agent_id`, `date_from`, `date_to`.

| Pipe | Metric | Core Logic |
|------|--------|------------|
| `response_time` | Avg time from first inbound message to first agent reply | Per ticket: `MIN(timestamp WHERE event_type='message_sent' AND agent_id != '') - MIN(timestamp WHERE event_type='message_received')` grouped by `ticket_id`, then average across all tickets in the period |
| `resolution_time` | Avg time from ticket open to ticket resolved | Per ticket: `timestamp WHERE event_type='ticket_resolved' - timestamp WHERE event_type='ticket_opened'` grouped by `ticket_id`, then average across all tickets in the period |
| `ticket_volume` | Opened vs resolved count over time | Count `ticket_opened` and `ticket_resolved` events grouped by day |
| `agent_productivity` | Per-agent output stats | Grouped by `agent_id`: count of `message_sent` events (messages_sent), count of distinct `ticket_id` where `message_sent` count = 1 AND ticket is resolved (one-touch), avg `message_sent` count per distinct `ticket_id` (avg_messages). One-touch rate denominator = all tickets the agent resolved (`ticket_resolved` events where `agent_id` matches) in the period |
| `refund_reasons` | Structured refund reason breakdown | Parse `metadata.refund_reason` from `ticket_resolved` events, count by reason value |

`per_agent_stats` is not a separate pipe. The above pipes each accept `agent_id` as a filter to scope results to a single agent. The analytics dashboard passes the selected agent's ID to all pipes when rendering the per-agent view.

All pipes expose Tinybird-generated API endpoints. Next.js API routes under `app/api/analytics/` consume these endpoints server-side and return data to the dashboard. Tinybird credentials never reach the frontend.

**Analytics API route error contract:** When Tinybird is unavailable or returns an error, the Next.js analytics routes return HTTP 200 with `{ data: null, error: "analytics_unavailable" }`. The dashboard renders a graceful "analytics unavailable" empty state rather than an error boundary. This keeps analytics failures isolated from the rest of the dashboard.

### `agent_actions` Table

The existing `agent_actions` Supabase table continues to receive writes unchanged — `app/api/agent-performance/route.js` reads from it for the current performance view and is not modified in this spec. The Tinybird `support_events` datasource is additive. Once Tinybird analytics are validated in production, deprecating `agent_actions` is a future decision out of scope here.

### Dashboard Integration

The existing `app/analytics/page.js` is updated to consume the new Next.js analytics API routes. Per-agent view is added as a new tab/section on the analytics page, using the same 5 pipes filtered by `agent_id`.

### ClickHouse Migration Path

When self-hosting or cost becomes a driver:

1. Export `support_events` datasource from Tinybird as CSV (Tinybird UI or API)
2. Provision a ClickHouse instance (self-hosted via Docker or ClickHouse Cloud)
3. Create the `support_events` table with identical schema
4. Import CSV data
5. Copy Tinybird pipe SQL queries into ClickHouse views (identical dialect)
6. Update `lib/analytics/track.js` to POST events to ClickHouse's HTTP interface (`INSERT INTO support_events FORMAT JSONEachRow`) instead of the Tinybird Events API
7. Update each `app/api/analytics/` route to query ClickHouse HTTP interface (`SELECT` via HTTP) instead of calling Tinybird pipe endpoints
8. Update `TINYBIRD_INGEST_URL` and `TINYBIRD_API_KEY` env vars to ClickHouse equivalents (or rename them to `ANALYTICS_INGEST_URL` / `ANALYTICS_API_KEY` from the start to avoid coupling to Tinybird naming)

No dashboard changes, no service schema changes required.

---

## Implementation Plan & Estimates

Estimates assume a human developer with minimal AI assistance.

### Part 1 — Backend Service Layer

| Task | Hours |
|------|-------|
| Audit all existing API routes, map logic to service modules | 3h |
| Create `lib/utils/request.js` (`parseDateRange` and shared helpers) | 1h |
| Create `lib/services/shopify.js` (KPIs, orders, refunds, revenue, customer logic) | 8h |
| Create `lib/services/inbox.js` (Gorgias + Gmail + Outlook + custom unified ops) | 6h |
| Create `lib/services/refunds.js` (refund logic + structured reason classification) | 3h |
| Write PostgreSQL stored functions for heavy aggregations | 5h |
| Supabase Edge Function — Shopify webhook processing | 6h |
| Supabase Edge Function — scheduled Shopify sync (cron trigger) | 4h |
| Refactor all existing API routes to use services (thin wrappers) | 8h |
| **Subtotal** | **44h** |

### Part 2 — Analytics System

| Task | Hours |
|------|-------|
| Tinybird account setup, `support_events` datasource schema, test ingestion | 4h |
| `lib/analytics/track.js` + `events.js` (fire-and-forget event emitter) | 4h |
| Instrument custom inbox routes (Gmail / Outlook / custom — reply, resolve, open, assign) | 6h |
| Gorgias webhook handler + client identity resolution + event normalization | 8h |
| Build 5 Tinybird pipes (response time, resolution time, ticket volume, agent productivity, refund reasons) | 12h |
| Next.js API routes consuming Tinybird endpoints (`app/api/analytics/`) | 6h |
| Analytics dashboard UI — wire up new data, add per-agent view | 12h |
| ClickHouse migration documentation (runbook) | 2h |
| **Subtotal** | **54h** |

### Total Estimate: ~98 hours

---

## Constraints

- No additional infrastructure costs for Part 1 (Supabase Edge Functions are included in the existing Supabase plan)
- Tinybird free tier covers the initial period (0 clients); paid tier required at production scale
- This is a structural refactor — no change in visible product behavior expected from Part 1
- Gorgias webhook registration is required per client and must be part of the client onboarding flow
- Events lost during Tinybird outages are accepted as a known limitation in MVP; retry/queue mechanism is a future enhancement
