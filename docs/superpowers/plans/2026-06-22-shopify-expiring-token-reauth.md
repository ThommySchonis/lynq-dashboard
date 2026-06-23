# Shopify Expiring Token + Reconnect Handling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Shopify OAuth issue expiring offline tokens, and when a token is rejected as non-expiring, flag the store and drive a clean reconnect instead of a raw 403.

**Architecture:** One root fix (`expiring=1` on the OAuth token exchange) wires up the already-built refresh machinery. A reactive detector in the Hono API recognizes Shopify's "non-expiring token" 403, sets `integrations.status = 'reauth_required'`, and returns a `code: 'reauth_required'` payload. The stores settings page surfaces a banner + Reconnect CTA; the inbox customer lookup shows a reconnect prompt.

**Tech Stack:** Next.js 16 (app router) OAuth route, Hono/Deno edge function (`supabase/functions/api`), PostgreSQL migrations + RPC, TanStack Query, React 19, Tailwind tokens.

## Global Constraints

- TypeScript only; no `any` (use `unknown` / specific interfaces). ESLint-enforced.
- Imports use the `@/` path alias (no `../../../`).
- Every query against a `workspace_id` table must filter by `workspace_id`.
- Routes are thin wrappers; business logic stays in services. DB writes via the admin client.
- Shopify API calls only via `shopifyFetchJSON()` in the service layer — never from a route/component.
- Token classes/predicates live beside `ShopifyApiError` in `supabase/functions/api/lib/services/shopify.ts`.
- Do **not** hardcode hex colors; use existing token classes (follow `status-badge.tsx`).
- **No git commit/push steps** (per `CLAUDE.local.md`). Each task ends on a verification step.
- Deno tests run from `supabase/functions/api/`: `deno test --allow-read tests/<name>.test.ts`.
- Lint runs from `lynq-dashboard/`: `npm run lint`.
- Shopify Admin API version in use: `2025-04` (manual-connect/webhooks) / `SHOPIFY_API_VERSION` const (service). Do not change.

---

## File Structure

- `app/api/auth/shopify/callback/route.ts` — add `expiring: '1'` to token exchange.
- `app/api/auth/shopify/route.ts` — keep forwarding `store_name` (already accepts it; no change unless missing).
- `hooks/settings/use-integration-mutations.ts` — `startShopifyOAuth` accepts optional `storeName`.
- `supabase/functions/api/lib/services/shopify.ts` — export `isNonExpiringTokenError()` predicate.
- `supabase/functions/api/routes/shopify.ts` — `flagReauthRequired()` + updated `shopifyErrorResponse()` + catch wiring.
- `supabase/functions/api/tests/reauth-detection.test.ts` — predicate tests.
- `supabase/migrations/<ts>_integration_reauth_status.sql` — extend status constraint.
- `supabase/migrations/<ts>_api_list_stores_status.sql` — RPC returns `status`.
- `types/stores.ts` — `StorePublic.status`.
- `components/features/settings/status-badge.tsx` — `reauth` state + `ConnectionStatus` union.
- `types/settings.ts` — add `'reauth'` to `ConnectionStatus`.
- `components/features/settings/stores/store-card.tsx` — banner + Reconnect button.
- `components/features/inbox/customer-sidebar.tsx` — reconnect prompt on `code: 'reauth_required'`.

---

## Task 1: OAuth requests expiring offline tokens

**Files:**
- Modify: `app/api/auth/shopify/callback/route.ts:85-89`

**Interfaces:**
- Consumes: nothing new.
- Produces: token exchanges now return `expires_in` / `refresh_token` (already persisted by existing code at `callback/route.ts:132-156`).

- [ ] **Step 1: Add `expiring: '1'` to the token-exchange body**

In `app/api/auth/shopify/callback/route.ts`, change the fetch body:

```ts
  // Exchange code for token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, expiring: '1' }),
  })
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual verification note (no automated test — external Shopify call)**

After deploy, reconnect a store and confirm the new `integrations` row has non-null `shopify_token_expires_at` and a `shopify_refresh_token`. Document this as a post-deploy check; do not block the plan on it.

---

## Task 2: `startShopifyOAuth` forwards the existing store name (reconnect safety)

**Files:**
- Modify: `hooks/settings/use-integration-mutations.ts:139-151`

**Interfaces:**
- Consumes: `POST /api/auth/shopify` body `{ shop, store_name? }` (route already reads `store_name`).
- Produces: `startShopifyOAuth(token: string, shop: string, storeName?: string): Promise<string>`.

- [ ] **Step 1: Add optional `storeName` param and forward it**

Replace the `startShopifyOAuth` function:

```ts
export async function startShopifyOAuth(token: string, shop: string, storeName?: string): Promise<string> {
  const res = await fetch('/api/auth/shopify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ shop, store_name: storeName }),
  })
  if (!res.ok) {
    const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
    throw new Error(d.error || 'Failed to start Shopify OAuth')
  }
  const data = await parseJson<ShopifyOAuthResponse>(res)
  return data.url
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no new errors.

