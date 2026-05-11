# Multi-Store Support Design

**Date:** 2026-04-30
**Status:** Approved
**Covers:** `tasks/store-context-management.md`, `tasks/store-data-layer.md`, `tasks/store-inbox-configurator.md`, `tasks/store-settings.md`, `tasks/store-specific-email-integration.md`, `tasks/store-swticher-ui.md`

---

## Context

The current system is single-store per account. Shopify credentials live in the `integrations` table with one row per `client_id`. Email connections (Gmail/Outlook) are also stored in `integrations`. All `shopify_orders` and inbox threads are scoped only by `client_id` — there is no `store_id`.

This spec introduces full multi-store support: multiple Shopify stores per account, each with isolated data (orders, customers, refunds, inbox), its own email connections, and a UI for switching between stores.

### Existing Infrastructure

- `integrations` table: `client_id` (PK), `shopify_domain`, `shopify_access_token`, `shopify_client_secret`, `shopify_scope`, `shopify_connected_at`, `parcelpanel_api_key`, `store_currency`
- `lib/shopifyCredentials.js` — `getShopifyCredentials(userId, userEmail)`: checks `integrations` then `clients` fallback
- `shopify_orders.client_id` — current store identifier (no `store_id` column)
- Gmail/Outlook OAuth tokens stored in `integrations` per account
- No `stores` table exists yet

### Migration Strategy

Phased approach: introduce `stores` table alongside `integrations`. Update `getShopifyCredentials` to check `stores` first, `integrations` as fallback. The fallback is removed once all routes are fully migrated. Since there are no production clients, there is no live data to migrate — each new store connection will write to `stores`.

---

## Feature 1 — Database Schema

### New table `stores`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Generated UUID |
| `client_id` | uuid | FK → clients.id |
| `name` | text | Display name, e.g. "Store NL", "Store UK" |
| `shopify_domain` | text | e.g. `myshop.myshopify.com` |
| `shopify_access_token` | text | OAuth access token |
| `shopify_client_secret` | text | For webhook HMAC verification |
| `shopify_scope` | text | Granted OAuth scopes |
| `shopify_connected_at` | timestamptz | |
| `created_at` | timestamptz | |

Unique constraint on `(client_id, shopify_domain)`.

### New table `store_email_configs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `store_id` | uuid | FK → stores.id |
| `client_id` | uuid | FK → clients.id — for fast scoped queries |
| `provider` | text | `gmail` \| `outlook` \| `custom` |
| `email_address` | text | The email address agents see |
| `access_token` | text | OAuth token (Gmail/Outlook); null for custom SMTP |
| `refresh_token` | text | nullable |
| `token_expiry` | timestamptz | nullable |
| `connected_at` | timestamptz | |
| `watch_expiry` | timestamptz | Gmail only — expiry of the registered Gmail Watch; null = not registered |

Multiple rows per `store_id` are allowed — a store can have multiple email connections (e.g. two Gmail accounts).

### Additions to existing tables

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `shopify_orders` | `store_id` | uuid | nullable initially; populated by sync routes going forward |
| `shopify_customers` | `store_id` | uuid | nullable initially; same |
| `email_threads` (inbox) | `store_id` | uuid | tagged at ingest time from `store_email_configs` |

### `integrations` table

Unchanged. The fallback path in `getStoreCredentials` reads from it. Removed once full migration is complete.

---

## Feature 2 — Credentials & API Route Changes

### `getStoreCredentials(storeId, clientId)`

New function in `lib/shopify.js` replacing `getShopifyCredentials` in all store-aware routes:

```js
// userEmail is required only for the integrations fallback path
async function getStoreCredentials(storeId, clientId, userEmail = null) {
  // 1. Try stores table — explicit store_id
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('shopify_domain, shopify_access_token')
    .eq('id', storeId)
    .eq('client_id', clientId)   // prevents cross-client access
    .maybeSingle()

  if (store?.shopify_access_token) {
    return { domain: store.shopify_domain, accessToken: store.shopify_access_token }
  }

  // 2. Fallback to integrations (removed after full migration)
  // userEmail sourced from getUserFromToken result: user.email
  return getShopifyCredentials(clientId, userEmail)
}
```

Call sites pass `user.email` as the third argument: `getStoreCredentials(storeId, user.id, user.email)`.

The fallback `getShopifyCredentials(userId, userEmail)` is already client-scoped: it queries `integrations WHERE client_id = userId` and `clients WHERE email = userEmail` — both filters enforce that only the authenticated client's credentials are returned. The authorization guarantee is maintained through the fallback path.

### `store_id` in API routes

