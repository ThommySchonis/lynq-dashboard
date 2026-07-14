import { assertEquals, assertObjectMatch, assertRejects } from '@std/assert'
import { createRefund, duplicateOrder, fulfillOrder } from '../lib/services/shopify-order-actions.ts'
import { ShopifyApiError } from '../lib/services/shopify-core.ts'

const CREDS = {
  domain: 'test-shop.myshopify.com',
  accessToken: 'token',
} as unknown as Parameters<typeof createRefund>[0]

type Captured = { body?: { query: string; variables: Record<string, unknown> } }

// createRefund makes TWO GraphQL round-trips (calculate/query, then mutate).
// Queue the payloads and record each request body so we can assert the exact
// variables sent to refundCreate — the money-critical bit.
function withQueuedGraphql(captures: Captured[], payloads: unknown[]): () => void {
  const orig = globalThis.fetch
  let call = 0
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    captures.push({ body: init?.body ? JSON.parse(init.body as string) : undefined })
    const payload = payloads[call] ?? payloads[payloads.length - 1]
    call++
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }
  return () => {
    globalThis.fetch = orig
  }
}

// Divergent presentment (42.00 USD) vs shop (38.00 EUR) legs prove the
// PRESENTMENT amount is what feeds OrderTransactionInput.amount.
const suggestedRefundPayload = {
  data: {
    order: {
      suggestedRefund: {
        suggestedTransactions: [
          {
            parentTransaction: { id: 'gid://shopify/OrderTransaction/55' },
            amountSet: {
              presentmentMoney: { amount: '42.00', currencyCode: 'USD' },
              shopMoney: { amount: '38.00', currencyCode: 'EUR' },
            },
            gateway: 'shopify_payments',
            kind: 'SUGGESTED_REFUND',
          },
        ],
      },
    },
  },
}

const refundCreatePayload = {
  data: {
    refundCreate: {
      refund: {
        id: 'gid://shopify/Refund/999',
        note: 'damaged',
        createdAt: '2026-07-14T00:00:00Z',
        totalRefundedSet: {
          presentmentMoney: { amount: '42.00', currencyCode: 'USD' },
          shopMoney: { amount: '38.00', currencyCode: 'EUR' },
        },
      },
      userErrors: [],
    },
  },
}

Deno.test('createRefund PATH 2: suggestedRefund calc then refundCreate with the presentment transaction amount', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [suggestedRefundPayload, refundCreatePayload])
  try {
    const result = await createRefund(CREDS, 123, {
      lineItems: [{ lineItemId: 111, quantity: 1 }],
      restock: true,
      notify: true,
      reason: 'damaged',
      shipping: false,
    })

    // Call 1: suggestedRefund query variables
    assertEquals(caps[0].body?.variables.orderId, 'gid://shopify/Order/123')
    assertEquals(caps[0].body?.variables.refundLineItems, [
      { lineItemId: 'gid://shopify/LineItem/111', quantity: 1, restockType: 'RETURN' },
    ])
    assertEquals(caps[0].body?.variables.refundShipping, false)

    // Call 2: refundCreate input
    assertEquals(caps[1].body?.variables.input, {
      orderId: 'gid://shopify/Order/123',
      note: 'damaged',
      notify: true, // RefundInput field is `notify`, NOT `notifyCustomer` (that's an orderCancel field)
      currency: 'USD', // RefundInput.currency = the PRESENTMENT currency code, not the shop 38.00 EUR leg
      refundLineItems: [{ lineItemId: 'gid://shopify/LineItem/111', quantity: 1, restockType: 'RETURN' }],
      shipping: { fullRefund: false },
      transactions: [
        {
          orderId: 'gid://shopify/Order/123',
          parentId: 'gid://shopify/OrderTransaction/55',
          amount: '42.00', // PRESENTMENT leg, not the shop 38.00
          gateway: 'shopify_payments',
          kind: 'REFUND',
        },
      ],
    })

    assertObjectMatch(result as Record<string, unknown>, { id: 999, order_id: 123, amount: '42.00', currency: 'USD', note: 'damaged' })
  } finally {
    restore()
  }
})