---

## Task 3: Migration — allow `'reauth_required'` integration status

**Files:**
- Create: `supabase/migrations/<ts>_integration_reauth_status.sql` (use the next timestamp, e.g. `20260622010000`)

**Interfaces:**
- Produces: `integrations.status` accepts `'pending' | 'connected' | 'error' | 'reauth_required'`.

- [ ] **Step 1: Write the migration**

```sql
-- Allow 'reauth_required' on integrations.status so a store whose Shopify token
-- was rejected (non-expiring token deprecation) can be flagged for reconnect.
begin;

alter table public.integrations
  drop constraint if exists integrations_status_check;

alter table public.integrations
  add constraint integrations_status_check
  check (status in ('pending', 'connected', 'error', 'reauth_required'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'integrations_status_check'
      and conrelid = 'public.integrations'::regclass
  ) then
    raise exception 'integrations_status_check missing after migration';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply locally and verify the value is accepted**

Run (local Supabase): `supabase db reset` (or `supabase migration up`), then in a script/migration test insert/update a row with `status = 'reauth_required'`.
Expected: update succeeds; updating to `status = 'bogus'` fails the check constraint.

---

## Task 4: Migration — `api_list_stores` returns integration status

**Files:**
- Create: `supabase/migrations/<ts>_api_list_stores_status.sql` (timestamp after Task 3, e.g. `20260622010100`)

**Interfaces:**
- Produces: `api_list_stores()` rows include `status` (from `integrations.status`, null when no integration).

- [ ] **Step 1: Write the CREATE OR REPLACE migration**

```sql
-- api_list_stores: also expose integration status so the UI can show a
-- "Reconnect required" state for stores flagged reauth_required.
CREATE OR REPLACE FUNCTION api_list_stores()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result json;
BEGIN
  SELECT COALESCE(json_agg(row_data ORDER BY row_data.created_at ASC), '[]'::json)
  INTO v_result
  FROM (
    SELECT s.id, s.name, s.created_at,
           i.shopify_domain, i.shopify_connected_at, i.store_currency, i.status
    FROM stores s
    LEFT JOIN integrations i ON i.store_id = s.id AND i.workspace_id = v_ws
    WHERE s.workspace_id = v_ws
  ) row_data;

  RETURN json_build_object('stores', v_result);
END;
$$;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply and verify**

Run: `supabase migration up` (or `supabase db reset`).
Then call the RPC (via the app or `select api_list_stores();`) and confirm each store row includes a `status` key.
Expected: connected stores show `"status": "connected"`; stores without an integration show `"status": null`.

---

## Task 5: Detection predicate (`isNonExpiringTokenError`)

**Files:**
- Modify: `supabase/functions/api/lib/services/shopify.ts` (add + export predicate near `ShopifyApiError`)
- Create: `supabase/functions/api/tests/reauth-detection.test.ts`

**Interfaces:**
- Consumes: `ShopifyApiError` (existing export with `statusCode: number`, `message: string`).
- Produces: `export function isNonExpiringTokenError(err: unknown): boolean`.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/api/tests/reauth-detection.test.ts`:

```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { ShopifyApiError, isNonExpiringTokenError } from '../lib/services/shopify.ts'

Deno.test('matches the Shopify non-expiring token 403', () => {
  const err = new ShopifyApiError(
    '[API] Non-expiring access tokens are no longer accepted for the Admin API.',
    403,
    '/customers.json',
  )
  assertEquals(isNonExpiringTokenError(err), true)
})

Deno.test('ignores other 403 errors', () => {
  const err = new ShopifyApiError('Forbidden: scope missing', 403, '/customers.json')
  assertEquals(isNonExpiringTokenError(err), false)
})

Deno.test('ignores non-403 ShopifyApiError', () => {
  const err = new ShopifyApiError('Non-expiring access tokens are no longer accepted', 429, '/x.json')
  assertEquals(isNonExpiringTokenError(err), false)
})

