import { describe, it, expect, vi, beforeEach } from 'vitest'

// updateOrderNote / updateOrderAddress now use the GraphQL orderUpdate mutation via
// the shared shopifyGraphQL helper — mock it so we can assert the exact mutation
// variables and exercise the userErrors -> throw path without a real network call.
const graphql = vi.fn()
vi.mock('@/lib/services/shopify-graphql', () => ({
  shopifyGraphQL: (...args: unknown[]): unknown => graphql(...args),
  SHOPIFY_GRAPHQL_VERSION: '2025-04',
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { updateOrderNote, updateOrderAddress, cancelOrder, createRefund, fulfillOrder, editOrder, duplicateOrder } from '@/lib/services/shopify-order-actions'
import { ShopifyApiError } from '@/lib/services/shopify-core'

const creds = { domain: 'shop.myshopify.com', accessToken: 't' }

beforeEach(() => {
  graphql.mockReset()
})

describe('updateOrderNote', () => {
  it('sends the note via orderUpdate and resolves (same as the old REST void return)', async () => {
    graphql.mockResolvedValueOnce({
      orderUpdate: { order: { id: 'gid://shopify/Order/123', note: 'Call before delivery' }, userErrors: [] },
    })

    const result = await updateOrderNote(creds, 123, { note: 'Call before delivery' })

    expect(result).toBeUndefined()
    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input).toEqual({ id: 'gid://shopify/Order/123', note: 'Call before delivery' })
  })

  it('converts a comma-separated tags string into the OrderInput tags array', async () => {
    graphql.mockResolvedValueOnce({
      orderUpdate: { order: { id: 'gid://shopify/Order/123', note: null }, userErrors: [] },
    })

    await updateOrderNote(creds, 123, { tags: 'vip, priority' })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input).toEqual({ id: 'gid://shopify/Order/123', tags: ['vip', 'priority'] })
  })

  it('omits note/tags keys entirely when the field is undefined', async () => {
    graphql.mockResolvedValueOnce({
      orderUpdate: { order: { id: 'gid://shopify/Order/123', note: null }, userErrors: [] },
    })

    await updateOrderNote(creds, 123, {})

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input).toEqual({ id: 'gid://shopify/Order/123' })
  })

  it('throws ShopifyApiError when orderUpdate returns userErrors, same failure mode as a non-2xx REST response', async () => {
    graphql.mockResolvedValueOnce({
      orderUpdate: { order: null, userErrors: [{ field: ['note'], message: 'Note is too long' }] },
    })

    const promise = updateOrderNote(creds, 123, { note: 'x'.repeat(6000) })
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/Note is too long/)
  })
})

describe('updateOrderAddress', () => {
  const address = {
    firstName: 'John',
    lastName: 'Doe',
    address1: '123 Main St',
    address2: 'Apt 4',
    city: 'Berlin',
    zip: '10115',
    country: 'Germany',
    countryCode: 'DE',
    phone: '+491234567',
  }

  it('sends shippingAddress via orderUpdate and maps the camelCase result back to the REST snake_case shape', async () => {
    graphql.mockResolvedValueOnce({
      orderUpdate: {
        order: {
          id: 'gid://shopify/Order/123',
          shippingAddress: {
            address1: '123 Main St',
            address2: 'Apt 4',
            city: 'Berlin',
            province: null,
            country: 'Germany',
            zip: '10115',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+491234567',
          },
        },
        userErrors: [],
      },
    })

    const result = await updateOrderAddress(creds, 123, address)

    expect(result).toEqual({
      first_name: 'John',
      last_name: 'Doe',
      address1: '123 Main St',
      address2: 'Apt 4',
      city: 'Berlin',
      province: null,
      country: 'Germany',
      zip: '10115',
      phone: '+491234567',
    })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: { id: string; shippingAddress: Record<string, unknown> } }]
    expect(variables.input.id).toBe('gid://shopify/Order/123')
    expect(variables.input.shippingAddress).toMatchObject({
      firstName: 'John',
      lastName: 'Doe',
      address1: '123 Main St',
      address2: 'Apt 4',
      city: 'Berlin',
      zip: '10115',
      country: 'Germany',
      countryCode: 'DE',
      phone: '+491234567',
    })
  })

  it('omits the countryCode key when not provided, avoiding a CountryCode enum coercion failure', async () => {
    graphql.mockResolvedValueOnce({
      orderUpdate: {
        order: { id: 'gid://shopify/Order/123', shippingAddress: { ...address, province: null, countryCode: undefined } },
        userErrors: [],
      },
    })

    await updateOrderAddress(creds, 123, { ...address, countryCode: undefined })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: { shippingAddress: Record<string, unknown> } }]
    expect('countryCode' in variables.input.shippingAddress).toBe(false)
  })

  it('throws ShopifyApiError when orderUpdate returns userErrors, same failure mode as a non-2xx REST response', async () => {
    graphql.mockResolvedValueOnce({
      orderUpdate: { order: null, userErrors: [{ field: ['shippingAddress', 'zip'], message: 'Zip is invalid' }] },
    })

    const promise = updateOrderAddress(creds, 123, address)
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/Zip is invalid/)
  })
})