Deno.test('createRefund PATH 2: restock:false -> NO_RESTOCK, shipping:true -> refundShipping/fullRefund', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [suggestedRefundPayload, refundCreatePayload])
  try {
    await createRefund(CREDS, 123, {
      lineItems: [{ lineItemId: 111, quantity: 2 }],
      restock: false,
      shipping: true,
    })
    assertEquals(caps[0].body?.variables.refundLineItems, [
      { lineItemId: 'gid://shopify/LineItem/111', quantity: 2, restockType: 'NO_RESTOCK' },
    ])
    assertEquals(caps[0].body?.variables.refundShipping, true)
    const input = caps[1].body?.variables.input as Record<string, unknown>
    assertEquals(input.notify, true) // notify undefined -> defaults true
    assertEquals(input.currency, 'USD')
    assertEquals(input.shipping, { fullRefund: true })
  } finally {
    restore()
  }
})

const orderTransactionsPayload = {
  data: {
    order: {
      transactions: [
        {
          id: 'gid://shopify/OrderTransaction/500',
          kind: 'SALE',
          gateway: 'shopify_payments',
          amountSet: {
            presentmentMoney: { amount: '100.00', currencyCode: 'USD' },
            shopMoney: { amount: '90.00', currencyCode: 'EUR' },
          },
        },
      ],
    },
  },
}

const customRefundCreatePayload = {
  data: {
    refundCreate: {
      refund: {
        id: 'gid://shopify/Refund/777',
        note: 'overcharge',
        createdAt: '2026-07-14T00:00:00Z',
        totalRefundedSet: {
          presentmentMoney: { amount: '10.00', currencyCode: 'USD' },
          shopMoney: { amount: '9.00', currencyCode: 'EUR' },
        },
      },
      userErrors: [],
    },
  },
}

Deno.test('createRefund PATH 1: custom amount refunds the exact amount against the capturable transaction', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [orderTransactionsPayload, customRefundCreatePayload])
  try {
    const result = await createRefund(CREDS, 456, { customAmount: 10, reason: 'overcharge', notify: false })

    assertEquals(caps[0].body?.variables.orderId, 'gid://shopify/Order/456')
    assertEquals(caps[1].body?.variables.input, {
      orderId: 'gid://shopify/Order/456',
      note: 'overcharge',
      notify: false, // RefundInput field is `notify`, NOT `notifyCustomer`
      currency: 'USD', // sourced from the parent transaction's presentment currencyCode
      transactions: [
        {
          orderId: 'gid://shopify/Order/456',
          parentId: 'gid://shopify/OrderTransaction/500',
          amount: '10.00',
          gateway: 'shopify_payments',
          kind: 'REFUND',
        },
      ],
    })
    assertObjectMatch(result as Record<string, unknown>, { id: 777, order_id: 456, amount: '10.00', currency: 'USD' })
  } finally {
    restore()
  }
})

Deno.test('createRefund PATH 1: throws when no capturable transaction exists (no blind refund)', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [{ data: { order: { transactions: [] } } }])
  try {
    await assertRejects(
      () => createRefund(CREDS, 456, { customAmount: 10, reason: 'overcharge' }),
      ShopifyApiError,
      'no capturable',
    )
    assertEquals(caps.length, 1) // refundCreate NOT attempted
  } finally {
    restore()
  }
})

Deno.test('createRefund: throws ShopifyApiError when refundCreate returns userErrors', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [
    suggestedRefundPayload,
    { data: { refundCreate: { refund: null, userErrors: [{ field: ['orderId'], message: 'Order cannot be refunded' }] } } },
  ])
  try {
    await assertRejects(
      () => createRefund(CREDS, 123, { lineItems: [{ lineItemId: 111, quantity: 1 }] }),
      ShopifyApiError,
      'Order cannot be refunded',
    )
  } finally {
    restore()
  }
})

