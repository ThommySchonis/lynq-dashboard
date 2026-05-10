# Shopify Connection Flow, API Verification & Inbox Order Panel

**Date:** 2026-05-08
**Status:** Approved
**Depends on:** `2026-04-30-shopify-orders-refunds-inbox-design.md`

---

## Context

All Shopify backend API routes exist and are code-complete, but the connection flow in the Settings UI is stubbed out — clicking "Connect" shows a "coming soon" toast. Without a working connection, no Shopify endpoints can be tested or used. This spec covers:

1. Wiring the Shopify connect/disconnect flow in Settings
2. Verifying all existing API routes against a real Shopify store via curl
3. Fixing the `/api/shopify/customer` route to support `?order=` param
4. Implementing the inbox order panel UI per the existing orders/refunds spec

---

## Phase 1 — Shopify Connection Flow

### What changes

Replace the hardcoded "coming soon" toast in `app/settings/page.js` (line 722) with a connect modal that calls the existing `POST /api/shopify/manual-connect` endpoint.

### Connect Modal

| Field | Type | Placeholder | Validation |
|-------|------|-------------|------------|
| Shop domain | Text input | `your-store.myshopify.com` | Required, non-empty |
| Access token | Password input | `shpat_...` | Required, non-empty |

### Flow

1. User clicks "Connect" on the **Shopify** integration card (only Shopify gets this behavior; other integrations keep their existing "coming soon" toast or connected state)
2. Modal opens with shop domain + access token fields
3. User fills fields, clicks "Connect Shopify"
4. Frontend calls `POST /api/shopify/manual-connect` with `{ shop, accessToken }`
5. Backend validates token against Shopify's `/shop.json` endpoint (already implemented)
6. **On success:** modal closes, optimistically update local `integrations` state to `{ ...integrations, shopify: true }` (no refetch needed), show success toast
7. **On error:** inline error message inside modal, modal stays open for retry

### Connected State

When `integrations?.shopify` is true:
- Show green "Connected" badge (already implemented)
- Add a "Disconnect" button next to the badge
- Disconnect click → confirmation prompt → calls `PATCH /api/shopify/manual-connect` (see backend fix below) → optimistically update state, revert to "Connect" button

### Backend fix: Disconnect must not delete entire row

The current `DELETE /api/shopify/manual-connect` does `supabaseAdmin.from('integrations').delete().eq('client_id', user.id)` — this destroys ALL integration data (including parcelpanel_api_key).

**Fix:** Change the DELETE handler to an UPDATE that nulls only Shopify columns:
```js
await supabaseAdmin.from('integrations').update({
  shopify_domain: null,
  shopify_access_token: null,
  shopify_connected_at: null,
}).eq('client_id', user.id)
```

### Implementation scope

- Add `ShopifyConnectModal` component inline in `app/settings/page.js`
- Add `showShopifyModal` state + `connectShopify()` handler to `IntegrationsTab`
- Only the Shopify card's onClick opens the modal; other cards keep generic "coming soon" toast
- Add disconnect button + `disconnectShopify()` handler with confirmation
- Re-use existing CSS classes: `.modal-backdrop`, `.modal-box`, `.settings-input`, `.primary-btn`, `.danger-btn`
- If modal CSS doesn't exist in settings page, add minimal modal styles matching the inbox modal pattern

---

## Phase 2 — API Verification via curl

### Endpoints to verify (in order)

| # | Method | Route | What to check |
|---|--------|-------|---------------|
| 1 | GET | `/api/shopify/status` | Returns `{ connected: true, shop: "..." }` |
| 2 | GET | `/api/shopify/orders` | Returns array of orders with correct field mapping |
| 3 | GET | `/api/shopify/orders/[id]` | Returns full order detail with line items, fulfillments, refunds |
| 4 | GET | `/api/shopify/customer?email={email}` | Returns customer + orders for a known customer email |
| 5 | GET | `/api/shopify/customer?order={number}` | Returns customer + orders (requires Phase 2 fix) |
| 6 | POST | `/api/shopify/orders/[id]/cancel` | Cancels a test order (verify with caution) |
| 7 | POST | `/api/shopify/orders/[id]/refund` | Refunds a test order (verify with caution) |
| 8 | POST | `/api/shopify/orders/[id]/duplicate` | Creates draft order, returns invoice URL |
| 9 | POST | `/api/shopify/sync` | Syncs orders to `shopify_orders` table |
| 10 | GET | `/api/shopify/kpis` | Returns KPI data from synced orders |

