# Shopify Orders, Refunds & Inbox Integration Design

**Date:** 2026-04-30
**Status:** Approved
**Covers:** `tasks/link-orders-to-shopify.md`, `tasks/cancel-order.md`, `tasks/draft-orders.md`, `tasks/shopify-refund.md`, `tasks/refund-additional-logic.md`

---

## Context

All backend APIs for order operations already exist and are functional:

| API Route | Status |
|-----------|--------|
| `GET /api/shopify/orders` | ✅ exists — live order list from Shopify |
| `GET /api/shopify/orders/[id]` | ✅ exists — full order detail |
| `POST /api/shopify/orders/[id]/cancel` | ✅ exists — cancel with restock/refund options |
| `POST /api/shopify/orders/[id]/refund` | ✅ exists — full/partial/custom amount refund |
| `POST /api/shopify/orders/[id]/duplicate` | ✅ exists — creates Shopify draft order from existing order |
| `GET /api/shopify/customer` | Needs extension: must handle `?email=` and `?order=` params |

This spec covers the **inbox UI integration** of these APIs: how orders are found for a conversation, how they are displayed, and how agents perform order actions. It also covers refund reason capture wired to the analytics system defined in the backend architecture spec.

---

## Feature 1 — Order-to-Conversation Linking

### Customer Identification Flow

When an agent opens a conversation in the inbox, the right order panel attempts to identify the customer automatically, then falls back to manual search.

**Auto-lookup:**
1. Extract the sender email from the active conversation
2. Call `GET /api/shopify/customer?email={email}` — returns customer profile + orders
3. If found → populate customer context and render order panel
4. If not found → render manual search UI immediately (no blocking error message)

**Manual search fallback:**
- Single input field accepts either an order number (e.g. `#1042`) or an email address
- Detection logic: if input starts with `#` or is purely numeric → call `GET /api/shopify/customer?order={input}`; otherwise (contains `@`) → call `GET /api/shopify/customer?email={input}`
- The `/api/shopify/customer` route must support both `?email=` and `?order=` query params. For `?order=`: look up the order by name in Shopify, then load the associated customer and their full order list
- On match: loads customer + orders and renders the panel identically to the auto-lookup path
- "Search different customer" link in the customer header resets context and returns to search input

**Customer Context Object** (held in component state, passed down to all order panel sub-components):
```js
{
  customer: {
    id, firstName, lastName, email, phone,
    ordersCount, totalSpent, currency,
    refundPct   // computed: see Refund % section below
  },
  orders: [
    {
      id, name, createdAt,
      financialStatus, fulfillmentStatus,
      cancelReason, cancelledAt,
      lineItems: [{ id, title, variantTitle, sku, quantity, price }],
      refunds, fulfillments,
      shippingAddress, totalPrice, currency
    }
  ]
}
```

---

## Feature 2 — Order Panel UI

### Structure

The right panel of the inbox is divided into three layers:

**Customer Header** (always visible when customer is identified):
- Full name, email, phone
- Total orders count + total spent
- Refund rate badge — see Refund % section
- "Search different customer" link

**Order List:**
- Each order row: order name, date, financial status badge, fulfillment status badge
- Sorted newest first
- Clicking an order expands it inline (accordion); other orders collapse

**Expanded Order Detail:**
- Line items list (title, variant, qty, price)
- Shipping address
- Fulfillment info with tracking number/link if present
- Three action buttons: **Cancel**, **Refund**, **Duplicate**
- Button disabled states:
  - Cancel: disabled if `cancelledAt` is set
  - Refund: disabled if `financialStatus === 'refunded'`
  - Duplicate: always enabled

**Empty / Loading / Error States:**
- Auto-lookup in progress → skeleton placeholder in sidebar
- No customer found after lookup → neutral message + search input visible
- Shopify not connected → show "Connect Shopify to see order data" prompt. Condition: the customer lookup API returns HTTP 400 with `{ error: 'Shopify not configured' }` — this is the same error already returned by all existing Shopify API routes when no credentials are set for the account
- API error → inline error with retry button

---

## Feature 3 — Cancel Order Modal

Triggered by the Cancel button on an expanded order row.

**Form fields:**

| Field | Type | Default |
|-------|------|---------|
| Reason | Dropdown (customer / fraud / inventory / declined / other) | customer |
| Restock items | Toggle | On |
| Notify customer | Toggle | On |
| Refund payment | Checkbox | Off |

On submit → `POST /api/shopify/orders/[id]/cancel` with `{ reason, restock, notify, refund }`.

On success: update the order row status badge to "Cancelled" in local state without refetching. Show inline success confirmation. Close modal.

On error: show error message inside modal. Keep modal open for retry.

---

## Feature 4 — Refund Modal

Triggered by the Refund button on an expanded order row.

**Form fields:**

| Field | Type | Notes |
|-------|------|-------|
| Mode toggle | Line items / Custom amount | Switches between two sub-forms |
| Line items | Checklist with qty selectors | Pre-checked all; shown in line-item mode |
| Include shipping refund | Checkbox | Shown in line-item mode |
| Custom amount | Number input (€) | Shown in custom amount mode |
| Refund reason | Dropdown | See taxonomy below |
| Notify customer | Toggle | Default: on |