Deno.test('ignores non-ShopifyApiError values', () => {
  assertEquals(isNonExpiringTokenError(new Error('Non-expiring access tokens...')), false)
  assertEquals(isNonExpiringTokenError(null), false)
})
```

> Use the std assert version already used by sibling tests in `supabase/functions/api/tests/`. If a different `std` version is imported there, match it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd supabase/functions/api && deno test --allow-read tests/reauth-detection.test.ts`
Expected: FAIL — `isNonExpiringTokenError` is not exported.

- [ ] **Step 3: Implement the predicate**

In `supabase/functions/api/lib/services/shopify.ts`, directly after the `ShopifyApiError` class:

```ts
/**
 * True when an error is Shopify rejecting a non-expiring Admin API access token
 * (the deprecation that requires the store to reconnect via OAuth with expiring tokens).
 */
export function isNonExpiringTokenError(err: unknown): boolean {
  return err instanceof ShopifyApiError
    && err.statusCode === 403
    && /non-expiring access tokens are no longer accepted/i.test(err.message)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd supabase/functions/api && deno test --allow-read tests/reauth-detection.test.ts`
Expected: PASS (4 tests).

---

## Task 6: Flag store + return `reauth_required` in the Hono routes

**Files:**
- Modify: `supabase/functions/api/routes/shopify.ts` (imports, new `flagReauthRequired`, updated `shopifyErrorResponse`, catch wiring)

**Interfaces:**
- Consumes: `isNonExpiringTokenError` (Task 5), `getAdminClient` (existing import), `ShopifyApiError` (existing import).
- Produces:
  - `async function flagReauthRequired(workspaceId: string, storeId: string): Promise<void>`
  - `shopifyErrorResponse(c, err, workspaceId?: string, storeId?: string): Promise<Response>` (now async)
  - Error payload shape for rejected tokens: `{ error: string, code: 'reauth_required' }` with HTTP 403.

- [ ] **Step 1: Update the import to include the predicate**

In `supabase/functions/api/routes/shopify.ts`, add `isNonExpiringTokenError` to the existing import block from `../lib/services/shopify.ts`:

```ts
import {
  getKPIs,
  getRevenueTrend,
  checkConnectionStatus,
  getAnalytics,
  getOrders,
  getOrderDetail,
  getRefunds,
  getCustomer,
  createRefund,
  cancelOrder,
  editOrder,
  duplicateOrder,
  updateOrderNote,
  updateOrderAddress,
  fulfillOrder,
  syncOrders,
  searchProducts,
  createDraftOrder,
  ShopifyApiError,
  isNonExpiringTokenError,
} from '../lib/services/shopify.ts'
```

- [ ] **Step 2: Add `flagReauthRequired` and make `shopifyErrorResponse` detect + flag**

Replace the existing `shopifyErrorResponse` function (lines ~56-62) with:

```ts
async function flagReauthRequired(workspaceId: string, storeId: string): Promise<void> {
  try {
    await getAdminClient()
      .from('integrations')
      .update({ status: 'reauth_required' })
      .eq('workspace_id', workspaceId)
      .eq('store_id', storeId)
  } catch (e) {
    logger.error('[shopify]', 'failed to flag reauth_required', { error: e instanceof Error ? e.message : String(e) })
  }
}

async function shopifyErrorResponse(
  c: { json: (data: unknown, status: number) => Response },
  err: unknown,
  workspaceId?: string,
  storeId?: string,
): Promise<Response> {
  if (isNonExpiringTokenError(err)) {
    if (workspaceId && storeId) await flagReauthRequired(workspaceId, storeId)
    return c.json(
      { error: 'Shopify connection needs to be re-authorized', code: 'reauth_required' },
      403,
    )
  }
  if (err instanceof ShopifyApiError) {
    return c.json({ error: err.message, status: err.statusCode }, err.statusCode >= 500 ? 502 : err.statusCode)
  }
  const message = err instanceof Error ? err.message : 'Unknown error'
  return c.json({ error: message }, 502)
}
```

- [ ] **Step 3: Await every `shopifyErrorResponse` call and pass context where available**

`shopifyErrorResponse` is now async. Update every call site to `return await shopifyErrorResponse(...)`. Pass `ctx.workspaceId, storeId` at sites where both are in scope (all routes except `/products`, which has `ctx` but resolves `storeId` — pass it there too since it is defined before the try).

Exact replacements (all in `supabase/functions/api/routes/shopify.ts`):

