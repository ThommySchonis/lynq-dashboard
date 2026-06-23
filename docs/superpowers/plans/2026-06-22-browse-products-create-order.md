# Browse Products in Create Order Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users browse the Shopify catalog in the Create Order modal without typing, with infinite scroll, for both the empty-query browse list and typed search.

**Architecture:** Replace the REST `/products.json?title=` product fetch with Shopify's GraphQL `products(first, after, query)` connection, which supports cursor pagination for both browse (empty query) and search (`title:*term*`). The Hono `GET /shopify/products` route makes `q` optional and passes a `cursor` through. The hook becomes a `useInfiniteQuery`; the modal opens the dropdown on field focus and fetches the next page via an IntersectionObserver sentinel.

**Tech Stack:** Next.js 16 (app router) / React 19, TanStack React Query (`useInfiniteQuery`), Hono on Deno (Supabase Edge Functions), Shopify GraphQL Admin API `2025-04`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-22-browse-products-create-order-design.md`.
- **No `any`** — ESLint-enforced. Use specific interfaces or `unknown`.
- **`@/` path alias** for all Next.js imports; no `../../../`.
- **Two service copies stay in sync:** `lib/services/shopify.ts` (Next.js) AND `supabase/functions/api/lib/services/shopify.ts` (Deno — the copy the modal actually hits via `apiUrl`). Every service change is applied identically to both.
- **Preserve the `ProductSearchResult` / `ProductSearchVariant` shapes** so the modal's cart code is untouched.
- **CRITICAL — IDs must be numeric legacy IDs, not GIDs.** GraphQL returns IDs like `gid://shopify/ProductVariant/456`. `createDraftOrder` does `Number(li.variantId)`, so `variantId` MUST be the trailing numeric portion (`456`). Extract it with `id.split('/').pop()`. The same applies to `productId`. Getting this wrong silently breaks draft-order creation.
- **No git commit steps** — per `CLAUDE.local.md`, committing is user-initiated and excluded from plans. Each task ends with lint/test/typecheck verification instead.
- **Run `npm run lint`** (from `lynq-dashboard/`) after frontend/Next.js changes; resolve all errors.
- **Invoke the matching skill before editing:** `shopify-rules` (service), `hono-api-rules` (route), `ui-rules` (hook + modal).

---

## File Structure

- `supabase/functions/api/lib/services/shopify.ts` — Deno `searchProducts` → GraphQL + pagination (Task 1).
- `supabase/functions/api/tests/shopify-products.test.ts` — new Deno test for the service (Task 1).
- `lib/services/shopify.ts` — Next.js `searchProducts` mirror (Task 2).
- `supabase/functions/api/routes/shopify.ts` — `GET /shopify/products` route: `q` optional + `cursor` (Task 3).
- `hooks/inbox/use-shopify-products.ts` — `useInfiniteQuery` (Task 4).
- `components/shared/modals/create-order-modal.tsx` — open-on-focus + infinite scroll (Task 5).

---

## Task 1: Deno service — GraphQL-backed `searchProducts` with pagination

**Files:**
- Modify: `supabase/functions/api/lib/services/shopify.ts:1061-1092` (the existing `searchProducts`)
- Test: `supabase/functions/api/tests/shopify-products.test.ts` (create)

**Interfaces:**
- Consumes: `resilientFetch` (already imported in this file), `SHOPIFY_API_VERSION` (const `'2025-04'`), `ShopifyCredentials`, existing `ProductSearchResult` / `ProductSearchVariant` interfaces.
- Produces: `searchProducts(credentials: ShopifyCredentials, query: string, limit = 20, cursor?: string | null): Promise<{ products: ProductSearchResult[]; nextCursor: string | null; hasNextPage: boolean }>`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/api/tests/shopify-products.test.ts`:

```ts
import { assertEquals } from '@std/assert'
import { searchProducts } from '../lib/services/shopify.ts'

const CREDS = {
  domain: 'test-shop.myshopify.com',
  accessToken: 'token',
} as unknown as Parameters<typeof searchProducts>[0]

type Capture = { url?: string; body?: { query: string; variables: Record<string, unknown> } }

function withMockGraphql(capture: Capture, payload: unknown): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capture.url = String(input)
    capture.body = init?.body ? JSON.parse(init.body as string) : undefined
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return () => {
    globalThis.fetch = orig
  }
}