**Refund reason taxonomy** (matches analytics spec):

| Value | Label |
|-------|-------|
| `customer` | Customer changed mind |
| `fraud` | Fraudulent order |
| `inventory` | Item out of stock |
| `declined` | Payment declined |
| `quality` | Product quality issue |
| `shipping` | Shipping problem |
| `wrong_item` | Wrong item received |
| `other` | Other |

On submit → `POST /api/shopify/orders/[id]/refund` with the following payload:

```js
// Line-item mode
{
  lineItems: [{ lineItemId: item.id, quantity: item.selectedQty }],
  shipping: includeShipping,   // boolean
  restock: false,
  notify: notifyCustomer,      // boolean
  reason: selectedReason       // string from taxonomy
}

// Custom amount mode
{
  customAmount: '12.50',       // string, decimal
  notify: notifyCustomer,
  reason: selectedReason
}
```

On success:
1. Update order row financial status badge in local state
2. Emit analytics event (fire-and-forget, never blocks the UI response):
```js
import { track, EVENT_TYPES } from '../../../../lib/analytics/track'
// EVENT_TYPES is exported from lib/analytics/events.js and re-exported from track.js

track(EVENT_TYPES.TICKET_RESOLVED, {
  ticket_id: activeThread.id,   // the active conversation/thread ID in the inbox
  source: activeThread.source,  // 'gmail' | 'outlook' | 'custom' | 'gorgias' — stored on thread object
  agent_id: currentAgent.id,    // agents.id of the logged-in agent (from session context)
  client_id: currentUser.id,    // Supabase user ID of the client account
  store_id: currentUser.id,     // = client_id until multi-store is implemented
  timestamp: new Date().toISOString(),
  metadata: JSON.stringify({ refund_reason: selectedReason })
})
```
3. Show success confirmation. Close modal.

On error: show error message inside modal. Keep modal open for retry.

---

## Feature 5 — Duplicate Order Modal

Triggered by the Duplicate button on an expanded order row. Creates a Shopify draft order pre-filled from the original.

**Form fields:**

| Field | Type | Notes |
|-------|------|-------|
| Line items | Read-only list | Pre-filled from original; not editable in this modal |
| Discount type | Dropdown (None / Percentage / Fixed amount) | Default: None |
| Discount value | Number input | Shown only when type ≠ None |
| Keep shipping address | Toggle | Default: on |
| Note | Text input | Pre-filled: "Duplicate of #XXXX" |

On submit → `POST /api/shopify/orders/[id]/duplicate` with form values.

On success: show confirmation with a clickable link to the Shopify draft order invoice URL (`draftOrder.invoiceUrl` from API response), so the agent can send it to the customer or complete the order in Shopify admin. Close modal.

On error: show error message inside modal. Keep modal open for retry.

---

## Feature 6 — Refund % Per Customer

Computed client-side from the loaded orders list. Not fetched separately.

```js
const ordersWithRefund = orders.filter(o => o.refunds && o.refunds.length > 0)
const refundPct = orders.length > 0
  ? Math.round((ordersWithRefund.length / orders.length) * 100)
  : 0
```

**Display in customer header:**
- ≤ 10%: no badge (or subtle neutral indicator)
- 11–30%: yellow badge ("Refund rate: 23%")
- > 30%: red badge ("Refund rate: 42%") — flags high-risk customer to agent

---

## Implementation Plan & Estimates

Estimates assume a human developer with minimal AI assistance. All backend APIs exist; this is UI + integration work.

| Task | Hours |
|------|-------|
| Verify/extend `/api/shopify/customer` route — email lookup + order search by order number | 3h |
| Customer context state in inbox — auto-lookup on conversation open, cached per conversation | 4h |
| Manual search UI + fallback flow (email or order number input) | 3h |
| Customer header component (name, stats, refund rate badge with color thresholds) | 3h |
| Order list + expanded order detail (accordion, status badges, action buttons, disabled states) | 6h |
| Cancel modal — form, API wiring, local state update, success/error handling | 4h |
| Refund modal — mode toggle, line items checklist, reason dropdown, API wiring, analytics event emit | 6h |
| Duplicate modal — pre-filled read-only items, discount fields, API wiring, invoice link on success | 4h |
| Refund % computation + badge display with color thresholds | 2h |
| Empty / loading / error states across all panel components | 3h |
| **Total** | **38h** |

---

## Constraints

- No new backend API routes required beyond verifying `/api/shopify/customer`
- Refund reason selection is mandatory in the refund modal — agent cannot submit without choosing a reason (required for analytics integrity)
- Analytics event on refund is fire-and-forget — a Tinybird failure never blocks the refund action
- Refund % is a display metric only — it is computed locally, not stored in Supabase
- The Duplicate modal does not support editing line items (add/remove products) — that is a Shopify admin concern; agents get the invoice URL to complete the order there