- `/orders/:id` catch → `return await shopifyErrorResponse(c, err, ctx.workspaceId, storeId)`
- `/customer` catch → `return await shopifyErrorResponse(c, err, ctx.workspaceId, storeId)`
- `/products` catch → `return await shopifyErrorResponse(c, err, ctx.workspaceId, storeId)`
- `/orders/:id/refund`, `/cancel`, `/edit`, `/duplicate`, `/note`, `/address`, `/fulfill`, `/orders/create` catches → `return await shopifyErrorResponse(c, err, ctx.workspaceId, storeId)`
- Legacy `/cancel-order`, `/refund-order`, `/duplicate-order`, `/edit-address` catches → `return await shopifyErrorResponse(c, err, ctx.workspaceId, storeId)`

- [ ] **Step 4: Flag (not cache-mask) in the degraded routes**

The `/kpis`, `/revenue-trend`, `/orders`, `/refunds` handlers fall back to cached data inside `catch`. A reauth error must flag the store and prompt reconnect rather than silently show stale data. At the **top of each of those four catch blocks**, before the cached-data query, add:

```ts
    if (isNonExpiringTokenError(err)) {
      await flagReauthRequired(ctx.workspaceId, storeId)
      return c.json({ error: 'Shopify connection needs to be re-authorized', code: 'reauth_required' }, 403)
    }
```

(Leave the existing cache fallback in place for all other errors. The trailing `return shopifyErrorResponse(c, err)` in those handlers becomes `return await shopifyErrorResponse(c, err, ctx.workspaceId, storeId)`.)

- [ ] **Step 5: Type-check the edge function**

Run: `cd supabase/functions/api && deno check index.ts`
Expected: no type errors (all `shopifyErrorResponse` calls awaited; signature matches).

- [ ] **Step 6: Re-run the predicate test suite**

Run: `cd supabase/functions/api && deno test --allow-read tests/reauth-detection.test.ts`
Expected: PASS (4 tests).

---

## Task 7: Expose `status` on `StorePublic` + `ConnectionStatus`

**Files:**
- Modify: `types/stores.ts` (`StorePublic`)
- Modify: `types/settings.ts:131` (`ConnectionStatus`)

**Interfaces:**
- Produces: `StorePublic.status: string | null`; `ConnectionStatus` includes `'reauth'`.

- [ ] **Step 1: Add `status` to `StorePublic`**

In `types/stores.ts`, in the `StorePublic` interface:

```ts
export interface StorePublic {
  id: string
  name: string
  // Joined from integrations:
  shopify_domain: string | null
  shopify_connected_at: string | null
  store_currency: string | null
  status: string | null
  created_at: string
}
```

- [ ] **Step 2: Extend `ConnectionStatus`**

In `types/settings.ts`:

```ts
export type ConnectionStatus = 'active' | 'pending' | 'error' | 'disconnected' | 'reauth'
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no new errors (TypeScript may now flag `StatusBadge`'s `statusConfig` as missing the `reauth` key — fixed in Task 8).

---

## Task 8: `StatusBadge` gains a "Reconnect required" state

**Files:**
- Modify: `components/features/settings/status-badge.tsx`

**Interfaces:**
- Consumes: `ConnectionStatus` with `'reauth'` (Task 7).
- Produces: `StatusBadge` renders an amber/destructive "Reconnect required" badge for `status="reauth"`.

- [ ] **Step 1: Add the `reauth` entry to `statusConfig`**

In `components/features/settings/status-badge.tsx`, add to the `statusConfig` record (use token-aligned classes consistent with the existing `error`/`pending` entries):

```ts
  reauth: {
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/25',
    defaultLabel: 'Reconnect required',
  },
```

- [ ] **Step 2: Verify lint + types pass**

Run: `npm run lint`
Expected: no errors — `statusConfig` now covers every `ConnectionStatus` member.

---

## Task 9: Stores card — banner + Reconnect CTA

**Files:**
- Modify: `components/features/settings/stores/store-card.tsx`

**Interfaces:**
- Consumes: `store.status` (Task 7), `StatusBadge` `reauth` state (Task 8), `startShopifyOAuth(token, shop, storeName?)` (Task 2).
- Produces: visible banner + Reconnect button when `store.status === 'reauth_required'`.

- [ ] **Step 1: Import the OAuth starter and add reconnect state**

In `store-card.tsx`, add the import:

```ts
import { startShopifyOAuth } from '@/hooks/settings/use-integration-mutations'
```

Inside the component, after the existing `isConnected` line, add:

```ts
  const needsReauth = store.status === 'reauth_required'
  const [reconnecting, setReconnecting] = useState(false)

  async function handleReconnect() {
    if (!store.shopify_domain) return
    setReconnecting(true)
    try {
      const url = await startShopifyOAuth(token, store.shopify_domain, store.name)
      window.location.href = url
    } catch {
      setReconnecting(false)
    }
  }