// ── fulfillOrder (fulfillmentCreate) ──────────────────────────────────────────
// Replaces the 2-call REST flow (GET /orders/{id}/fulfillment_orders.json,
// POST /fulfillments.json) with (1) order.fulfillmentOrders query, (2)
// fulfillmentCreate mutation. FulfillmentOrderStatus/FulfillmentStatus are
// UPPERCASE in GraphQL — a CLOSED node proves the OPEN/IN_PROGRESS filter,
// and the returned status is lowercased to preserve REST's lowercase strings.
const fulfillmentOrdersPayload = {
  data: {
    order: {
      fulfillmentOrders: {
        edges: [
          { node: { id: 'gid://shopify/FulfillmentOrder/10', status: 'OPEN' } },
          { node: { id: 'gid://shopify/FulfillmentOrder/11', status: 'IN_PROGRESS' } },
          { node: { id: 'gid://shopify/FulfillmentOrder/12', status: 'CLOSED' } },
        ],
      },
    },
  },
}

const fulfillmentCreatePayload = {
  data: {
    fulfillmentCreate: {
      fulfillment: { id: 'gid://shopify/Fulfillment/555', status: 'SUCCESS' },
      userErrors: [],
    },
  },
}

Deno.test('fulfillOrder: fulfills only OPEN/IN_PROGRESS orders, sends trackingInfo, maps to numeric id + lowercase status', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [fulfillmentOrdersPayload, fulfillmentCreatePayload])
  try {
    const result = await fulfillOrder(CREDS, 123, {
      trackingNumber: '1Z999',
      trackingCompany: 'UPS',
      trackingUrl: 'https://track.example/1Z999',
      notify: true,
    })

    assertEquals(caps[0].body?.variables.orderId, 'gid://shopify/Order/123')
    assertEquals(caps[1].body?.variables.fulfillment, {
      lineItemsByFulfillmentOrder: [
        { fulfillmentOrderId: 'gid://shopify/FulfillmentOrder/10' },
        { fulfillmentOrderId: 'gid://shopify/FulfillmentOrder/11' },
      ],
      notifyCustomer: true,
      trackingInfo: {
        number: '1Z999',
        company: 'UPS',
        url: 'https://track.example/1Z999',
      },
    })
    assertObjectMatch(result as Record<string, unknown>, { id: 555, status: 'success' })
  } finally {
    restore()
  }
})

Deno.test('fulfillOrder: omits trackingInfo when no tracking number is given, notify defaults true', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [fulfillmentOrdersPayload, fulfillmentCreatePayload])
  try {
    await fulfillOrder(CREDS, 123, {})
    const fulfillment = caps[1].body?.variables.fulfillment as Record<string, unknown>
    assertEquals('trackingInfo' in fulfillment, false)
    assertEquals(fulfillment.notifyCustomer, true)
  } finally {
    restore()
  }
})

Deno.test('fulfillOrder: maps notify:false to notifyCustomer:false', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [fulfillmentOrdersPayload, fulfillmentCreatePayload])
  try {
    await fulfillOrder(CREDS, 123, { notify: false })
    const fulfillment = caps[1].body?.variables.fulfillment as Record<string, unknown>
    assertEquals(fulfillment.notifyCustomer, false)
  } finally {
    restore()
  }
})

Deno.test('fulfillOrder: throws "No open fulfillment found" when none is OPEN/IN_PROGRESS, without attempting fulfillmentCreate', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [
    { data: { order: { fulfillmentOrders: { edges: [{ node: { id: 'gid://shopify/FulfillmentOrder/12', status: 'CLOSED' } }] } } } },
  ])
  try {
    await assertRejects(() => fulfillOrder(CREDS, 123, {}), Error, 'No open fulfillment found')
    assertEquals(caps.length, 1)
  } finally {
    restore()
  }
})

