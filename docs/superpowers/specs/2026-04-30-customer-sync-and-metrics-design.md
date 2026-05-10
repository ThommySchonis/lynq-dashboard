# Customer Sync & Metrics Design

**Date:** 2026-04-30
**Status:** Approved
**Covers:** `tasks/customers-metrix.md`, `tasks/sync-customers-from-shopify.md`

---

## Context

Customer profile data is currently fetched live from Shopify per-request in `/api/shopify/customer?email=`. This works for the inbox sidebar but does not support a browsable/searchable Customers page. Customer metrics (total spend, refund rate, avg order value) need to be computed from the `shopify_orders` table which already contains `customer_email` per order.

This spec covers:
1. A new `shopify_customers` Supabase table synced from Shopify
2. PostgreSQL functions for computing customer metrics from `shopify_orders`
3. A new Customers page with search and customer detail drawer
4. Extension of the inbox sidebar with richer computed metrics

### Existing Infrastructure Relevant to This Spec

- `shopify_orders` table in Supabase — has `customer_email`, `customer_name`, `client_id`, `subtotal_price`, `refund_amount`, `cancel_reason`, `processed_at` per order
- `GET /api/shopify/customer?email=` — live Shopify lookup, returns profile + last 5 orders. Returns `ordersCount` and `totalSpent` from Shopify's customer object.
- `POST /api/shopify/sync` — orders sync route; scheduled Edge Function runs this periodically
- Customers page does not exist yet — needs to be created at `app/customers/page.js`

---

## Feature 1 — `shopify_customers` Table

### Schema

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint (PK) | Shopify customer ID |
| `client_id` | uuid | FK → clients.id |
| `email` | text | |
| `first_name` | text | |
| `last_name` | text | |
| `phone` | text | nullable |
| `city` | text | from Shopify `default_address.city` |
| `country` | text | from Shopify `default_address.country` |
| `country_code` | text | from Shopify `default_address.country_code` |
| `shopify_tags` | text | comma-separated Shopify customer tags |
| `note` | text | Shopify customer note field |
| `shopify_created_at` | timestamptz | customer account creation date in Shopify |
| `synced_at` | timestamptz | timestamp of last sync |

Unique constraint on `(id, client_id)` for upsert. Additional index on `(client_id, email)` for fast lookup by email (used by metrics functions and search queries). Email is not declared UNIQUE per client — Shopify guarantees unique emails per store in practice, but the index is non-unique to avoid sync failures on edge cases.

### `client_id` Identity

`client_id` in `shopify_customers` equals `user.id` returned by `getUserFromToken` — which is the Supabase auth UID. In this system, `clients.id = auth.users.id`, so `user.id` and `clients.id` are the same value and can be used interchangeably.

### Sync Route

New route `POST /api/shopify/sync/customers`:
- Fetches all customers from Shopify paginated (`/customers.json?limit=250&updated_at_min=...`)
- Default: customers updated in last 90 days. Full resync when `?full=true` query param is passed
- Upserts into `shopify_customers` on conflict `(id, client_id)` — updates all fields on conflict
- Integrated into the existing scheduled Shopify sync Edge Function — runs after orders sync completes
- Also triggerable manually from the Settings page (same button or a separate "Sync customers" button)

---

## Feature 2 — PostgreSQL Metrics Functions

Two functions in Supabase. Both read from `shopify_orders` — metrics are always computed fresh, never stored as columns.

### `get_customer_metrics(p_email text, p_client_id uuid)`

Returns aggregated metrics for a single customer:

```sql
SELECT
  COUNT(*)                                            AS total_orders,
  COUNT(*) FILTER (WHERE cancel_reason IS NOT NULL)   AS cancelled_orders,
  COUNT(*) FILTER (WHERE refund_amount > 0)           AS refunded_orders,
  COALESCE(SUM(subtotal_price - refund_amount), 0)    AS net_spent,
  COALESCE(AVG(subtotal_price)
    FILTER (WHERE cancel_reason IS NULL), 0)          AS avg_order_value,
  MIN(processed_at)                                   AS first_order_date,
  MAX(processed_at)                                   AS last_order_date
FROM shopify_orders
WHERE customer_email = p_email
  AND client_id = p_client_id
```

`refund_rate` is computed in the API route (not in SQL): `refunded_orders / total_orders * 100`, rounded to one decimal.

### `get_customers_metrics_bulk(p_emails text[], p_client_id uuid)`

Same logic as above but accepts an array of emails and returns one row per email. Used by the Customers page to avoid N+1 queries when loading metrics for a page of 50 customers.

### API Route

New route `GET /api/shopify/customer/metrics?email={email}`:
- Calls `supabaseAdmin.rpc('get_customer_metrics', { p_email, p_client_id: user.id })`
- Computes `refundRate` from returned counts
- Returns: `{ totalOrders, cancelledOrders, refundedOrders, refundRate, netSpent, avgOrderValue, firstOrderDate, lastOrderDate }`

---

## Feature 3 — Customers Page

New page at `app/customers/page.js`.

### `GET /api/shopify/customers` Route

New route. Auth: Bearer token → `getUserFromToken` → resolves `client_id = user.id` (Supabase auth UID equals `clients.id` — they are the same value in this system).

Query params:
- `search` — optional string, applied as ILIKE `%search%` on `first_name`, `last_name`, `email`
- `page` — integer, default 1
- `sort` — column name, default `shopify_created_at`
- `dir` — `asc` | `desc`, default `desc`