All Shopify API routes accept `?store_id=` as a query param. The frontend always passes `activeStoreId` from `StoreContext`. Routes without a `store_id` param fall back to the single-store credentials path during the migration phase.

```js
// Pattern applied to all Shopify routes
const storeId = searchParams.get('store_id')
const creds = storeId
  ? await getStoreCredentials(storeId, user.id)
  : await getShopifyCredentials(user.id, user.email)  // fallback
```

### Shopify OAuth flow updates

The existing `oauth_states` table (columns: `state`, `user_id`, `shop`, `expires_at`, `client_id`, `client_secret`) requires one new column: `store_name text`. This is added via SQL migration.

- `POST /api/auth/shopify` — accepts optional `store_name` in request body; inserts it into the `oauth_states` row alongside existing fields
- `GET /api/auth/shopify/callback` — reads `store_name` from the `oauth_states` row, inserts a new row into `stores` (not `integrations`). Shopify webhooks registered with `?store_id={newStoreId}` instead of `?cid={userId}`. The `newStoreId` is the UUID generated when the `stores` row is inserted.

### Shopify webhook handler updates

`/api/webhooks/shopify` currently identifies stores by `?cid=` and reads `shopify_client_secret` from `integrations` for HMAC verification. It must be updated to:
- Accept both `?cid=` (legacy, reads from `integrations`) and `?store_id=` (new, reads from `stores`)
- When `store_id` is present: read `shopify_client_secret` from `stores` table for HMAC verification
- Populate `store_id` on upserted `shopify_orders` rows when processing webhook-delivered orders (`store_id` sourced from the `?store_id=` URL param)

This update is part of Phase 1 since it is a prerequisite for the new OAuth callback flow to work end-to-end.

### `shopify_orders` unique constraint

The current upsert conflict key is `(id, client_id)`. Migration to `(id, client_id, store_id)` requires a two-step atomic process to avoid duplicates during the transition:

1. **Backfill step** (runs before constraint change): a one-off migration script sets `store_id` on all existing `shopify_orders` rows by joining to `integrations` on `client_id` to find the matching store, then looking up the corresponding `stores` row. Since there are no production clients, this backfill operates on zero rows — the constraint can be swapped immediately with no gap.
2. **Constraint swap**: drop the old `UNIQUE(id, client_id)` constraint, add `UNIQUE(id, client_id, store_id)`. Done atomically in the same SQL migration.
3. **Upsert call sites**: all upsert calls updated to `onConflict: 'id,client_id,store_id'`.

**Deployment order is critical:** the application code update (step 3) must be deployed and confirmed running on all instances *before* the SQL migration (step 2) executes. This prevents a window where old code sends `onConflict: 'id,client_id'` against a DB that no longer has that constraint. On Vercel this means: deploy new app build → confirm deployment → then run the SQL migration via Supabase dashboard or migration script. Because there are no production clients, no live traffic runs during this window, making the sequence safe to execute manually.

### Sync route updates

- `POST /api/shopify/sync` — accepts `?store_id=` param; populates `store_id` on all upserted `shopify_orders` rows
- `POST /api/shopify/sync/customers` — same; populates `store_id` on `shopify_customers` rows

---

## Feature 3 — Store Context & Store Switcher

### `lib/contexts/StoreContext.js`

React context provider wrapping the authenticated app:

```js
// Provides:
{
  stores,          // all stores for the client, from GET /api/stores
  activeStore,     // full store object { id, name, shopifyDomain, shopifyConnectedAt }
  activeStoreId,   // UUID shorthand
  setActiveStore,  // switches active store + persists to localStorage
  storesLoading,   // boolean
}
```

**Mount behaviour:**
1. Fetches `GET /api/stores` — returns all stores for `user.id`
2. Reads `localStorage.getItem('lynq_active_store_id')` to restore last selection
3. If stored ID not in current list → falls back to first store in list
4. Sets `activeStore` and `activeStoreId`

All pages that fetch store-scoped data read `activeStoreId` from context and append `?store_id={activeStoreId}` to their API calls. Any store switch triggers re-fetch of current page data.

### `GET /api/stores` route

Returns all stores for the authenticated `user.id`:
```json
[
  { "id", "name", "shopifyDomain", "shopifyConnectedAt", "createdAt" }
]
```

### Store Switcher UI — Sidebar

- Positioned at top of sidebar, above nav items
- Shows active store name and Shopify domain
- Clicking opens a popover list of all connected stores
- Each item: store name, domain, connection status indicator (green = connected, red = token missing)
- "Add store" option at the bottom → navigates to Settings → Stores tab
- On selection: calls `setActiveStore(store)`, persists `id` to `localStorage`, closes popover
- When only one store exists: component renders as non-interactive display (no dropdown arrow) — consistent UI regardless of store count