Deno.test('fulfillOrder: throws ShopifyApiError when fulfillmentCreate returns userErrors', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [
    fulfillmentOrdersPayload,
    { data: { fulfillmentCreate: { fulfillment: null, userErrors: [{ field: ['fulfillment'], message: 'Fulfillment order already closed' }] } } },
  ])
  try {
    await assertRejects(
      () => fulfillOrder(CREDS, 123, {}),
      ShopifyApiError,
      'already closed',
    )
  } finally {
    restore()
  }
})

// ── duplicateOrder (order read + draftOrderCreate) ────────────────────────────
// Replaces the 2-call REST flow (GET /orders/{id}.json, POST
// /draft_orders.json) with an `order` read query + `draftOrderCreate`
// mutation. The line item with variant: null simulates a custom line item
// (no variant) — REST filtered these out via `.filter(item => item.variant_id)`.
const orderReadPayload = {
  data: {
    order: {
      name: '#1001',
      tags: ['vip', 'wholesale'],
      customer: { id: 'gid://shopify/Customer/55' },
      shippingAddress: {
        address1: '123 Main St',
        address2: 'Apt 4',
        city: 'Berlin',
        province: 'Berlin',
        country: 'Germany',
        zip: '10115',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+491234567',
      },
      lineItems: {
        edges: [
          {
            node: {
              quantity: 2,
              variant: { id: 'gid://shopify/ProductVariant/111' },
              // SHOP-currency leg — REST's discount_allocations[0].amount was
              // shop currency, and DraftOrderAppliedDiscountInput's FIXED_AMOUNT
              // value docs also require shop currency, so both point here.
              discountAllocations: [{ allocatedAmountSet: { shopMoney: { amount: '5.00' } } }],
            },
          },
          { node: { quantity: 1, variant: null, discountAllocations: [] } },
        ],
      },
    },
  },
}

const draftOrderCreatePayload = {
  data: {
    draftOrderCreate: {
      draftOrder: { id: 'gid://shopify/DraftOrder/9001', name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' },
      userErrors: [],
    },
  },
}

Deno.test('duplicateOrder: reads the order, builds line items (variantId + quantity), filters the no-variant item, maps the return to numeric id', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [orderReadPayload, draftOrderCreatePayload])
  try {
    const result = await duplicateOrder(CREDS, 123, {})

    assertEquals(caps[0].body?.variables.orderId, 'gid://shopify/Order/123')
    const input = caps[1].body?.variables.input as Record<string, unknown>
    assertEquals(input.lineItems, [{ variantId: 'gid://shopify/ProductVariant/111', quantity: 2 }])
    assertObjectMatch(result as Record<string, unknown>, { id: 9001, name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' })
  } finally {
    restore()
  }
})

Deno.test('duplicateOrder: copies the per-line-item discount (shop-currency leg) onto the line item when applyDiscount is true', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, { applyDiscount: true })
    const input = caps[1].body?.variables.input as Record<string, unknown>
    assertEquals(input.lineItems, [
      {
        variantId: 'gid://shopify/ProductVariant/111',
        quantity: 2,
        appliedDiscount: { value: 5, valueType: 'FIXED_AMOUNT', title: 'Duplicated discount' },
      },
    ])
  } finally {
    restore()
  }
})

Deno.test('duplicateOrder: attaches the customer via purchasingEntity.customerId (customerId is deprecated), omitted when the order has no customer', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, {})
    const input = caps[1].body?.variables.input as Record<string, unknown>
    assertEquals(input.purchasingEntity, { customerId: 'gid://shopify/Customer/55' })
    assertEquals('customerId' in input, false)
  } finally {
    restore()
  }

  const caps2: Captured[] = []
  const noCustomerPayload = { data: { order: { ...orderReadPayload.data.order, customer: null } } }
  const restore2 = withQueuedGraphql(caps2, [noCustomerPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, {})
    const input2 = caps2[1].body?.variables.input as Record<string, unknown>
    assertEquals('purchasingEntity' in input2, false)
  } finally {
    restore2()
  }
})