```

- [ ] **Step 2: Show the reauth badge instead of "Connected" when flagged**

Replace the `StatusBadge` in the header:

```tsx
          <StatusBadge
            status={needsReauth ? 'reauth' : isConnected ? 'active' : 'disconnected'}
            label={needsReauth ? 'Reconnect required' : isConnected ? 'Connected' : 'Disconnected'}
          />
```

- [ ] **Step 3: Render the banner + Reconnect button**

Immediately after the `{/* Domain + dates */}` block (before `{/* Actions */}`), add:

```tsx
        {needsReauth && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Shopify rejected this store&apos;s access token. Reconnect to restore order, refund and customer data.
            </p>
            <Button
              size="sm"
              onClick={handleReconnect}
              disabled={isSuspended || reconnecting || !canManage || !store.shopify_domain}
              title={adminTitle}
              className="self-start"
            >
              {reconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUpRight className="size-3.5" />}
              Reconnect Shopify
            </Button>
          </div>
        )}
```

(`Loader2` and `ArrowUpRight` are already imported in this file.)

- [ ] **Step 4: Verify lint + manual render**

Run: `npm run lint`
Expected: no errors.
Manual: temporarily set a store's `integrations.status = 'reauth_required'` in local DB, load `/settings/workspace/stores`, confirm the amber banner + Reconnect button appear and the button redirects to Shopify OAuth.

---

## Task 10: Inbox customer lookup — reconnect prompt on `reauth_required`

**Files:**
- Modify: `components/features/inbox/customer-sidebar.tsx`

**Interfaces:**
- Consumes: `rawCustomer` from `useCustomerSearch` — the JSON body of `/shopify/customer`, which is `{ code: 'reauth_required', error }` when the token is rejected (the hook returns the body regardless of HTTP status).
- Produces: a reconnect prompt (linking to `/settings/workspace/stores`) shown in place of customer results when `rawCustomer?.code === 'reauth_required'`.

- [ ] **Step 1: Detect the reauth code from the search result**

In `customer-sidebar.tsx`, where `rawCustomer` is read (around line 141), derive a flag:

```ts
  const { data: rawCustomer, isLoading: loadingCust } = useCustomerSearch(customerQuery)
  const needsReauth = (rawCustomer as { code?: string } | undefined)?.code === 'reauth_required'
```

- [ ] **Step 2: Render the reconnect prompt**

In the render branch that shows customer results / "no customer", add a guarded block before the normal results (match the file's existing empty/loading pattern, e.g. `EmptyState` or a simple panel):

```tsx
        {needsReauth ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This store&apos;s Shopify connection needs to be re-authorized before customer data can load.
            </p>
            <a
              href="/settings/workspace/stores"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Go to store settings to reconnect →
            </a>
          </div>
        ) : (
          /* existing customer-result / loading / empty rendering stays here */
          null
        )}
```

> Integrate this with the existing conditional rendering rather than duplicating it — the `needsReauth` branch takes priority over the normal results, and the existing loading/empty/results JSX goes in the `else`.

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: no errors.
Manual: with a store flagged `reauth_required`, search a customer in the inbox and confirm the reconnect prompt renders instead of an error/empty state.

---

## Self-Review (completed)

**Spec coverage:**
- Part A (`expiring=1`) → Task 1. Reconnect store-name safety → Task 2.
- Part B detection predicate → Task 5; flag + `code` payload + route wiring (incl. degraded routes) → Task 6.
- Migrations (status constraint, RPC `status`) → Tasks 3, 4.
- Part C UI (type, badge, stores banner/CTA, customer prompt) → Tasks 7, 8, 9, 10.
- Testing (Deno predicate tests, migration checks, lint) → Task 5 + verification steps throughout.
- Out-of-scope items (manual-key `expiring`, Next.js mirror, webhook recreation) intentionally have no tasks.

**Placeholder scan:** No TBD/TODO; the one `null` placeholder in Task 10 Step 2 is explicitly annotated to merge with existing JSX. Migration filenames use `<ts>` with concrete example timestamps.

**Type consistency:** `isNonExpiringTokenError` (Tasks 5/6), `flagReauthRequired` (Task 6), `startShopifyOAuth(token, shop, storeName?)` (Tasks 2/9), `StorePublic.status` (Tasks 7/9), `ConnectionStatus` `'reauth'` (Tasks 7/8), DB value `'reauth_required'` vs UI badge state `'reauth'` are deliberately distinct and used consistently.