describe('cancelOrder', () => {
  // The orderCancel mutation is asynchronous: it returns a `job`, not the order.
  // We keep the old REST return shape { id, cancelReason } by synthesizing it
  // from the inputs, since the caller only needs a truthy `order` (frontend
  // CancelModal checks `data.order`) and the MCP tool reads the object as text.
  const okResponse = {
    orderCancel: {
      job: { id: 'gid://shopify/Job/1', done: false },
      orderCancelUserErrors: [],
    },
  }

  it('cancels via orderCancel, mapping REST params to the mutation variables, and preserves the { id, cancelReason } return', async () => {
    graphql.mockResolvedValueOnce(okResponse)

    const result = await cancelOrder(creds, 123, { reason: 'fraud', restock: true, refund: true, notify: true })

    expect(result).toEqual({ id: 123, cancelReason: 'fraud' })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(variables).toEqual({
      orderId: 'gid://shopify/Order/123',
      reason: 'FRAUD',
      refund: true,
      restock: true,
      notifyCustomer: true,
    })
  })

  it('applies REST defaults: empty reason -> CUSTOMER, restock/notify default true, refund default false', async () => {
    graphql.mockResolvedValueOnce(okResponse)

    const result = await cancelOrder(creds, 456, {})

    expect(result).toEqual({ id: 456, cancelReason: 'customer' })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(variables).toEqual({
      orderId: 'gid://shopify/Order/456',
      reason: 'CUSTOMER',
      refund: false,
      restock: true,
      notifyCustomer: true,
    })
  })

  it('maps restock:false / notify:false / refund:false through to the mutation (no refund, no restock, no email)', async () => {
    graphql.mockResolvedValueOnce(okResponse)

    await cancelOrder(creds, 789, { reason: 'customer', restock: false, refund: false, notify: false })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(variables).toMatchObject({ refund: false, restock: false, notifyCustomer: false })
  })

  it.each([
    ['customer', 'CUSTOMER'],
    ['declined', 'DECLINED'],
    ['fraud', 'FRAUD'],
    ['inventory', 'INVENTORY'],
    ['other', 'OTHER'],
    ['staff', 'STAFF'],
    ['something-unmapped', 'OTHER'],
  ])('maps REST reason "%s" to OrderCancelReason %s', async (reason, expected) => {
    graphql.mockResolvedValueOnce(okResponse)

    await cancelOrder(creds, 1, { reason })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(variables.reason).toBe(expected)
  })

  it('throws ShopifyApiError when orderCancel returns orderCancelUserErrors, same failure mode as a non-2xx REST response', async () => {
    graphql.mockResolvedValueOnce({
      orderCancel: {
        job: null,
        orderCancelUserErrors: [{ field: ['orderId'], message: 'Order has already been cancelled' }],
      },
    })

    const promise = cancelOrder(creds, 123, { reason: 'customer' })
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/already been cancelled/)
  })
})