Deno.test('duplicateOrder: note falls back to "Duplicate of {order.name}", tags splits a comma string or falls back to order.tags', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, {})
    const input = caps[1].body?.variables.input as Record<string, unknown>
    assertEquals(input.note, 'Duplicate of #1001')
    assertEquals(input.tags, ['vip', 'wholesale'])
  } finally {
    restore()
  }

  const caps2: Captured[] = []
  const restore2 = withQueuedGraphql(caps2, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, { note: 'Custom note', tags: 'a, b ,c' })
    const input2 = caps2[1].body?.variables.input as Record<string, unknown>
    assertEquals(input2.note, 'Custom note')
    assertEquals(input2.tags, ['a', 'b', 'c'])
  } finally {
    restore2()
  }
})

Deno.test('duplicateOrder: applies the order-level appliedDiscount (percentage -> PERCENTAGE, fixed -> FIXED_AMOUNT as a Float), omitted when discountValue is 0', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, { discountType: 'percentage', discountValue: 10 })
    const input = caps[1].body?.variables.input as Record<string, unknown>
    assertEquals(input.appliedDiscount, { description: 'Discount', valueType: 'PERCENTAGE', value: 10, title: '10% discount' })
  } finally {
    restore()
  }

  const caps2: Captured[] = []
  const restore2 = withQueuedGraphql(caps2, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, { discountType: 'fixed', discountValue: 10 })
    const input2 = caps2[1].body?.variables.input as Record<string, unknown>
    assertEquals(input2.appliedDiscount, { description: 'Discount', valueType: 'FIXED_AMOUNT', value: 10, title: '€10 discount' })
  } finally {
    restore2()
  }

  const caps3: Captured[] = []
  const restore3 = withQueuedGraphql(caps3, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, { discountType: 'fixed', discountValue: 0 })
    const input3 = caps3[1].body?.variables.input as Record<string, unknown>
    assertEquals('appliedDiscount' in input3, false)
  } finally {
    restore3()
  }
})

Deno.test('duplicateOrder: includes shippingAddress when keepAddress is not false, omitted when false or the order has none', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, {})
    const input = caps[1].body?.variables.input as Record<string, unknown>
    assertEquals(input.shippingAddress, {
      address1: '123 Main St',
      address2: 'Apt 4',
      city: 'Berlin',
      province: 'Berlin',
      country: 'Germany',
      zip: '10115',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+491234567',
    })
  } finally {
    restore()
  }

  const caps2: Captured[] = []
  const restore2 = withQueuedGraphql(caps2, [orderReadPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, { keepAddress: false })
    const input2 = caps2[1].body?.variables.input as Record<string, unknown>
    assertEquals('shippingAddress' in input2, false)
  } finally {
    restore2()
  }

  const caps3: Captured[] = []
  const noAddressPayload = { data: { order: { ...orderReadPayload.data.order, shippingAddress: null } } }
  const restore3 = withQueuedGraphql(caps3, [noAddressPayload, draftOrderCreatePayload])
  try {
    await duplicateOrder(CREDS, 123, {})
    const input3 = caps3[1].body?.variables.input as Record<string, unknown>
    assertEquals('shippingAddress' in input3, false)
  } finally {
    restore3()
  }
})

Deno.test('duplicateOrder: throws ShopifyApiError when draftOrderCreate returns userErrors', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [
    orderReadPayload,
    { data: { draftOrderCreate: { draftOrder: null, userErrors: [{ field: ['lineItems'], message: 'Variant is no longer available' }] } } },
  ])
  try {
    await assertRejects(
      () => duplicateOrder(CREDS, 123, {}),
      ShopifyApiError,
      'no longer available',
    )
  } finally {
    restore()
  }
})

Deno.test('duplicateOrder: throws when the order read returns null (bad orderId), without attempting draftOrderCreate', async () => {
  const caps: Captured[] = []
  const restore = withQueuedGraphql(caps, [{ data: { order: null } }])
  try {
    await assertRejects(() => duplicateOrder(CREDS, 999, {}), ShopifyApiError)
    assertEquals(caps.length, 1)
  } finally {
    restore()
  }
})
