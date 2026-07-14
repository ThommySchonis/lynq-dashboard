import { assertEquals, assertRejects } from '@std/assert'
import { createDraftOrder } from '../lib/services/shopify.ts'
import { ShopifyApiError } from '../lib/services/shopify-core.ts'

const CREDS = { domain: 'test-shop.myshopify.com', accessToken: 'token' } as unknown as Parameters<
  typeof createDraftOrder
>[0]

type Captured = { body?: { query: string; variables: Record<string, unknown> } }

// createDraftOrder now uses the draftOrderCreate GraphQL mutation via the
// shared shopifyGraphQL helper. Mock the underlying fetch and assert the
// exact DraftOrderInput variables sent.
function withMockGraphql(capture: Captured, payload: unknown): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = (_input: RequestInfo | URL, init?: RequestInit) => {
    capture.body = init?.body ? JSON.parse(init.body as string) : undefined
    return Promise.resolve(
      new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
  }
  return () => {
    globalThis.fetch = orig
  }
}

const draftOrderCreatePayload = {
  data: {
    draftOrderCreate: {
      draftOrder: { id: 'gid://shopify/DraftOrder/1', name: '#D1', invoiceUrl: 'x' },
      userErrors: [],
    },
  },
}

Deno.test('createDraftOrder: uses purchasingEntity.customerId when a customer id is provided (DraftOrderInput.customerId is deprecated)', async () => {
  const cap: Captured = {}
  const restore = withMockGraphql(cap, draftOrderCreatePayload)
  try {
    await createDraftOrder(CREDS, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })
    const input = cap.body?.variables.input as Record<string, unknown>
    assertEquals(input.purchasingEntity, { customerId: 'gid://shopify/Customer/42' })
    assertEquals('email' in input, false)
  } finally {
    restore()
  }
})

Deno.test('createDraftOrder: uses email when no customer id', async () => {
  const cap: Captured = {}
  const restore = withMockGraphql(cap, draftOrderCreatePayload)
  try {
    await createDraftOrder(CREDS, {
      email: 'buyer@example.com',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })
    const input = cap.body?.variables.input as Record<string, unknown>
    assertEquals(input.email, 'buyer@example.com')
    assertEquals('purchasingEntity' in input, false)
  } finally {
    restore()
  }
})

Deno.test('createDraftOrder: throws when neither customer id nor email, without calling GraphQL', async () => {
  const cap: Captured = {}
  const restore = withMockGraphql(cap, draftOrderCreatePayload)
  try {
    await assertRejects(
      () =>
        createDraftOrder(CREDS, {
          lineItems: [{ variantId: '100', quantity: 1 }],
        }),
      Error,
      'customer id or email',
    )
    assertEquals(cap.body, undefined)
  } finally {
    restore()
  }
})

Deno.test('createDraftOrder: builds DraftOrderLineItemInput (variantId gid + quantity) from the numeric legacy variant id', async () => {
  const cap: Captured = {}
  const restore = withMockGraphql(cap, draftOrderCreatePayload)
  try {
    await createDraftOrder(CREDS, {
      customerId: '42',
      lineItems: [
        { variantId: '100', quantity: 2 },
        { variantId: '200', quantity: 1 },
      ],
    })
    const input = cap.body?.variables.input as Record<string, unknown>
    assertEquals(input.lineItems, [
      { variantId: 'gid://shopify/ProductVariant/100', quantity: 2 },
      { variantId: 'gid://shopify/ProductVariant/200', quantity: 1 },
    ])
  } finally {
    restore()
  }
})

Deno.test('createDraftOrder: maps the created draft order gid -> numeric id, same as the old REST draft_order.id', async () => {
  const cap: Captured = {}
  const restore = withMockGraphql(cap, draftOrderCreatePayload)
  try {
    const result = await createDraftOrder(CREDS, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })
    assertEquals(result, { id: 1, name: '#D1', invoiceUrl: 'x' })
  } finally {
    restore()
  }
})

Deno.test('createDraftOrder: maps discount.type fixed/percentage to DraftOrderAppliedDiscountType, value as a Float', async () => {
  const cap: Captured = {}
  const restore = withMockGraphql(cap, draftOrderCreatePayload)
  try {
    await createDraftOrder(CREDS, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
      discount: { type: 'percentage', value: 10 },
    })
    const input = cap.body?.variables.input as Record<string, unknown>
    assertEquals(input.appliedDiscount, {
      description: 'Discount',
      valueType: 'PERCENTAGE',
      value: 10,
      title: '10% discount',
    })
  } finally {
    restore()
  }
})

Deno.test('createDraftOrder: throws ShopifyApiError when draftOrderCreate returns userErrors', async () => {
  const cap: Captured = {}
  const restore = withMockGraphql(cap, {
    data: {
      draftOrderCreate: {
        draftOrder: null,
        userErrors: [{ field: ['lineItems'], message: 'Variant is no longer available' }],
      },
    },
  })
  try {
    await assertRejects(
      () => createDraftOrder(CREDS, { customerId: '42', lineItems: [{ variantId: '100', quantity: 1 }] }),
      ShopifyApiError,
      'no longer available',
    )
  } finally {
    restore()
  }
})