Response:
```json
{
  "customers": [
    { "id", "email", "first_name", "last_name", "phone", "city", "country", "shopify_tags", "shopify_created_at" }
  ],
  "total": 142,
  "page": 1,
  "pageSize": 50
}
```

Metrics are NOT included in this response — they are fetched separately via the bulk metrics endpoint to keep this query fast.

### List View

**Data source:** `GET /api/shopify/customers?search=&page=&sort=` — queries `shopify_customers` table. On first page load also calls bulk metrics endpoint for the current page.

**Search:** filters by `first_name`, `last_name`, or `email` (case-insensitive ILIKE on Supabase query).

**Columns (sortable):**

| Column | Source |
|--------|--------|
| Name | `shopify_customers` |
| Email | `shopify_customers` |
| Location | `city`, `country` from `shopify_customers` |
| Customer since | `shopify_created_at` from `shopify_customers` |
| Orders | `totalOrders` from bulk metrics function |
| Net spent | `netSpent` from bulk metrics function |
| Refund rate | `refundRate` from bulk metrics function |
| Last order | `lastOrderDate` from bulk metrics function |

**Pagination:** 50 customers per page.

**Metrics loading:** Metrics for the current page are fetched in a single parallel bulk call alongside the customer list. Skeleton placeholders shown in metric columns until resolved.

### Customer Detail Drawer

Clicking any row opens a right-side drawer (no page navigation):

- **Profile section:** full name, email, phone, address (city, country), Shopify tags, note, customer since date
- **Metrics block:** all fields from `get_customer_metrics` — total orders, cancelled, refunded, refund rate, net spent, avg order value, first/last order date. Fetched via `GET /api/shopify/customer/metrics?email=` when drawer opens.
- **Order history:** last 10 orders fetched live from `GET /api/shopify/customer?email=&limit=10`. The existing route is extended to accept an optional `?limit=` query param (default: 5, max: 25) so the inbox sidebar continues using 5 orders without any change, while the drawer requests 10. Shows order name, date, status badges, total.
- **Actions:** none in this phase. "Open conversation" and similar actions are a future phase.

### Empty / Loading / Error States

| State | Trigger | Display |
|-------|---------|---------|
| No customers synced | `shopify_customers` table is empty for this client | "Sync your Shopify customers to get started" + Sync button |
| Search no results | Query returns empty | Neutral empty state message |
| Sync in progress | Sync API call pending | "Syncing customers…" with spinner; button disabled |
| Shopify not connected | API returns `{ error: 'Shopify not configured' }` | "Connect Shopify in Settings to sync customers" |

---

## Feature 4 — Extended Inbox Sidebar

Extends the customer panel defined in the orders/refunds spec.

### Updated Load Sequence

When a customer is identified in the inbox (auto or manual), two API calls fire in parallel:

1. `GET /api/shopify/customer?email=` — live Shopify data (profile + last 5 orders) — existing, renders immediately
2. `GET /api/shopify/customer/metrics?email=` — computed metrics — new, renders with skeleton until resolved

### Extended Customer Header

Replaces the locally-computed refund % from the orders/refunds spec with the accurate full-history value from the metrics function:

| Metric | Source | Notes |
|--------|--------|-------|
| Total orders | Shopify live (`ordersCount`) | |
| Net spent | Metrics function (`netSpent`) | Replaces `totalSpent` from Shopify |
| Avg order value | Metrics function (`avgOrderValue`) | New |
| Refund rate badge | Metrics function (`refundRate`) | Replaces locally-computed version from orders spec |
| Customer since | Metrics function (`firstOrderDate`) | New — first order in system |
| Last order | Metrics function (`lastOrderDate`) | New |
| Cancelled count | Metrics function (`cancelledOrders`) | New |

**Correction to orders/refunds spec:** the refund % computed locally from the last 5 orders (as defined in that spec) is replaced by `refundRate` from the metrics function, which covers the customer's complete order history.

Refund rate badge color thresholds remain unchanged: ≤ 10% none, 11–30% yellow, > 30% red.

---

## Implementation Plan & Estimates

Estimates assume a human developer with minimal AI assistance.

| Task | Hours |
|------|-------|
| Create `shopify_customers` Supabase table (SQL migration) | 2h |
| `POST /api/shopify/sync/customers` route — paginated Shopify fetch + upsert | 5h |
| Extend scheduled Edge Function to run customer sync after order sync | 2h |
| Write `get_customer_metrics` PostgreSQL function | 3h |
| Write `get_customers_metrics_bulk` PostgreSQL function | 2h |
| `GET /api/shopify/customer/metrics` route (calls RPC, computes refund rate) | 2h |
| `GET /api/shopify/customers` route — paginated list with search + sort | 4h |
| Customers page list view — search input, sortable columns, pagination | 10h |
| Customer detail drawer — profile, metrics block, order history | 6h |
| Empty / loading / sync states on Customers page | 2h |
| Extend inbox sidebar — parallel metrics call, metrics block, skeleton loader | 3h |
| Replace local refund % with metrics function value in inbox sidebar | 1h |
| **Total** | **42h** |

---

## Constraints

- Customer metrics are always computed fresh from `shopify_orders` — never stored as columns on `shopify_customers`
- The `shopify_customers` table holds profile data only; metrics staleness risk is zero
- Customers page is read-only in this phase — no actions (open conversation, send email etc.)
- Customer sync defaults to last 90 days to match the orders sync; `?full=true` for initial setup
- `/api/shopify/customer` is extended with an optional `?limit=` param (default 5, max 25); inbox sidebar calls it without the param and continues receiving 5 orders — no breaking change