describe('createRefund', () => {
  // ── PATH 2: line-item refund ────────────────────────────────────────────────
  // Two GraphQL round-trips: (1) order.suggestedRefund to CALCULATE the amounts,
  // (2) refundCreate to apply. The fixture deliberately diverges the presentment
  // (42.00 USD) and shop (38.00 EUR) legs so the test proves we feed the
  // PRESENTMENT amount into OrderTransactionInput.amount — the money-critical bit.
  const suggestedRefundResponse = {
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
        maximumRefundableSet: { presentmentMoney: { amount: '42.00', currencyCode: 'USD' } },
      },
    },
  }

  const refundCreateResponse = {
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
  }

  it('PATH 2: calculates via suggestedRefund then applies refundCreate with the presentment-currency transaction amount', async () => {
    graphql.mockResolvedValueOnce(suggestedRefundResponse).mockResolvedValueOnce(refundCreateResponse)

    const result = await createRefund(creds, 123, {
      lineItems: [{ lineItemId: 111, quantity: 1 }],
      restock: true,
      notify: true,
      reason: 'damaged',
      shipping: false,
    })

    // Call 1: suggestedRefund query variables
    const [, , calcVars] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(calcVars.orderId).toBe('gid://shopify/Order/123')
    expect(calcVars.refundLineItems).toEqual([
      { lineItemId: 'gid://shopify/LineItem/111', quantity: 1, restockType: 'RETURN' },
    ])
    expect(calcVars.refundShipping).toBe(false)

    // Call 2: refundCreate input
    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input).toEqual({
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

    // Returned shape: truthy, numeric id, presentment amount preserved
    expect(result).toMatchObject({ id: 999, order_id: 123, amount: '42.00', currency: 'USD', note: 'damaged' })
  })

  it('PATH 2: maps restock:false -> NO_RESTOCK and shipping:true -> fullRefund/refundShipping', async () => {
    graphql.mockResolvedValueOnce(suggestedRefundResponse).mockResolvedValueOnce(refundCreateResponse)

    await createRefund(creds, 123, {
      lineItems: [{ lineItemId: 111, quantity: 2 }],
      restock: false,
      shipping: true,
    })

    const [, , calcVars] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(calcVars.refundLineItems).toEqual([
      { lineItemId: 'gid://shopify/LineItem/111', quantity: 2, restockType: 'NO_RESTOCK' },
    ])
    expect(calcVars.refundShipping).toBe(true)

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input).toMatchObject({
      notify: true, // notify undefined -> defaults true (REST notify !== false)
      currency: 'USD',
      shipping: { fullRefund: true },
      refundLineItems: [{ lineItemId: 'gid://shopify/LineItem/111', quantity: 2, restockType: 'NO_RESTOCK' }],
    })
  })

  // ── PATH 1: custom amount refund ────────────────────────────────────────────
  const orderTransactionsResponse = {
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
  }

  const customRefundCreateResponse = {
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
  }

  it('PATH 1: finds the capture/sale/authorization parent transaction and refunds the exact custom amount against it', async () => {
    graphql.mockResolvedValueOnce(orderTransactionsResponse).mockResolvedValueOnce(customRefundCreateResponse)

    const result = await createRefund(creds, 456, { customAmount: 10, reason: 'overcharge', notify: false })

    // Call 1: transactions query
    const [, , queryVars] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(queryVars.orderId).toBe('gid://shopify/Order/456')

    // Call 2: refundCreate input — custom path sends NO refundLineItems / shipping
    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input).toEqual({
      orderId: 'gid://shopify/Order/456',
      note: 'overcharge',
      notify: false, // RefundInput field is `notify`, NOT `notifyCustomer`
      currency: 'USD', // sourced from the parent transaction's presentment currencyCode
      transactions: [
        {
          orderId: 'gid://shopify/Order/456',
          parentId: 'gid://shopify/OrderTransaction/500',
          amount: '10.00', // customAmount.toFixed(2), preserved exactly
          gateway: 'shopify_payments',
          kind: 'REFUND',
        },
      ],
    })

    expect(result).toMatchObject({ id: 777, order_id: 456, amount: '10.00', currency: 'USD' })
  })

  it('PATH 1: throws ShopifyApiError when no capturable parent transaction exists (money-safe, no blind refund)', async () => {
    graphql.mockResolvedValueOnce({ order: { transactions: [] } })

    const promise = createRefund(creds, 456, { customAmount: 10, reason: 'overcharge' })
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    // refundCreate must NOT be attempted without a valid parent transaction
    expect(graphql.mock.calls.length).toBe(1)
  })

  // ── userErrors ──────────────────────────────────────────────────────────────
  it('throws ShopifyApiError when refundCreate returns userErrors, same failure mode as a non-2xx REST response', async () => {
    graphql.mockResolvedValueOnce(suggestedRefundResponse).mockResolvedValueOnce({
      refundCreate: {
        refund: null,
        userErrors: [{ field: ['orderId'], message: 'Order cannot be refunded' }],
      },
    })

    const promise = createRefund(creds, 123, { lineItems: [{ lineItemId: 111, quantity: 1 }] })
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/Order cannot be refunded/)
  })
})

