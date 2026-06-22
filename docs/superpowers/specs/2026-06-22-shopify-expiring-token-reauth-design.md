# Shopify Expiring Offline Tokens + Reconnect Handling

**Date:** 2026-06-22
**Status:** Approved design — ready for implementation plan

## Problem

Logged-in users hit a `403 Forbidden` when calling Shopify-backed endpoints
(e.g. `GET /functions/v1/api/shopify/customer`). The body is Shopify's own error,
forwarded verbatim:

```json
{ "error": "{\"errors\":\"[API] Non-expiring access tokens are no longer accepted for the Admin API...\"}", "status": 403 }
```

This is **not** an authorization/permission block in our app. The Supabase auth
passed; the 403 originates from Shopify rejecting the store's stored access token.

## Root cause (confirmed end-to-end)

1. The OAuth token-exchange in `app/api/auth/shopify/callback/route.ts` posts
   `{ client_id, client_secret, code }` to `/admin/oauth/access_token` **without**
   the `expiring=1` flag. Per Shopify docs, omitting it yields a **non-expiring**
   offline token — no `expires_in`, no `refresh_token`.
2. The callback stores that token with `shopify_token_expires_at = NULL`
   (`callback/route.ts:133-135`).
3. `getStoreCredentials` (`lib/store-credentials.ts:90-92`) treats a NULL expiry as
   "non-expiring / valid forever" and returns the token as-is — never refreshing.
4. Shopify now rejects all such tokens with the 403 above; the route forwards it raw
   via `shopifyErrorResponse` (`supabase/functions/api/routes/shopify.ts:56-62`).

The fix to issue expiring tokens is a single required OAuth parameter (`expiring=1`).
Failure handling alone is insufficient: without Part A, a reconnect just mints
another non-expiring (dead) token — a reconnect loop.

## Scope

Two coordinated parts plus UI:

- **Part A — Root fix:** OAuth requests expiring offline tokens.
- **Part B — Reactive detection:** recognize the specific 403, flag the store, return
  a structured error code.
- **Part C — UI:** stores-page banner + Reconnect CTA; reconnect prompt in data views.

### Out of scope (explicitly)

- No `expiring=1` equivalent for manually pasted Admin API keys (`/manual-connect`).
  Part B still detects and flags those, but the only remedy is OAuth or a fresh key.
- The Next.js mirror (`lib/services/shopify.ts` + `app/api`) detection — follow-up.
  The live failing path is the Hono API; that is what this spec covers.
- Auto-revoking/recreating old webhooks on reconnect.

## Design

### Part A — OAuth issues expiring tokens

`app/api/auth/shopify/callback/route.ts` — add `expiring: '1'` to the token-exchange
request body:

```ts
body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, expiring: '1' }),
```

Shopify then returns `access_token` (`expires_in: 3600`), `refresh_token`
(`refresh_token_expires_in: 7776000`), which the callback already persists
(`callback/route.ts:132-156`) and `getStoreCredentials` already refreshes within a
5-minute buffer. No other change needed for the happy path.

### Part B — Reactive detection + status (Hono API)

In `supabase/functions/api/routes/shopify.ts`:

1. Add a predicate:

   ```ts
   function isNonExpiringTokenError(err: unknown): boolean {
     return err instanceof ShopifyApiError
       && err.statusCode === 403
       && /non-expiring access tokens are no longer accepted/i.test(err.message)
   }
   ```

2. Thread `workspaceId` + `storeId` into `shopifyErrorResponse`. When the predicate
   matches:
   - `UPDATE integrations SET status = 'reauth_required'` for that
     `(workspace_id, store_id)` via `getAdminClient()`.
   - Return `c.json({ error, code: 'reauth_required' }, 403)` so the frontend branches
     on `code`, not on Shopify's raw message.
   - Non-matching errors keep current behavior.

3. Update each Shopify route's `catch` to pass `ctx`/`storeId` into the helper. Routes
   already have both in scope.

### Migrations

- New migration: extend the `integrations_status_check` constraint to include
  `'reauth_required'` (currently `'pending' | 'connected' | 'error'`, defined in
  `20260505000001_integration_status_columns.sql`). Idempotent drop+recreate of the
  constraint; ends with `notify pgrst, 'reload schema'`.
- New migration: `CREATE OR REPLACE FUNCTION api_list_stores()` (from
  `20260602175833_phase3a-stores-rpc.sql`) to also return `i.status` in the row.

### Part C — UI (stores page banner + CTA)

- `types/stores.ts` — add `status: string | null` to `StorePublic`.
- `components/features/settings/stores/store-card.tsx`:
  - When `store.status === 'reauth_required'`, render a warning banner above the
    actions and a **Reconnect** button.
  - Reconnect calls `startShopifyOAuth(token, store.shopify_domain)` (existing helper
    in `hooks/settings/use-integration-mutations.ts`) and redirects to the returned URL.
  - **Pass `store_name: store.name`** through the OAuth initiation so the callback's
    `(workspace_id, name)` store upsert updates the existing store rather than creating
    a duplicate. Requires `app/api/auth/shopify/route.ts` to keep forwarding
    `store_name` (it already accepts it) and `startShopifyOAuth` to accept/forward it.
  - `StatusBadge` gains a "Reconnect required" visual state.
- Data views (inbox customer panel, `components/features/inbox/customer-panel.tsx` /
  `customer-sidebar.tsx`): when the API response carries `code: 'reauth_required'`,
  render a reconnect prompt linking to `/settings/workspace/stores` instead of a raw
  error toast.

## Data flow (after fix)

```
Connect/Reconnect ─OAuth(expiring=1)─▶ Shopify
   └─▶ integrations: access_token + expires_at + refresh_token, status='connected'

API call ─▶ getStoreCredentials (auto-refresh if near expiry) ─▶ Shopify ✓

If token still rejected (legacy/manual) ─▶ shopifyErrorResponse detects 403 signature
   └─▶ integrations.status='reauth_required' + {code:'reauth_required'}
       └─▶ stores page shows banner + Reconnect ; data views show reconnect prompt
```

## Testing

- Deno test (`supabase/functions/api/`) for `isNonExpiringTokenError`:
  - 403 + matching message → true
  - 403 + unrelated message → false
  - non-403 `ShopifyApiError` / non-`ShopifyApiError` → false
- Migration check: constraint accepts `'reauth_required'`; `api_list_stores` returns
  `status`.
- `npm run lint` clean.

## Affected files

- `app/api/auth/shopify/callback/route.ts` (Part A)
- `app/api/auth/shopify/route.ts` (forward `store_name` for reconnect)
- `supabase/functions/api/routes/shopify.ts` (Part B)
- `supabase/migrations/<new>_integration_reauth_status.sql`
- `supabase/migrations/<new>_api_list_stores_status.sql`
- `types/stores.ts`
- `components/features/settings/stores/store-card.tsx`
- `components/features/settings/status-badge.tsx`
- `hooks/settings/use-integration-mutations.ts` (`startShopifyOAuth` store_name)
- `components/features/inbox/customer-panel.tsx` / `customer-sidebar.tsx`
- Deno test under `supabase/functions/api/tests/`