const onePagePayload = {
  data: {
    products: {
      edges: [
        {
          cursor: 'CURSOR_A',
          node: {
            id: 'gid://shopify/Product/111',
            title: 'Blue Shirt',
            featuredImage: { url: 'https://img/blue.png' },
            variants: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/ProductVariant/456',
                    title: 'Small',
                    price: '19.99',
                    sku: 'BS-S',
                    availableForSale: true,
                  },
                },
              ],
            },
          },
        },
      ],
      pageInfo: { hasNextPage: true, endCursor: 'CURSOR_A' },
    },
  },
}

Deno.test('searchProducts: browse (empty query) sends no title filter and maps numeric ids', async () => {
  const cap: Capture = {}
  const restore = withMockGraphql(cap, onePagePayload)
  try {
    const result = await searchProducts(CREDS, '', 20)
    // GraphQL endpoint, browse → query variable is null
    assertEquals(cap.url, 'https://test-shop.myshopify.com/admin/api/2025-04/graphql.json')
    assertEquals(cap.body?.variables.query, null)
    assertEquals(cap.body?.variables.first, 20)
    assertEquals(cap.body?.variables.after, null)
    // numeric legacy ids, not GIDs
    assertEquals(result.products[0].productId, '111')
    assertEquals(result.products[0].variants[0].variantId, '456')
    assertEquals(result.products[0].variants[0].available, true)
    assertEquals(result.products[0].image, 'https://img/blue.png')
    assertEquals(result.nextCursor, 'CURSOR_A')
    assertEquals(result.hasNextPage, true)
  } finally {
    restore()
  }
})

Deno.test('searchProducts: search builds a title wildcard query and passes the cursor', async () => {
  const cap: Capture = {}
  const restore = withMockGraphql(cap, onePagePayload)
  try {
    await searchProducts(CREDS, 'shirt', 10, 'CURSOR_PREV')
    assertEquals(cap.body?.variables.query, 'title:*shirt*')
    assertEquals(cap.body?.variables.first, 10)
    assertEquals(cap.body?.variables.after, 'CURSOR_PREV')
  } finally {
    restore()
  }
})