describe('fulfillOrder', () => {
  // Replaces the 2-call REST flow (GET /orders/{id}/fulfillment_orders.json,
  // POST /fulfillments.json) with (1) order.fulfillmentOrders to find the open
  // ones, (2) fulfillmentCreate to fulfill them. FulfillmentOrderStatus is
  // UPPERCASE in GraphQL — mix in a CLOSED node to prove it's filtered out
  // exactly like the REST 'open'/'in_progress' filter did.
  const fulfillmentOrdersResponse = {
    order: {
      fulfillmentOrders: {
        edges: [
          { node: { id: 'gid://shopify/FulfillmentOrder/10', status: 'OPEN' } },
          { node: { id: 'gid://shopify/FulfillmentOrder/11', status: 'IN_PROGRESS' } },
          { node: { id: 'gid://shopify/FulfillmentOrder/12', status: 'CLOSED' } },
        ],
      },
    },
  }

  const fulfillmentCreateResponse = {
    fulfillmentCreate: {
      fulfillment: { id: 'gid://shopify/Fulfillment/555', status: 'SUCCESS' },
      userErrors: [],
    },
  }

  it('fulfills only the OPEN/IN_PROGRESS fulfillment orders, sends trackingInfo when a tracking number is given, and maps the return to a numeric id + lowercase status', async () => {
    graphql.mockResolvedValueOnce(fulfillmentOrdersResponse).mockResolvedValueOnce(fulfillmentCreateResponse)

    const result = await fulfillOrder(creds, 123, {
      trackingNumber: '1Z999',
      trackingCompany: 'UPS',
      trackingUrl: 'https://track.example/1Z999',
      notify: true,
    })

    // Call 1: fulfillmentOrders query
    const [, , queryVars] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(queryVars.orderId).toBe('gid://shopify/Order/123')

    // Call 2: fulfillmentCreate input — only the OPEN + IN_PROGRESS orders, CLOSED excluded
    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { fulfillment: Record<string, unknown> }]
    expect(mutationVars.fulfillment).toEqual({
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

    // Returned shape: REST returned a numeric id + lowercase status (e.g. 'success')
    expect(result).toEqual({ id: 555, status: 'success' })
  })

  it('omits trackingInfo entirely when no tracking number is given (matches REST\'s conditional tracking_info)', async () => {
    graphql.mockResolvedValueOnce(fulfillmentOrdersResponse).mockResolvedValueOnce(fulfillmentCreateResponse)

    await fulfillOrder(creds, 123, {})

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { fulfillment: Record<string, unknown> }]
    expect('trackingInfo' in mutationVars.fulfillment).toBe(false)
    expect(mutationVars.fulfillment.notifyCustomer).toBe(true) // notify undefined -> defaults true (REST notify !== false)
  })

  it('maps notify:false to notifyCustomer:false', async () => {
    graphql.mockResolvedValueOnce(fulfillmentOrdersResponse).mockResolvedValueOnce(fulfillmentCreateResponse)

    await fulfillOrder(creds, 123, { notify: false })

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { fulfillment: Record<string, unknown> }]
    expect(mutationVars.fulfillment.notifyCustomer).toBe(false)
  })

  it('throws "No open fulfillment found" when no fulfillment order is OPEN/IN_PROGRESS, without attempting fulfillmentCreate', async () => {
    graphql.mockResolvedValueOnce({
      order: {
        fulfillmentOrders: {
          edges: [{ node: { id: 'gid://shopify/FulfillmentOrder/12', status: 'CLOSED' } }],
        },
      },
    })

    const promise = fulfillOrder(creds, 123, {})
    await expect(promise).rejects.toThrow('No open fulfillment found')
    expect(graphql.mock.calls.length).toBe(1)
  })

  it('throws ShopifyApiError when fulfillmentCreate returns userErrors, same failure mode as a non-2xx REST response', async () => {
    graphql.mockResolvedValueOnce(fulfillmentOrdersResponse).mockResolvedValueOnce({
      fulfillmentCreate: {
        fulfillment: null,
        userErrors: [{ field: ['fulfillment'], message: 'Fulfillment order already closed' }],
      },
    })

    const promise = fulfillOrder(creds, 123, {})
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/already closed/)
  })
})

