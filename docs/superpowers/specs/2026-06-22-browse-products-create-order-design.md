# Browse Products in Create Order Modal — Design

**Date:** 2026-06-22
**Status:** Approved (design)

## Problem

In the Create Order modal, the "Add products" field only shows results after the
user types 2+ characters. There is no way to browse the catalog without already
knowing a product name. Users want to open the field and immediately see a list
of products to choose from, scrolling through the full catalog.

## Goal

Let users browse a paginated, infinitely-scrolling product list in the Create
Order modal **without typing a search term**. Typing a term narrows the same
list, which is also infinitely scrollable.

## Decisions (from brainstorming)

- **When the list appears:** on focusing the "Add products" field (not on modal
  open, not only after typing).
- **Pagination:** infinite scroll.
- **Scope:** infinite scroll applies to **both** the browse list (empty query)
  and typed search results.
- **Fetch mechanism:** Shopify **GraphQL Admin API** with cursor pagination
  (switch away from REST for this path).

## Approach

### Why GraphQL (chosen)

Shopify's REST `/products.json` cannot combine its `page_info` cursor with the
`title` filter, so a REST approach could not paginate *search* results — only
browse. The GraphQL Admin API's `products(first, after, query)` connection
supports cursor pagination for both the empty-query (browse) and
`title:*term*` (search) cases, and returns `pageInfo { hasNextPage, endCursor }`.
GraphQL is already used in `shopify.ts` (e.g. the ShopifyQL analytics query and
`resilientFetch` helper), so this follows an established pattern.

### Rejected alternative

- **REST `page_info`:** simpler, but cannot paginate title-filtered search.
  Fails the "infinite scroll for both browse and search" requirement.

## Components

There are **two** copies of the Shopify service that mirror each other and must
be kept in sync (per CLAUDE.md):

- `lib/services/shopify.ts` (Next.js runtime)
- `supabase/functions/api/lib/services/shopify.ts` (Deno/Hono runtime — this is
  the one the modal actually hits via `apiUrl`)

### 1. Service layer — `searchProducts` (both copies)

Replace the REST implementation with a GraphQL-backed one.

- **Signature:** `searchProducts(credentials, query, limit, cursor?)` returning
  `{ products: ProductSearchResult[]; nextCursor: string | null; hasNextPage: boolean }`.
- **GraphQL:** `products(first: $limit, after: $cursor, query: $q)` where `$q` is
  `""` for browse or `title:*<term>*` for search.
- **Mapping:** map GraphQL `product`/`variant` nodes into the **existing**
  `ProductSearchResult` / `ProductSearchVariant` shapes so the modal's cart code
  is untouched:
  - `productId` = product GID (or numeric legacy id), `productTitle`, `image`
    from `featuredImage.url`.
  - variant: `variantId`, `title`, `price`, `sku`, `available` from
    `availableForSale`.
- `limit` stays clamped (1..50, default 20).

### 2. API route — `GET /shopify/products` (Hono)

`supabase/functions/api/routes/shopify.ts`

- Make `q` **optional** — remove `if (!q) return c.json({ error: 'q is required' }, 400)`.
  Absent/empty `q` means browse all.
- Accept a new optional `cursor` query param; pass it to `searchProducts`.
- Response: `{ products, nextCursor, hasNextPage }`.
- Keep `store_id` required and the existing 60-requests/60s rate limit unchanged.

### 3. Hook — `use-shopify-products.ts`

- Switch `useProductSearch` from `useQuery` to `useInfiniteQuery`.
- Remove the `trimmed.length >= 2` gate: `enabled` whenever `token` and
  `activeStoreId` exist (empty query browses). Keep the 250ms debounce on the
  raw query.
- `queryKey` includes the trimmed query + storeId.
- `queryFn` sends `q` (may be empty), `store_id`, and `cursor` (from
  `pageParam`).
- `getNextPageParam: (last) => last.hasNextPage ? last.nextCursor : undefined`.
- Return type exposes `data.pages`, `fetchNextPage`, `hasNextPage`,
  `isFetchingNextPage`.

### 4. UI — `create-order-modal.tsx`

- Show the dropdown on field **focus**, not only when
  `searchInput.trim().length >= 2`. Track a `isProductFieldFocused` state (or
  open-on-focus / close-on-blur-with-delay) to drive `showSearchDropdown`.
- Flatten `data.pages.flatMap(p => p.products)` into the rendered list.
- Add an IntersectionObserver sentinel element at the bottom of the dropdown
  list; when it intersects and `hasNextPage` and not already fetching, call
  `fetchNextPage()`.
- Show a small "Loading…" row while `isFetchingNextPage`.
- Keep existing "No products found" empty state (now also covers an empty
  catalog on browse).

## Data Flow

1. User focuses "Add products" → hook fires with empty `q`, no cursor.
2. Hono `GET /shopify/products?store_id=…` → service → GraphQL
   `products(first: 20)` → first page → dropdown renders.
3. User scrolls to bottom → sentinel intersects → `fetchNextPage()` with
   `cursor = nextCursor` → next page appended.
4. User types → debounced `q` set → query key changes → resets to page 1 with
   `query: title:*term*` → same scroll-to-load behavior.

## Error Handling

- Existing `shopifyErrorResponse` path on the route is preserved (rate limit,
  store-not-connected 422, Shopify errors).
- Hook surfaces fetch failures as today; a failed `fetchNextPage` leaves
  already-loaded pages intact.

## Testing

- **Service:** browse (empty query) returns products + a cursor; passing the
  cursor returns the next page; `hasNextPage` is false on the last page; search
  (`title` term) returns filtered products and paginates.
- **Route:** `q` omitted returns 200 with products (no longer 400); `cursor`
  passes through; `store_id` still required.
- **Hook/UI (manual):** focusing the field shows products with no typing;
  scrolling loads more; typing filters and still scrolls; selecting a variant
  adds it to the cart exactly as before.

## Out of Scope (YAGNI)

- Inventory / collection / vendor filters.
- Sort controls.
- Caching changes beyond `useInfiniteQuery` defaults.
- Any change to the cart, draft-order creation, or checkout flow.

## Skills to invoke at implementation time

- `shopify-rules` — before editing `lib/services/shopify.ts` and the Deno copy.
- `hono-api-rules` — before editing the `GET /shopify/products` route.
- `ui-rules` — before editing the hook and the modal component.