---

## Feature 4 — Settings: Store Management

New "Stores" tab in `app/settings/page.js` replacing/extending the current single Shopify connection section.

### Store List

Each store rendered as a card:
- Store name (editable inline via `PATCH /api/stores/[id]`)
- Shopify domain (read-only after connection)
- Connection status badge: Connected / Disconnected
- Connected date
- Actions: **Disconnect**, **Delete**

### Add Store Flow

1. "Connect new store" button → input: store name + Shopify domain
2. Triggers existing Shopify OAuth flow with store name passed through state
3. On OAuth callback: new row inserted into `stores` → redirect to Settings with `?shopify=connected`

### Disconnect vs Delete

- **Disconnect:** `POST /api/stores/[id]/disconnect` — revokes Shopify access token via Shopify API, nulls `shopify_access_token` in `stores` row. Store record kept. Status badge shows "Disconnected". Can reconnect.
- **Delete:** `DELETE /api/stores/[id]` — removes store row + all `store_email_configs` for that store. Shows warning if `shopify_orders` exist for this store (soft warning only, not a block). `shopify_orders` and `shopify_customers` rows are **not** deleted — their `store_id` is set to `null` (orphaned, data preserved). `email_threads` with this `store_id` are also orphaned (`store_id` set to `null`) rather than deleted, preserving conversation history.

### Per-Store Email Configuration