Deno.test('searchProducts: last page reports no next cursor', async () => {
  const lastPage = {
    data: {
      products: {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  }
  const cap: Capture = {}
  const restore = withMockGraphql(cap, lastPage)
  try {
    const result = await searchProducts(CREDS, '', 20)
    assertEquals(result.products, [])
    assertEquals(result.hasNextPage, false)
    assertEquals(result.nextCursor, null)
  } finally {
    restore()
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/api/tests/shopify-products.test.ts --config supabase/functions/api/deno.json --allow-all`
Expected: FAIL — the current `searchProducts` calls REST `/products.json`, so `cap.url` won't be the GraphQL endpoint and `result.nextCursor` is `undefined`.

- [ ] **Step 3: Write the implementation**

In `supabase/functions/api/lib/services/shopify.ts`, replace the entire existing `searchProducts` function (lines ~1061-1092) with:

```ts
// GraphQL node shapes for the products browse/search connection.
interface GqlProductVariantNode {
  id: string
  title: string | null
  price: string | null
  sku: string | null
  availableForSale: boolean
}
interface GqlProductNode {
  id: string
  title: string
  featuredImage: { url: string } | null
  variants: { edges: Array<{ node: GqlProductVariantNode }> }
}
interface GqlProductsResponse {
  data?: {
    products: {
      edges: Array<{ cursor: string; node: GqlProductNode }>
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

const PRODUCTS_QUERY = `
  query browseProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      edges {
        cursor
        node {
          id
          title
          featuredImage { url }
          variants(first: 100) {
            edges {
              node { id title price sku availableForSale }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

// gid://shopify/ProductVariant/456 -> "456". Draft-order creation needs the
// numeric legacy id (createDraftOrder does Number(variantId)).
function legacyId(gid: string): string {
  return gid.split('/').pop() ?? gid
}

/**
 * Browse or search Shopify products via the GraphQL Admin API with cursor
 * pagination. Empty `query` browses the whole catalog; a non-empty `query`
 * filters by title. Returns one page plus the cursor for the next page.
 */
export async function searchProducts(
  credentials: ShopifyCredentials,
  query: string,
  limit = 20,
  cursor?: string | null,
): Promise<{ products: ProductSearchResult[]; nextCursor: string | null; hasNextPage: boolean }> {
  const trimmed = query.trim()
  const variables = {
    first: Math.min(Math.max(limit, 1), 50),
    after: cursor ?? null,
    query: trimmed ? `title:*${trimmed}*` : null,
  }

  const res = await resilientFetch<GqlProductsResponse>(
    'shopify',
    `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': credentials.accessToken,
      },
      body: JSON.stringify({ query: PRODUCTS_QUERY, variables }),
    },
  )

  if (!res.ok) {
    throw new ShopifyApiError(res.error, res.status, 'graphql.json:products')
  }

  const conn = res.data.data?.products
  const products: ProductSearchResult[] = (conn?.edges ?? []).map(({ node }) => ({
    productId: legacyId(node.id),
    productTitle: node.title,
    image: node.featuredImage?.url,
    variants: node.variants.edges.map(({ node: v }) => ({
      variantId: legacyId(v.id),
      title: v.title || 'Default',
      price: v.price ?? '0',
      sku: v.sku || undefined,
      available: v.availableForSale,
    })),
  }))

  return {
    products,
    nextCursor: conn?.pageInfo.endCursor ?? null,
    hasNextPage: conn?.pageInfo.hasNextPage ?? false,
  }
}
```

Note: if a `ShopifyProductsResponse` REST interface in this file is now unused, remove it to satisfy the linter. Confirm with `grep -n "ShopifyProductsResponse" supabase/functions/api/lib/services/shopify.ts` and delete the now-dead interface if it has no remaining references.

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/api/tests/shopify-products.test.ts --config supabase/functions/api/deno.json --allow-all`
Expected: PASS — all three tests green.

- [ ] **Step 5: Typecheck the service**

Run: `deno check --config supabase/functions/api/deno.json supabase/functions/api/lib/services/shopify.ts`
Expected: no errors.

---

## Task 2: Next.js service — mirror `searchProducts`

**Files:**
- Modify: `lib/services/shopify.ts:1092-1123` (the existing `searchProducts`)

**Interfaces:**
- Consumes: the `resilientFetch` helper already imported in this file (used by `getAnalytics`), `SHOPIFY_API_VERSION` (`'2025-04'`), `ShopifyCredentials`, `ProductSearchResult` / `ProductSearchVariant`.
- Produces: identical signature and return type to Task 1's `searchProducts`.

- [ ] **Step 1: Apply the identical implementation**

Replace the existing `searchProducts` in `lib/services/shopify.ts` with the **same** GraphQL implementation written in Task 1 Step 3 (the `GqlProductVariantNode` / `GqlProductNode` / `GqlProductsResponse` interfaces, `PRODUCTS_QUERY`, `legacyId`, and the new `searchProducts`).

Adaptations for this copy:
- Imports use the `@/` alias and `.ts`-less specifiers as the rest of this file does — match the existing `resilientFetch` import already present for `getAnalytics`; do not add a new import path.
- If this file throws a different error type than `ShopifyApiError` on non-ok responses elsewhere, match the local convention. If `ShopifyApiError` is not defined here, throw `new Error(res.error)` instead (keep it consistent with neighbouring functions in this file).
- Remove the now-dead REST `ShopifyProductsResponse` interface if it becomes unused (`grep -n "ShopifyProductsResponse" lib/services/shopify.ts`).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run lint`
Expected: no errors. (Next.js typecheck runs in the build; lint covers `no-any` and unused vars.)

- [ ] **Step 3: Confirm both copies match**

Run: `diff <(sed -n '/export async function searchProducts/,/^}/p' lib/services/shopify.ts) <(sed -n '/export async function searchProducts/,/^}/p' supabase/functions/api/lib/services/shopify.ts)`
Expected: only import/error-type differences noted above — no behavioural drift in query, variables, or mapping.

---

## Task 3: Hono route — make `q` optional, pass `cursor`, return pagination

**Files:**
- Modify: `supabase/functions/api/routes/shopify.ts:375-409` (the `GET /products` handler)

**Interfaces:**
- Consumes: Task 1 `searchProducts(credentials, query, limit, cursor)` returning `{ products, nextCursor, hasNextPage }`.
- Produces: `GET /shopify/products?store_id=…[&q=…][&cursor=…][&limit=…]` → `{ products, nextCursor, hasNextPage }`. `q` absent/empty = browse.

- [ ] **Step 1: Edit the handler**

In `supabase/functions/api/routes/shopify.ts`, inside the `shopify.get('/products', …)` handler:

Delete these two lines (the required-`q` guard):

```ts
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'q is required' }, 400)
```

Replace with:

```ts
  const q = c.req.query('q') ?? ''
  const cursor = c.req.query('cursor') ?? null
```

Then change the service call:

```ts
    const result = await searchProducts(credentials, q, limit, cursor)
    return c.json(result)
```

Leave the rate-limit block, `store_id` requirement, `limit` parsing, credentials lookup, and `shopifyErrorResponse` catch unchanged.

- [ ] **Step 2: Typecheck the route**

Run: `deno check --config supabase/functions/api/deno.json supabase/functions/api/routes/shopify.ts`
Expected: no errors.

- [ ] **Step 3: Manual smoke check (documented, run after deploy or against a local edge function)**

With a connected store, `GET /shopify/products?store_id=<id>` (no `q`) returns `200` with a non-empty `products` array and a `nextCursor`/`hasNextPage`. Passing `&cursor=<nextCursor>` returns the following page. Previously this returned `400 q is required`.

---

## Task 4: Hook — `useInfiniteQuery` browse + search

**Files:**
- Modify: `hooks/inbox/use-shopify-products.ts` (whole `useProductSearch`)

**Interfaces:**
- Consumes: Task 3 route response `{ products: ProductSearchResult[]; nextCursor: string | null; hasNextPage: boolean }`.
- Produces: `useProductSearch(rawQuery: string)` returning the `useInfiniteQuery` result. Consumers read `data.pages` (each `{ products, nextCursor, hasNextPage }`), `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, `isFetching`, `isError`.

- [ ] **Step 1: Rewrite the hook**

Replace the body of `hooks/inbox/use-shopify-products.ts` (keep the top imports for `useEffect`, `useState`, `authFetch`, `parseJson`, `useAuthStore`, `useStoreStore`, `apiUrl`, and the `ProductSearchResult` / `ProductSearchVariant` type re-export; swap `useQuery` for `useInfiniteQuery`):

```ts
'use client'

import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { parseJson } from '@/lib/utils/typed-json'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
import { apiUrl } from '@/lib/api-client'
import type {
  ProductSearchResult,
  ProductSearchVariant,
} from '@/lib/services/shopify'

export type { ProductSearchResult, ProductSearchVariant }

interface ProductsPage {
  products: ProductSearchResult[]
  nextCursor: string | null
  hasNextPage: boolean
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/**
 * Browse (empty query) or live-search Shopify products by title, with cursor
 * pagination. Empty query is allowed — it browses the whole catalog.
 */
export function useProductSearch(rawQuery: string) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const debouncedQuery = useDebouncedValue(rawQuery, 250)
  const trimmed = debouncedQuery.trim()
  const enabled = !!token && !!activeStoreId

  return useInfiniteQuery({
    queryKey: ['shopify-products', trimmed, activeStoreId] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ProductsPage> => {
      const params = new URLSearchParams({ store_id: activeStoreId as string })
      if (trimmed) params.set('q', trimmed)
      if (pageParam) params.set('cursor', pageParam)
      const res = await authFetch(
        `${apiUrl('shopify/products')}?${params.toString()}`,
        {},
        token,
      )
      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`)
      }
      return parseJson<ProductsPage>(res)
    },
    getNextPageParam: (last) => (last.hasNextPage ? last.nextCursor : undefined),
    enabled,
    staleTime: 30_000,
  })
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (no `any`, no unused imports).