describe('editOrder', () => {
  // Replaces the 3-call REST flow (POST /orders/{id}/edits.json, POST
  // /order_edits/{editId}/line_items/{lineItemId}/set_quantity.json, POST
  // /order_edits/{editId}/commit.json) with orderEditBegin -> orderEditSetQuantity
  // (per line) -> orderEditCommit.
  //
  // THE CRITICAL BIT: REST's set_quantity took the ORIGINAL order line-item id in
  // its URL. GraphQL orderEditSetQuantity needs the CALCULATED line-item id from
  // the orderEditBegin result. CalculatedLineItem exposes no back-reference field
  // to the original LineItem, but its id numerically encodes it
  // (gid://shopify/CalculatedLineItem/{originalLineItemId}). So caller line-item
  // 111 must resolve to gid://shopify/CalculatedLineItem/111 — NOT
  // gid://shopify/LineItem/111 and NOT the raw 111.
  const beginResponse = {
    orderEditBegin: {
      calculatedOrder: {
        id: 'gid://shopify/CalculatedOrder/999',
        lineItems: {
          edges: [
            { node: { id: 'gid://shopify/CalculatedLineItem/111', quantity: 2 } },
            { node: { id: 'gid://shopify/CalculatedLineItem/222', quantity: 1 } },
          ],
        },
      },
      userErrors: [],
    },
  }

  const setQuantityResponse = {
    orderEditSetQuantity: {
      calculatedOrder: { id: 'gid://shopify/CalculatedOrder/999' },
      userErrors: [],
    },
  }

  // orderEditCommit returns the modified ORDER (not an order_edit). The presentment
  // (84.00 USD) and shop (76.00 EUR) legs are deliberately diverged to prove we
  // surface the PRESENTMENT recalculated total.
  const commitResponse = {
    orderEditCommit: {
      order: {
        id: 'gid://shopify/Order/123',
        name: '#1001',
        totalPriceSet: {
          presentmentMoney: { amount: '84.00', currencyCode: 'USD' },
          shopMoney: { amount: '76.00', currencyCode: 'EUR' },
        },
      },
      userErrors: [],
    },
  }

  it('begins the edit, sets quantity via the CALCULATED line-item id (not the original), commits, and maps the return', async () => {
    graphql
      .mockResolvedValueOnce(beginResponse)
      .mockResolvedValueOnce(setQuantityResponse)
      .mockResolvedValueOnce(commitResponse)

    const result = await editOrder(creds, 123, {
      lineItems: [{ lineItemId: 111, quantity: 3 }],
      reason: 'Customer changed mind',
      notify: true,
    })

    // Call 1: begin uses the order gid
    const [, , beginVars] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(beginVars).toEqual({ id: 'gid://shopify/Order/123' })

    // Call 2: set quantity — THE CRITICAL ASSERTION. Original line-item id 111 must
    // resolve to the CalculatedLineItem gid from the begin result, and the mutation
    // `id` is the CalculatedOrder id (not the order gid).
    const [, , setVars] = graphql.mock.calls[1] as [unknown, string, Record<string, unknown>]
    expect(setVars).toEqual({
      id: 'gid://shopify/CalculatedOrder/999',
      lineItemId: 'gid://shopify/CalculatedLineItem/111',
      quantity: 3,
      restock: true,
    })

    // Call 3: commit uses the CalculatedOrder id + REST-equivalent notify/staffNote
    const [, , commitVars] = graphql.mock.calls[2] as [unknown, string, Record<string, unknown>]
    expect(commitVars).toEqual({
      id: 'gid://shopify/CalculatedOrder/999',
      notifyCustomer: true,
      staffNote: 'Customer changed mind',
    })

    // Return: numeric id + the RECALCULATED presentment total (money-adjacent)
    expect(result).toEqual({
      id: 123,
      name: '#1001',
      total_price: '84.00',
      currency: 'USD',
      total_price_set: {
        presentmentMoney: { amount: '84.00', currencyCode: 'USD' },
        shopMoney: { amount: '76.00', currencyCode: 'EUR' },
      },
    })
  })

  it('applies REST defaults: empty reason -> staff-note fallback, notify default true, restock always true', async () => {
    graphql.mockResolvedValueOnce(beginResponse).mockResolvedValueOnce(setQuantityResponse).mockResolvedValueOnce(commitResponse)

    await editOrder(creds, 123, { lineItems: [{ lineItemId: 222, quantity: 0 }] })

    const [, , setVars] = graphql.mock.calls[1] as [unknown, string, Record<string, unknown>]
    expect(setVars).toEqual({
      id: 'gid://shopify/CalculatedOrder/999',
      lineItemId: 'gid://shopify/CalculatedLineItem/222',
      quantity: 0,
      restock: true,
    })

    const [, , commitVars] = graphql.mock.calls[2] as [unknown, string, Record<string, unknown>]
    expect(commitVars).toEqual({
      id: 'gid://shopify/CalculatedOrder/999',
      notifyCustomer: true, // notify undefined -> defaults true (REST notify !== false)
      staffNote: 'Order updated via support agent', // reason || fallback, preserved from REST
    })
  })

  it('preserves REST best-effort: a set_quantity userError is logged and skipped, the edit still commits', async () => {
    graphql
      .mockResolvedValueOnce(beginResponse)
      .mockResolvedValueOnce({
        orderEditSetQuantity: { calculatedOrder: null, userErrors: [{ field: ['quantity'], message: 'Quantity too high' }] },
      })
      .mockResolvedValueOnce(setQuantityResponse)
      .mockResolvedValueOnce(commitResponse)

    const result = await editOrder(creds, 123, {
      lineItems: [
        { lineItemId: 111, quantity: 99 },
        { lineItemId: 222, quantity: 1 },
      ],
    })

    // begin + 2 setQuantity (first errored but did NOT throw) + commit
    expect(graphql.mock.calls.length).toBe(4)
    const [, , commitVars] = graphql.mock.calls[3] as [unknown, string, Record<string, unknown>]
    expect(commitVars.id).toBe('gid://shopify/CalculatedOrder/999')
    expect(result).toMatchObject({ id: 123 })
  })

  it('preserves REST best-effort: a set_quantity transport failure is logged and skipped, the edit still commits', async () => {
    graphql
      .mockResolvedValueOnce(beginResponse)
      .mockRejectedValueOnce(new Error('network boom'))
      .mockResolvedValueOnce(commitResponse)

    const result = await editOrder(creds, 123, { lineItems: [{ lineItemId: 111, quantity: 3 }] })

    // begin + setQuantity (rejected, swallowed) + commit
    expect(graphql.mock.calls.length).toBe(3)
    expect(result).toMatchObject({ id: 123 })
  })

  it('skips a line item that has no matching calculated line item (best-effort) and still commits', async () => {
    graphql.mockResolvedValueOnce(beginResponse).mockResolvedValueOnce(commitResponse)

    const result = await editOrder(creds, 123, { lineItems: [{ lineItemId: 999999, quantity: 5 }] })

    // 999999 isn't in the begin result -> no setQuantity attempted; straight to commit
    expect(graphql.mock.calls.length).toBe(2)
    const [, , commitVars] = graphql.mock.calls[1] as [unknown, string, Record<string, unknown>]
    expect(commitVars.id).toBe('gid://shopify/CalculatedOrder/999')
    expect(result).toMatchObject({ id: 123 })
  })

  it('throws "No edit session returned from Shopify" when orderEditBegin returns no calculatedOrder, without setting quantities or committing', async () => {
    graphql.mockResolvedValueOnce({ orderEditBegin: { calculatedOrder: null, userErrors: [] } })

    const promise = editOrder(creds, 123, { lineItems: [{ lineItemId: 111, quantity: 3 }] })
    await expect(promise).rejects.toThrow('No edit session returned from Shopify')
    expect(graphql.mock.calls.length).toBe(1)
  })

  it('throws ShopifyApiError when orderEditCommit returns userErrors, same failure mode as a non-2xx REST commit', async () => {
    graphql
      .mockResolvedValueOnce(beginResponse)
      .mockResolvedValueOnce(setQuantityResponse)
      .mockResolvedValueOnce({
        orderEditCommit: { order: null, userErrors: [{ field: ['id'], message: 'Order edit cannot be committed' }] },
      })

    const promise = editOrder(creds, 123, { lineItems: [{ lineItemId: 111, quantity: 3 }] })
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/cannot be committed/)
  })
})