Expandable section within each store card:
- Lists all `store_email_configs` rows for that store: provider icon, email address, connected date, Remove button
- "Add email" button → triggers Gmail or Outlook OAuth with `store_id` in OAuth state → on callback, inserts into `store_email_configs` (not `integrations`)
- Multiple email configs per store supported with no limit
- Remove: `DELETE /api/stores/[id]/email-configs/[configId]`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stores` | GET | List stores for client |
| `/api/stores` | POST | Create store record (called from OAuth callback) |
| `/api/stores/[id]` | PATCH | Update store name |
| `/api/stores/[id]` | DELETE | Delete store + email configs |
| `/api/stores/[id]/disconnect` | POST | Revoke + null access token |
| `/api/stores/[id]/email-configs` | GET | List email configs for store |
| `/api/stores/[id]/email-configs/[configId]` | DELETE | Remove email config |

---

## Feature 5 — Inbox Isolation & Email Routing

### Routing by OAuth Connection

Incoming emails are routed to a store at ingest time. Each `store_email_configs` row represents one email connection for one store. When a message arrives via Gmail or Outlook webhook/poll, the system resolves which `store_email_configs` row owns that connection and tags the thread with that row's `store_id`.

No manual routing or matching by email address is needed — routing is implicit from which connection received the message.

### Gmail/Outlook OAuth State Threading

Gmail and Outlook OAuth use a signed JWT state (via `createOAuthState()` / `verifyOAuthState()` in `lib/oauthState.js`) — not the `oauth_states` database table. To thread `store_id` through to the callback, `createOAuthState({ userId, provider })` is extended to accept `{ userId, provider, storeId }` and encode `storeId` in the JWT payload. The callback verifies the JWT and reads `storeId` from the decoded payload, then writes it into `store_email_configs`.

### Ingest Path Changes

- **Gmail/Outlook OAuth callbacks** — updated to write tokens into `store_email_configs` (with `store_id` from OAuth state) instead of `integrations`
- **Gmail/Outlook thread fetch routes** (`GET /api/gmail/threads`, `GET /api/outlook/threads`, etc.) — updated to read OAuth credentials from `store_email_configs` filtered by `store_id`
- **Incoming message routing — per provider:**
  - **Gmail:** Uses Google push notifications (Gmail Watch API). Watch registration fires **inside the Gmail OAuth callback** immediately after the `store_email_configs` row is inserted. On Watch registration success: `watch_expiry` is set to `now() + 7 days` on the config row. On failure: `watch_expiry` remains `null`; the config row is kept (not rolled back); Settings UI shows a recoverable "Watch not registered — click to retry" warning for that email config, with a manual retry button that calls `POST /api/stores/[id]/email-configs/[configId]/watch`. The Watch expires every 7 days; a Supabase scheduled Edge Function (using Supabase's built-in cron scheduling via `pg_cron`) runs daily, queries `store_email_configs WHERE provider = 'gmail' AND watch_expiry < now() + 1 day`, and renews each expiring Watch, updating `watch_expiry`. The cron schedule is defined in the Supabase dashboard (or via SQL: `select cron.schedule('gmail-watch-renewal', '0 6 * * *', 'select net.http_post(...)')`). This is the same mechanism used for the Shopify sync Edge Function defined in the backend architecture spec. Incoming push notifications include the `emailAddress` of the watched mailbox — matched against `store_email_configs.email_address` to resolve `store_id`.
  - **Outlook:** When registering an Outlook webhook subscription, set `clientState = store_email_config_id` (the UUID of the config row). On inbound notification, read `clientState` from the payload to resolve `store_id`
  - **Gorgias:** Webhook URL registered per store includes `?store_id={storeId}` — resolved directly from the URL param
- **Thread tagging:** Once `store_id` is resolved via any of the above methods, it is written to `email_threads.store_id` at ingest time

### Inbox Page Filtering

- Inbox reads `activeStoreId` from `StoreContext`
- All thread/conversation fetches pass `?store_id={activeStoreId}` — returns only threads for the active store
- Switching stores via the store switcher re-fetches the thread list instantly
- Threads from different stores are never mixed in the same view

### "All Stores" View

- Toggle in the inbox header: "All stores" / active store name
- When "All stores" selected: `store_id` filter removed; all threads shown with a store badge on each row
- Persisted to `localStorage` separately from `activeStoreId` (it is a view preference, not a store selection)
- Useful for agents monitoring all activity across stores

---

## Implementation Plan & Estimates

Estimates assume a human developer with minimal AI assistance. Organized by phase — each phase is independently shippable.

### Phase 1 — Database & Core Infrastructure

⚠️ **Constraint migration sequencing:** The `shopify_orders` unique constraint task must run *after* the app code that passes `store_id` in upserts is deployed. All other Phase 1 SQL migrations can run freely. See constraint swap section for details.

| Task | Hours | Notes |
|------|-------|-------|
| `stores` table SQL migration | 2h | |
| `store_email_configs` table SQL migration (incl. `watch_expiry` column) | 2h | |
| Add `store_id` columns to `shopify_orders`, `shopify_customers`, email threads | 3h | |
| `getStoreCredentials(storeId, clientId, userEmail)` with fallback | 3h | |
| Update Shopify OAuth callback to write to `stores` instead of `integrations` | 4h | |
| Update Shopify webhook handler to accept `?store_id=`, read from `stores`, populate `store_id` on orders | 4h | |
| Update all upsert call sites to `onConflict: 'id,client_id,store_id'` — deploy first | 2h | Deploy before constraint swap |
| Swap `shopify_orders` unique constraint to `(id, client_id, store_id)` — post-deploy SQL | 1h | Run after above is deployed |
| Store CRUD API routes (list, update name, disconnect, delete) | 6h | |
| Store email config API routes (list, delete, watch retry) | 3h | |
| **Subtotal** | **30h** | |

### Phase 2 — Store Context & Switcher

| Task | Hours |
|------|-------|
| `StoreContext` React provider + `GET /api/stores` route + localStorage persistence | 5h |
| Store switcher dropdown UI in sidebar | 5h |
| **Subtotal** | **10h** |

### Phase 3 — Settings Store Management UI

| Task | Hours |
|------|-------|
| Store cards list (connection status, inline name edit, disconnect, delete) | 8h |
| Add store flow (name input + Shopify OAuth connect) | 4h |
| Per-store email config section (list configs, add Gmail/Outlook, remove) | 6h |
| **Subtotal** | **18h** |

### Phase 4 — Data Scoping

| Task | Hours |
|------|-------|
| Update all Shopify API routes to accept and use `?store_id=` param | 8h |
| Update sync routes to populate `store_id` on upserted rows | 3h |
| Update orders, customers, analytics queries to filter by `store_id` | 4h |
| **Subtotal** | **15h** |

### Phase 5 — Inbox Isolation

| Task | Hours |
|------|-------|
| Extend `createOAuthState` JWT to carry `storeId`; update Gmail/Outlook callbacks to write to `store_email_configs` | 5h |
| Update thread/message routes to resolve credentials from `store_email_configs` | 5h |
| Gmail Watch registration per email config + 7-day renewal Edge Function | 6h |
| Update inbox page to filter threads by `activeStoreId` from `StoreContext` | 4h |
| "All stores" view toggle in inbox header | 3h |
| **Subtotal** | **23h** |

### Total Estimate: ~91h

---

## Constraints

- No production clients exist — no live data migration required
- `integrations` table is not removed in this spec — the fallback path stays until explicitly cleaned up in a follow-up
- Each store has one active Shopify connection; multiple email connections per store are allowed
- Store deletion is a soft warning if orders exist — data is not cascade deleted automatically
- `store_id = client_id` convention used in previous specs is superseded by this spec: `store_id` is now a proper UUID from the `stores` table
