import { assertEquals, assertRejects } from '@std/assert'
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
    assertEquals(cap.url, 'https://test-shop.myshopify.com/admin/api/2025-04/graphql.json')
    assertEquals(cap.body?.variables.query, null)
    assertEquals(cap.body?.variables.first, 20)
    assertEquals(cap.body?.variables.after, null)
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

Deno.test('searchProducts: throws when GraphQL returns errors with HTTP 200', async () => {
  const errorPayload = { errors: [{ message: 'Throttled' }] }
  const cap: Capture = {}
  const restore = withMockGraphql(cap, errorPayload)
  try {
    await assertRejects(() => searchProducts(CREDS, '', 20), Error, 'Throttled')
  } finally {
    restore()
  }
})