describe('duplicateOrder', () => {
  // Replaces the 2-call REST flow (GET /orders/{id}.json, POST
  // /draft_orders.json) with an `order` read query + `draftOrderCreate`
  // mutation. The line item with variant: null simulates a custom line item
  // (no variant) — REST filtered these out via `.filter(item => item.variant_id)`.
  const orderReadResponse = {
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
          {
            node: { quantity: 1, variant: null, discountAllocations: [] },
          },
        ],
      },
    },
  }

  const draftOrderCreateResponse = {
    draftOrderCreate: {
      draftOrder: { id: 'gid://shopify/DraftOrder/9001', name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' },
      userErrors: [],
    },
  }

  it('reads the order via GraphQL, builds DraftOrderInput line items (variantId + quantity), filters out the item with no variant, and maps the created draft order to {id, name, invoiceUrl}', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)

    const result = await duplicateOrder(creds, 123, {})

    const [, , readVars] = graphql.mock.calls[0] as [unknown, string, Record<string, unknown>]
    expect(readVars).toEqual({ orderId: 'gid://shopify/Order/123' })

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input.lineItems).toEqual([{ variantId: 'gid://shopify/ProductVariant/111', quantity: 2 }])

    // gid -> numeric id, same as the old REST draft_order.id
    expect(result).toEqual({ id: 9001, name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' })
  })

  it('copies the per-line-item discount (shop-currency leg) onto the line item when applyDiscount is true', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, { applyDiscount: true })

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input.lineItems).toEqual([
      {
        variantId: 'gid://shopify/ProductVariant/111',
        quantity: 2,
        appliedDiscount: { value: 5, valueType: 'FIXED_AMOUNT', title: 'Duplicated discount' },
      },
    ])
  })

  it('does not add a per-line-item discount when applyDiscount is false/omitted, even though discountAllocations exist', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, {})

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input.lineItems).toEqual([{ variantId: 'gid://shopify/ProductVariant/111', quantity: 2 }])
  })

  it('attaches the customer via purchasingEntity.customerId (DraftOrderInput.customerId is deprecated)', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, {})

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input.purchasingEntity).toEqual({ customerId: 'gid://shopify/Customer/55' })
    expect('customerId' in mutationVars.input).toBe(false)
  })

  it('omits purchasingEntity entirely when the order has no customer', async () => {
    graphql.mockResolvedValueOnce({ order: { ...orderReadResponse.order, customer: null } }).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, {})

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect('purchasingEntity' in mutationVars.input).toBe(false)
  })

  it('uses the provided note, or falls back to "Duplicate of {order.name}"', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)
    await duplicateOrder(creds, 123, {})
    const [, , fallbackVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(fallbackVars.input.note).toBe('Duplicate of #1001')

    graphql.mockReset()
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)
    await duplicateOrder(creds, 123, { note: 'Custom note' })
    const [, , customVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(customVars.input.note).toBe('Custom note')
  })

  it('splits a provided comma-separated tags string into the array DraftOrderInput.tags expects, or falls back to the order tags array', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)
    await duplicateOrder(creds, 123, { tags: 'a, b ,c' })
    const [, , splitVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(splitVars.input.tags).toEqual(['a', 'b', 'c'])

    graphql.mockReset()
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)
    await duplicateOrder(creds, 123, { tags: '' })
    const [, , fallbackVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(fallbackVars.input.tags).toEqual(['vip', 'wholesale'])
  })

  it.each([
    ['percentage', 'PERCENTAGE', '10% discount'],
    ['fixed', 'FIXED_AMOUNT', '€10 discount'],
  ])('applies the order-level appliedDiscount for discountType %s -> valueType %s', async (discountType, expectedValueType, expectedTitle) => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, { discountType, discountValue: 10 })

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input.appliedDiscount).toEqual({
      description: 'Discount',
      valueType: expectedValueType,
      value: 10, // Float, not the REST String(discountValue)
      title: expectedTitle,
    })
  })

  it('omits appliedDiscount when discountValue is 0, missing, or discountType is missing', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, { discountType: 'fixed', discountValue: 0 })

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect('appliedDiscount' in mutationVars.input).toBe(false)
  })

  it('includes shippingAddress (mapped 1:1 to MailingAddressInput) when keepAddress is not false and the order has one', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, {})

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect(mutationVars.input.shippingAddress).toEqual({
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
  })

  it('omits shippingAddress when keepAddress is false', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, { keepAddress: false })

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect('shippingAddress' in mutationVars.input).toBe(false)
  })

  it('omits shippingAddress when the order has none', async () => {
    graphql.mockResolvedValueOnce({ order: { ...orderReadResponse.order, shippingAddress: null } }).mockResolvedValueOnce(draftOrderCreateResponse)

    await duplicateOrder(creds, 123, {})

    const [, , mutationVars] = graphql.mock.calls[1] as [unknown, string, { input: Record<string, unknown> }]
    expect('shippingAddress' in mutationVars.input).toBe(false)
  })

  it('throws ShopifyApiError when draftOrderCreate returns userErrors, same failure mode as a non-2xx REST response', async () => {
    graphql.mockResolvedValueOnce(orderReadResponse).mockResolvedValueOnce({
      draftOrderCreate: { draftOrder: null, userErrors: [{ field: ['lineItems'], message: 'Variant is no longer available' }] },
    })

    const promise = duplicateOrder(creds, 123, {})
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/no longer available/)
  })

  it('throws when the order read returns null (bad orderId), without attempting draftOrderCreate', async () => {
    graphql.mockResolvedValueOnce({ order: null })

    const promise = duplicateOrder(creds, 999, {})
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    expect(graphql.mock.calls.length).toBe(1)
  })
})