### Customer route fixes

**Fix 1: Add `?order=` support**

Current state: `/api/shopify/customer` only accepts `?email=` param and hard-fails with `Missing email` if not present.

Required changes in `app/api/shopify/customer/route.js`:
- Read both `?email=` and `?order=` query params
- Change the early-return guard: if **neither** `email` nor `order` is provided → return 400 `Missing email or order`
- If `order` param present: strip leading `#`, call Shopify `/orders.json?name={order}&status=any&limit=1`, extract customer ID from matched order, then fetch customer + orders (same as email path)
- If no order found, return `{ customer: null, orders: [] }`

Detection logic stays in the frontend (inbox search input): `#` or numeric → `?order=`, contains `@` → `?email=`.

**Fix 2: Extend order response shape**

The current customer route returns `hasRefund: boolean` per order, but the inbox spec's refund % computation needs `refunds` array (to count `o.refunds.length > 0`). Also missing `cancelledAt` field needed for Cancel button disabled state.

Add to each order in the response:
- `refunds: o.refunds || []` (full array, replacing `hasRefund`)
- `cancelledAt: o.cancelled_at || null`

**Fix 3: Order limit**

Currently fetches `limit=5`. Increase to `limit=50` to improve refund rate accuracy. Note: refund rate is still approximate for customers with 50+ orders — the customer header should display "~" prefix for customers where `ordersCount > 50`.

### Verification approach

- Start dev server (`npm run dev`)
- Obtain session token via Supabase auth (browser dev tools or direct API call)
- Run curl commands against `http://localhost:3000`
- Fix any failures before proceeding to Phase 3

---

## Phase 3 — Inbox Order Panel UI

Implemented exactly per `2026-04-30-shopify-orders-refunds-inbox-design.md`. No design changes — this section summarizes the implementation scope for planning purposes.

### Components (all inline in `app/inbox/page.js`)

1. **Customer Header** — name, email, phone, orders count, total spent, refund rate badge (≤10% none, 11-30% yellow, >30% red)
2. **Manual Search** — input field, detects email vs order number, calls `/api/shopify/customer`
3. **Order List** — accordion rows, newest first, financial + fulfillment status badges
4. **Expanded Order Detail** — line items, shipping address, fulfillment tracking, 3 action buttons
5. **Cancel Modal** — reason dropdown (customer/fraud/inventory/declined/other), restock toggle, notify toggle, refund checkbox
6. **Refund Modal** — mode toggle (line items/custom amount), reason taxonomy (8 options), notify toggle, analytics event
7. **Duplicate Modal** — read-only line items, discount type/value, keep shipping toggle, note field

### State management

- `customerContext` — holds customer + orders, auto-loaded on conversation open
- Auto-lookup: extract sender email from active conversation → `GET /api/shopify/customer?email=`
- Cache per conversation (reset when switching threads)
- Manual search: resets context, re-fetches

### Loading/error states

- Auto-lookup in progress → skeleton placeholder
- No customer found → neutral message + search input
- Shopify not connected → "Connect Shopify to see order data" prompt
- API error → inline error with retry button

### Modal behavior

- Success → update order row status in local state (no refetch), show confirmation, close modal
- Error → show error inside modal, keep open for retry
- Refund success additionally emits fire-and-forget analytics event per spec

---

## Constraints

- All work stays inside existing files — no new component files (monolithic inbox pattern)
- Modal CSS in settings page follows same patterns as inbox modals
- Cancel/refund actions on real orders are destructive — curl verification uses test orders only
- Analytics event on refund is fire-and-forget — never blocks UI
- No OAuth flow needed — manual connect (shop domain + access token) is sufficient
