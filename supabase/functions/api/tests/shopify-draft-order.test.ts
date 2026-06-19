import { assertEquals, assertRejects } from '@std/assert'
import { createDraftOrder } from '../lib/services/shopify.ts'

const CREDS = { domain: 'test-shop.myshopify.com', accessToken: 'token' } as unknown as Parameters<
  typeof createDraftOrder
>[0]

function withMockFetch(capture: { body?: unknown }): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capture.body = init?.body ? JSON.parse(init.body as string) : undefined
    return new Response(
      JSON.stringify({ draft_order: { id: 1, name: '#D1', invoice_url: 'x' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return () => {
    globalThis.fetch = orig
  }
}

Deno.test('createDraftOrder: uses customer id when provided', async () => {
  const cap: { body?: unknown } = {}
  const restore = withMockFetch(cap)
  try {
    await createDraftOrder(CREDS, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })
    const draft = (cap.body as { draft_order: Record<string, unknown> }).draft_order
    assertEquals(draft.customer, { id: 42 })
    assertEquals('email' in draft, false)
  } finally {
    restore()
  }
})

Deno.test('createDraftOrder: uses email when no customer id', async () => {
  const cap: { body?: unknown } = {}
  const restore = withMockFetch(cap)
  try {
    await createDraftOrder(CREDS, {
      email: 'buyer@example.com',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })
    const draft = (cap.body as { draft_order: Record<string, unknown> }).draft_order
    assertEquals(draft.email, 'buyer@example.com')
    assertEquals('customer' in draft, false)
  } finally {
    restore()
  }
})

Deno.test('createDraftOrder: throws when neither customer id nor email', async () => {
  await assertRejects(
    () =>
      createDraftOrder(CREDS, {
        lineItems: [{ variantId: '100', quantity: 1 }],
      }),
    Error,
    'customer id or email',
  )
})