---

## Task 5: Modal — open dropdown on focus + infinite scroll

**Files:**
- Modify: `components/shared/modals/create-order-modal.tsx:152-156` (hook destructure), `:295-296` (derived list/flag), `:359-414` (dropdown render)

**Interfaces:**
- Consumes: Task 4 `useProductSearch` returning `data.pages`, `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, `isFetching`, `isError`.
- Produces: no exported interface changes — internal UI only.

- [ ] **Step 1: Update the hook destructure**

Replace the `useProductSearch` destructure (around line 152-156):

```tsx
  const {
    data: searchData,
    isFetching: isSearching,
    isError: searchErrored,
  } = useProductSearch(searchInput)
```

with:

```tsx
  const {
    data: searchData,
    isFetching: isSearching,
    isError: searchErrored,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProductSearch(searchInput)
```

- [ ] **Step 2: Add focus state, flatten pages, add a sentinel ref**

Add these near the other `useState`/refs at the top of the component body (the component already imports `useState`; add `useRef`/`useEffect` to the existing React import if not present):

```tsx
  const [productFieldFocused, setProductFieldFocused] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
```

Replace the derived values (around line 295-296):

```tsx
  const searchResults = searchData?.products ?? []
  const showSearchDropdown = searchInput.trim().length >= 2
```

with:

```tsx
  const searchResults = searchData?.pages.flatMap((p) => p.products) ?? []
  const showSearchDropdown = productFieldFocused || searchInput.trim().length > 0
```

Add an IntersectionObserver effect (place with the other hooks/effects in the component body):

```tsx
  useEffect(() => {
    if (!showSearchDropdown) return
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '120px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [showSearchDropdown, hasNextPage, isFetchingNextPage, fetchNextPage, searchResults.length])
```

- [ ] **Step 3: Wire focus on the input + render the sentinel**

On the products `<Input>` (around line 352-357), add focus/blur handlers. Blur is delayed so a click on an "Add" button still registers before the dropdown closes:

```tsx
            <Input
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] pl-9 text-[13.5px] text-foreground outline-none"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setProductFieldFocused(true)}
              onBlur={() => setTimeout(() => setProductFieldFocused(false), 150)}
              placeholder="Search products..."
            />
```

Inside the dropdown container (after the existing `searchResults.flatMap(...)` variant rows, before the closing `</div>` of the `max-h-[280px]` scroll box at line ~413), add the sentinel + next-page spinner:

```tsx
              <div ref={loadMoreRef} />
              {isFetchingNextPage && (
                <div className="px-3 py-2 text-[12px] text-muted-foreground flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  Loading more...
                </div>
              )}
```

Leave the existing "Searching..." (initial load), "Search failed", and "No products found" branches as they are — they already key off `isSearching` / `searchErrored` / `searchResults.length`.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification (documented)**

Open the inbox → a customer/order → **Create order**. Click the "Add products" field **without typing**: a product list appears. Scroll to the bottom of the dropdown: more products load automatically. Type a product name: the list filters and still loads more on scroll. Click **Add** on a variant: it is added to the cart (confirms numeric `variantId` survives), then **Create draft order** succeeds.

---

## Self-Review

**Spec coverage:**
- "List appears on field focus" → Task 5 Step 2 (`showSearchDropdown = productFieldFocused || …`).
- "Infinite scroll" → Task 4 (`useInfiniteQuery`) + Task 5 (IntersectionObserver sentinel).
- "Both browse + search" → Task 1 (`query` null vs `title:*term*`) + Task 4 (empty `q` allowed, same paging).
- "GraphQL cursor pagination" → Task 1.
- "Make `q` optional, accept `cursor`, return `{products,nextCursor,hasNextPage}`" → Task 3.
- "Two service copies in sync" → Task 1 (Deno) + Task 2 (Next.js) + Task 2 Step 3 diff check.
- "Preserve ProductSearchResult shape / cart untouched" → Task 1 mapping; numeric-id constraint covered in Global Constraints + Task 1 `legacyId`.
- "Testing — service browse/search/last-page" → Task 1 Step 1 (three Deno tests).

**Placeholder scan:** No TBD/TODO; all code blocks complete; commands explicit. (Commit steps intentionally omitted per `CLAUDE.local.md`.)

**Type consistency:** `searchProducts(credentials, query, limit, cursor?)` → `{ products, nextCursor, hasNextPage }` is used identically in Task 1, 2 (mirror), 3 (route call), and surfaced as `ProductsPage` in Task 4, consumed as `data.pages` in Task 5. `legacyId` defined and used in Task 1/2 only. `fetchNextPage` / `hasNextPage` / `isFetchingNextPage` named consistently across Tasks 4 and 5.
