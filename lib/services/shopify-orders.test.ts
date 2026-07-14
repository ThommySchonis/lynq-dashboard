import { describe, it, expect, vi, beforeEach } from 'vitest'

// getOrderDetail throws a ShopifyApiError on a not-found order — mock the class
// so that branch stays testable without a real network call.
vi.mock('@/lib/services/shopify-core', () => ({
  ShopifyApiError: class ShopifyApiError extends Error {
    status?: number
    source?: string
    constructor(message: string, status?: number, source?: string) {
      super(message)
      this.status = status
      this.source = source
    }
  },
}))

// getOrders / getOrderDetail now use the GraphQL helper. Mock it so we assert the
// mapping against a GraphQL `data` payload instead of a REST JSON payload.
const graphql = vi.fn()
vi.mock('@/lib/services/shopify-graphql', () => ({
  shopifyGraphQL: (...args: unknown[]): unknown => graphql(...args),
  SHOPIFY_GRAPHQL_VERSION: '2025-04',
}))

// syncOrders writes to supabaseAdmin — a minimal thenable query builder captures
// the integrations.update({ store_currency }).eq().eq() chain and the
// shopify_orders.upsert(rows, opts) calls so we can assert the mapped rows.
const upsertCalls: Array<{ rows: Array<Record<string, unknown>>; options: unknown }> = []
const integrationsUpdates: Array<{ patch: Record<string, unknown>; filters: Array<[string, unknown]> }> = []

const upsertMock = vi.fn((rows: Array<Record<string, unknown>>, options: unknown) => {
  upsertCalls.push({ rows, options })
  return Promise.resolve({ error: null })
})

class FakeQuery implements PromiseLike<{ error: null }> {
  constructor(private readonly filters: Array<[string, unknown]>) {}
  eq(column: string, value: unknown): FakeQuery {
    this.filters.push([column, value])
    return this
  }
  then<TResult1 = { error: null }, TResult2 = never>(
    onfulfilled?: ((value: { error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve<{ error: null }>({ error: null }).then(onfulfilled, onrejected)
  }
}

const updateMock = vi.fn((patch: Record<string, unknown>) => {
  const filters: Array<[string, unknown]> = []
  integrationsUpdates.push({ patch, filters })
  return new FakeQuery(filters)
})

const fromMock = vi.fn((table: string) => {
  if (table === 'shopify_orders') return { upsert: upsertMock }
  return { update: updateMock }
})

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: (table: string): unknown => fromMock(table) },
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { getOrders, getOrderDetail, getRefunds, getOrdersWithLineItems, getCustomer, syncOrders } from '@/lib/services/shopify-orders'

const creds = { domain: 'shop.myshopify.com', accessToken: 't' }

beforeEach(() => {
  graphql.mockReset()
  upsertMock.mockClear()
  updateMock.mockClear()
  fromMock.mockClear()
  upsertCalls.length = 0
  integrationsUpdates.length = 0
})

describe('getOrders', () => {
  it('maps GraphQL order nodes back to the REST-shaped list', async () => {
    graphql.mockResolvedValueOnce({
      orders: {
        edges: [
          {
            node: {
              id: 'gid://shopify/Order/1',
              name: '#1001',
              createdAt: '2026-04-01T09:15:00Z',
              displayFinancialStatus: 'PAID',
              displayFulfillmentStatus: 'FULFILLED',
              cancelReason: null,
              totalPriceSet: { shopMoney: { amount: '89.95' } },
              customer: { firstName: 'Marco', lastName: 'Rossi' },
              refunds: [{ id: 'gid://shopify/Refund/5' }],
            },
          },
          {
            node: {
              id: 'gid://shopify/Order/2',
              name: '#1002',
              createdAt: '2026-04-02T00:00:00Z',
              displayFinancialStatus: 'PENDING',
              displayFulfillmentStatus: 'UNFULFILLED',
              cancelReason: null,
              totalPriceSet: { shopMoney: { amount: '59.95' } },
              customer: null,
              refunds: [],
            },
          },
          {
            node: {
              id: 'gid://shopify/Order/3',
              name: '#1003',
              createdAt: '2026-04-03T00:00:00Z',
              displayFinancialStatus: 'PARTIALLY_REFUNDED',
              displayFulfillmentStatus: 'PARTIALLY_FULFILLED',
              cancelReason: 'CUSTOMER',
              totalPriceSet: { shopMoney: { amount: '120.00' } },
              customer: { firstName: 'Ana', lastName: 'Bianchi' },
              refunds: [{ id: 'gid://shopify/Refund/9' }],
            },
          },
        ],
      },
    })

    const orders = await getOrders(creds)

    expect(orders).toEqual([
      {
        id: 1,
        name: '#1001',
        customer: 'Marco Rossi',
        total: '89.95',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        cancelReason: null,
        hasRefund: true,
        createdAt: '2026-04-01T09:15:00Z',
      },
      {
        id: 2,
        name: '#1002',
        customer: 'Unknown',
        total: '59.95',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        cancelReason: null,
        hasRefund: false,
        createdAt: '2026-04-02T00:00:00Z',
      },
      {
        id: 3,
        name: '#1003',
        customer: 'Ana Bianchi',
        total: '120.00',
        financialStatus: 'partially_refunded',
        fulfillmentStatus: 'partial',
        cancelReason: 'customer',
        hasRefund: true,
        createdAt: '2026-04-03T00:00:00Z',
      },
    ])
  })

  it('passes the requested limit to the GraphQL query variables', async () => {
    graphql.mockResolvedValueOnce({ orders: { edges: [] } })

    await getOrders(creds, { limit: 25 })

    expect(graphql).toHaveBeenCalledTimes(1)
    const call = graphql.mock.calls[0] as unknown[]
    expect(call[2]).toMatchObject({ first: 25 })
  })
})

describe('getOrderDetail', () => {
  it('maps a full GraphQL order back to the REST detail shape', async () => {
    graphql.mockResolvedValueOnce({
      order: {
        id: 'gid://shopify/Order/12345',
        name: '#1001',
        createdAt: '2026-04-01T09:15:00Z',
        displayFinancialStatus: 'PAID',
        displayFulfillmentStatus: 'FULFILLED',
        cancelReason: null,
        cancelledAt: null,
        currencyCode: 'EUR',
        tags: ['vip', 'wholesale'],
        note: 'Handle with care',
        customer: {
          id: 'gid://shopify/Customer/999',
          firstName: 'Marco',
          lastName: 'Rossi',
          email: 'marco@example.com',
          phone: '+39123',
          numberOfOrders: '7',
          amountSpent: { amount: '512.50' },
        },
        shippingAddress: {
          firstName: 'Marco',
          lastName: 'Rossi',
          address1: 'Via Roma 1',
          address2: null,
          city: 'Milano',
          province: 'Lombardy',
          provinceCode: 'MI',
          zip: '20100',
          country: 'Italy',
          countryCode: 'IT',
          phone: '+39123',
          company: null,
          name: 'Marco Rossi',
        },
        billingAddress: null,
        lineItems: {
          edges: [
            {
              node: {
                id: 'gid://shopify/LineItem/10',
                title: 'Denim Jacket',
                variantTitle: 'M',
                sku: 'DJ1',
                quantity: 2,
                originalUnitPriceSet: { shopMoney: { amount: '44.975' } },
              },
            },
          ],
        },
        subtotalPriceSet: { shopMoney: { amount: '89.95' } },
        totalShippingPriceSet: { shopMoney: { amount: '5.00' } },
        totalTaxSet: { shopMoney: { amount: '10.00' } },
        totalPriceSet: { shopMoney: { amount: '104.95' } },
        refunds: [
          {
            id: 'gid://shopify/Refund/5',
            createdAt: '2026-04-24T10:20:00Z',
            note: 'Quality issue',
            transactions: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/OrderTransaction/70',
                    kind: 'REFUND',
                    gateway: 'stripe',
                    amountSet: { shopMoney: { amount: '44.98' } },
                  },
                },
              ],
            },
            refundLineItems: {
              edges: [{ node: { quantity: 1, lineItem: { title: 'Denim Jacket' } } }],
            },
          },
        ],
        fulfillments: [
          {
            id: 'gid://shopify/Fulfillment/88',
            status: 'SUCCESS',
            trackingInfo: [{ number: 'TRK123', url: 'https://track/TRK123', company: 'DHL' }],
          },
        ],
      },
    })

    const order = await getOrderDetail(creds, 12345)

    expect(order).toEqual({
      id: 12345,
      name: '#1001',
      createdAt: '2026-04-01T09:15:00Z',
      financialStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      cancelReason: null,
      cancelledAt: null,
      customer: {
        id: 999,
        firstName: 'Marco',
        lastName: 'Rossi',
        email: 'marco@example.com',
        phone: '+39123',
        ordersCount: 7,
        totalSpent: '512.50',
      },
      shippingAddress: {
        first_name: 'Marco',
        last_name: 'Rossi',
        address1: 'Via Roma 1',
        address2: null,
        city: 'Milano',
        province: 'Lombardy',
        province_code: 'MI',
        zip: '20100',
        country: 'Italy',
        country_code: 'IT',
        phone: '+39123',
        company: null,
        name: 'Marco Rossi',
      },
      billingAddress: null,
      lineItems: [
        {
          id: 10,
          title: 'Denim Jacket',
          variantTitle: 'M',
          sku: 'DJ1',
          quantity: 2,
          price: '44.975',
          total: '89.95',
        },
      ],
      subtotalPrice: '89.95',
      totalShippingPrice: '5.00',
      totalTax: '10.00',
      totalPrice: '104.95',
      currency: 'EUR',
      refunds: [
        {
          id: 5,
          created_at: '2026-04-24T10:20:00Z',
          note: 'Quality issue',
          transactions: [{ id: 70, kind: 'refund', gateway: 'stripe', amount: '44.98' }],
          refund_line_items: [{ quantity: 1, line_item: { title: 'Denim Jacket' } }],
        },
      ],
      fulfillments: [
        {
          id: 88,
          status: 'success',
          trackingNumber: 'TRK123',
          trackingUrl: 'https://track/TRK123',
          trackingCompany: 'DHL',
        },
      ],
      tags: 'vip, wholesale',
      note: 'Handle with care',
    })
  })

  it('defaults fulfillmentStatus, empty tags and a null customer', async () => {
    graphql.mockResolvedValueOnce({
      order: {
        id: 'gid://shopify/Order/22',
        name: '#1002',
        createdAt: '2026-04-02T00:00:00Z',
        displayFinancialStatus: 'PENDING',
        displayFulfillmentStatus: 'UNFULFILLED',
        cancelReason: null,
        cancelledAt: null,
        currencyCode: 'EUR',
        tags: [],
        note: null,
        customer: null,
        shippingAddress: null,
        billingAddress: null,
        lineItems: { edges: [] },
        subtotalPriceSet: { shopMoney: { amount: '0.00' } },
        totalShippingPriceSet: { shopMoney: { amount: '0.00' } },
        totalTaxSet: { shopMoney: { amount: '0.00' } },
        totalPriceSet: { shopMoney: { amount: '0.00' } },
        refunds: [],
        fulfillments: [],
      },
    })

    const order = await getOrderDetail(creds, 22)

    expect(order).toMatchObject({
      id: 22,
      fulfillmentStatus: 'unfulfilled',
      customer: null,
      shippingAddress: null,
      billingAddress: null,
      lineItems: [],
      refunds: [],
      fulfillments: [],
      tags: '',
      note: null,
    })
  })

  it('wraps the numeric order id in a global id for the query', async () => {
    graphql.mockResolvedValueOnce({
      order: {
        id: 'gid://shopify/Order/777',
        name: '#777',
        createdAt: '2026-04-02T00:00:00Z',
        displayFinancialStatus: 'PAID',
        displayFulfillmentStatus: 'UNFULFILLED',
        cancelReason: null,
        cancelledAt: null,
        currencyCode: 'EUR',
        tags: [],
        note: null,
        customer: null,
        shippingAddress: null,
        billingAddress: null,
        lineItems: { edges: [] },
        subtotalPriceSet: { shopMoney: { amount: '0.00' } },
        totalShippingPriceSet: { shopMoney: { amount: '0.00' } },
        totalTaxSet: { shopMoney: { amount: '0.00' } },
        totalPriceSet: { shopMoney: { amount: '0.00' } },
        refunds: [],
        fulfillments: [],
      },
    })

    await getOrderDetail(creds, '777')

    const call = graphql.mock.calls[0] as unknown[]
    expect(call[2]).toEqual({ id: 'gid://shopify/Order/777' })
  })

  it('throws when the order is not found', async () => {
    graphql.mockResolvedValueOnce({ order: null })

    await expect(getOrderDetail(creds, 404)).rejects.toThrow(/not found/i)
  })
})

describe('getRefunds', () => {
  const dateRange = { from: '2026-04-01', to: '2026-04-30' }

  function refundNode(overrides: Record<string, unknown> = {}) {
    return {
      id: 'gid://shopify/Refund/5',
      createdAt: '2026-04-24T10:20:00Z',
      note: 'Quality issue',
      transactions: {
        edges: [
          {
            node: {
              id: 'gid://shopify/OrderTransaction/70',
              kind: 'REFUND',
              gateway: 'stripe',
              amountSet: { shopMoney: { amount: '44.98' } },
            },
          },
        ],
      },
      refundLineItems: {
        edges: [{ node: { quantity: 1, lineItem: { title: 'Denim Jacket' } } }],
      },
      ...overrides,
    }
  }

  it('paginates via GraphQL cursors, filters, aggregates and sorts refunds', async () => {
    graphql
      .mockResolvedValueOnce({
        orders: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Order/1',
                name: '#1001',
                email: null,
                cancelReason: null,
                totalPriceSet: { shopMoney: { amount: '100.00' } },
                customer: { firstName: 'Marco', lastName: 'Rossi', email: 'marco@example.com' },
                refunds: [refundNode()],
              },
            },
            {
              // No refunds at all -> excluded entirely.
              node: {
                id: 'gid://shopify/Order/2',
                name: '#1002',
                email: 'guest@example.com',
                cancelReason: null,
                totalPriceSet: { shopMoney: { amount: '50.00' } },
                customer: null,
                refunds: [],
              },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'cursor1' },
        },
      })
      .mockResolvedValueOnce({
        orders: {
          edges: [
            {
              // No customer -> falls back to email; cancelReason used as reason (no refund note).
              node: {
                id: 'gid://shopify/Order/3',
                name: '#1003',
                email: 'anon@example.com',
                cancelReason: 'CUSTOMER',
                totalPriceSet: { shopMoney: { amount: '80.00' } },
                customer: null,
                refunds: [
                  refundNode({
                    id: 'gid://shopify/Refund/9',
                    createdAt: '2026-04-20T08:00:00Z',
                    note: null,
                    transactions: {
                      edges: [
                        {
                          node: {
                            id: 'gid://shopify/OrderTransaction/91',
                            kind: 'REFUND',
                            gateway: 'manual',
                            amountSet: { shopMoney: { amount: '80.00' } },
                          },
                        },
                      ],
                    },
                    refundLineItems: {
                      edges: [{ node: { quantity: 2, lineItem: { title: 'Tote Bag' } } }],
                    },
                  }),
                ],
              },
            },
            {
              // Refund created before the date window -> order excluded (inRange is empty).
              node: {
                id: 'gid://shopify/Order/4',
                name: '#1004',
                email: 'old@example.com',
                cancelReason: null,
                totalPriceSet: { shopMoney: { amount: '20.00' } },
                customer: null,
                refunds: [refundNode({ createdAt: '2026-03-15T00:00:00Z' })],
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      })

    const refunds = await getRefunds(creds, dateRange)

    expect(refunds).toEqual([
      {
        orderId: '#1001',
        orderIdNumeric: 1,
        customer: 'Marco Rossi',
        customerEmail: 'marco@example.com',
        refundAmount: '44.98',
        orderTotal: '100.00',
        refundPct: '45.0',
        itemCount: 1,
        products: ['Denim Jacket'],
        reason: 'Quality issue',
        refundedAt: '2026-04-24T10:20:00Z',
      },
      {
        orderId: '#1003',
        orderIdNumeric: 3,
        customer: 'anon@example.com',
        customerEmail: 'anon@example.com',
        refundAmount: '80.00',
        orderTotal: '80.00',
        refundPct: '100.0',
        itemCount: 2,
        products: ['Tote Bag'],
        reason: 'customer',
        refundedAt: '2026-04-20T08:00:00Z',
      },
    ])

    // cursor pagination: 2 pages, second call carries the first page's endCursor.
    expect(graphql).toHaveBeenCalledTimes(2)
    const [, , firstVars] = graphql.mock.calls[0] as [unknown, unknown, Record<string, unknown>]
    const [, , secondVars] = graphql.mock.calls[1] as [unknown, unknown, Record<string, unknown>]
    expect(firstVars).toMatchObject({ after: null })
    expect(secondVars).toMatchObject({ after: 'cursor1' })
  })

  it('builds the query date-filter using search syntax with quoted timestamps', async () => {
    graphql.mockResolvedValueOnce({ orders: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } })

    await getRefunds(creds, dateRange)

    const call = graphql.mock.calls[0] as unknown[]
    expect(call[2]).toMatchObject({
      query: "updated_at:>='2026-04-01T00:00:00' updated_at:<='2026-04-30T23:59:59'",
    })
  })

  it('returns an empty array when no orders have refunds', async () => {
    graphql.mockResolvedValueOnce({ orders: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } })

    const refunds = await getRefunds(creds, dateRange)

    expect(refunds).toEqual([])
  })

  it('prefers presentment currency over shop currency for refundAmount/orderTotal/refundPct', async () => {
    // shopMoney and presentmentMoney diverge (multi-currency store, e.g. shop in
    // EUR, checkout in USD). The original REST getRefunds preferred
    // presentment_money for both the order total and the refund transaction
    // amount — this asserts the GraphQL migration reproduces that, not shopMoney.
    graphql.mockResolvedValueOnce({
      orders: {
        edges: [
          {
            node: {
              id: 'gid://shopify/Order/1',
              name: '#1001',
              email: null,
              cancelReason: null,
              totalPriceSet: { shopMoney: { amount: '100.00' }, presentmentMoney: { amount: '120.00' } },
              customer: { firstName: 'Marco', lastName: 'Rossi', email: 'marco@example.com' },
              refunds: [
                refundNode({
                  transactions: {
                    edges: [
                      {
                        node: {
                          id: 'gid://shopify/OrderTransaction/70',
                          kind: 'REFUND',
                          gateway: 'stripe',
                          amountSet: { shopMoney: { amount: '40.00' }, presentmentMoney: { amount: '60.00' } },
                        },
                      },
                    ],
                  },
                }),
              ],
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    })

    const refunds = await getRefunds(creds, dateRange)

    // presentment (60.00 / 120.00 = 50.0%), NOT shop currency (40.00 / 100.00 = 40.0%).
    expect(refunds).toEqual([
      expect.objectContaining({
        refundAmount: '60.00',
        orderTotal: '120.00',
        refundPct: '50.0',
      }),
    ])
  })
})

describe('getOrdersWithLineItems', () => {
  // Minimal refund node shared across fixtures below (same shape as getRefunds'
  // refundNode() helper — id/createdAt/note/transactions/refundLineItems).
  function refundNode(overrides: Record<string, unknown> = {}) {
    return {
      id: 'gid://shopify/Refund/5',
      createdAt: '2026-04-24T10:20:00Z',
      note: 'Quality issue',
      transactions: {
        edges: [
          {
            node: {
              id: 'gid://shopify/OrderTransaction/70',
              kind: 'REFUND',
              gateway: 'stripe',
              amountSet: { shopMoney: { amount: '89.95' } },
            },
          },
        ],
      },
      refundLineItems: {
        edges: [{ node: { quantity: 1, lineItem: { title: 'Denim Jacket' } } }],
      },
      ...overrides,
    }
  }

  function ordersPage(nodes: unknown[], pageInfo: { hasNextPage: boolean; endCursor: string | null } = { hasNextPage: false, endCursor: null }) {
    return { orders: { edges: nodes.map((node) => ({ node })), pageInfo } }
  }

  it('flattens an order with a refund and line items', async () => {
    graphql.mockResolvedValueOnce(
      ordersPage([
        {
          id: 'gid://shopify/Order/1',
          name: '#1001',
          createdAt: '2026-04-01T09:15:00Z',
          displayFinancialStatus: 'REFUNDED',
          displayFulfillmentStatus: 'FULFILLED',
          cancelReason: null,
          email: null,
          customer: { firstName: 'Marco', lastName: 'Rossi', email: 'marco@example.com' },
          totalPriceSet: { shopMoney: { amount: '89.95' } },
          lineItems: {
            edges: [
              {
                node: {
                  title: 'Denim Jacket',
                  quantity: 1,
                  sku: 'DJ1',
                  variantTitle: 'M',
                  originalUnitPriceSet: { shopMoney: { amount: '89.95' } },
                },
              },
            ],
          },
          refunds: [refundNode()],
        },
      ]),
    )

    const rows = await getOrdersWithLineItems(creds, { from: '2026-04-01', to: '2026-04-30' })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      orderNumber: '#1001',
      customer: 'Marco Rossi',
      customerEmail: 'marco@example.com',
      financialStatus: 'refunded',
      fulfillmentStatus: 'fulfilled',
      totalPrice: '89.95',
      refundAmount: 89.95,
      refundReason: 'Quality issue',
      refundedAt: '2026-04-24T10:20:00Z',
    })
    expect(rows[0].lineItems).toEqual([
      { title: 'Denim Jacket', quantity: 1, price: '89.95', sku: 'DJ1', variantTitle: 'M' },
    ])
  })

  it('defaults fulfillmentStatus and leaves refund fields empty when no refund', async () => {
    graphql.mockResolvedValueOnce(
      ordersPage([
        {
          id: 'gid://shopify/Order/2',
          name: '#1002',
          createdAt: '2026-04-02T00:00:00Z',
          displayFinancialStatus: 'PAID',
          displayFulfillmentStatus: 'UNFULFILLED',
          cancelReason: null,
          email: 'guest@example.com',
          customer: null,
          totalPriceSet: { shopMoney: { amount: '59.95' } },
          lineItems: { edges: [] },
          refunds: [],
        },
      ]),
    )

    const rows = await getOrdersWithLineItems(creds, { from: '2026-04-01', to: '2026-04-30' })

    expect(rows[0]).toMatchObject({
      orderNumber: '#1002',
      customer: 'guest@example.com',
      customerEmail: 'guest@example.com',
      fulfillmentStatus: 'unfulfilled',
      refundAmount: 0,
      refundReason: null,
      refundedAt: null,
    })
    expect(rows[0].lineItems).toEqual([])
  })

  it('paginates via GraphQL cursors, carrying endCursor into the next page', async () => {
    graphql
      .mockResolvedValueOnce(
        ordersPage(
          [
            {
              id: 'gid://shopify/Order/1',
              name: '#1',
              createdAt: '2026-04-01T00:00:00Z',
              displayFinancialStatus: 'PAID',
              displayFulfillmentStatus: 'UNFULFILLED',
              cancelReason: null,
              email: null,
              customer: null,
              totalPriceSet: { shopMoney: { amount: '1' } },
              lineItems: { edges: [] },
              refunds: [],
            },
          ],
          { hasNextPage: true, endCursor: 'cursor1' },
        ),
      )
      .mockResolvedValueOnce(
        ordersPage([
          {
            id: 'gid://shopify/Order/2',
            name: '#2',
            createdAt: '2026-04-02T00:00:00Z',
            displayFinancialStatus: 'PAID',
            displayFulfillmentStatus: 'UNFULFILLED',
            cancelReason: null,
            email: null,
            customer: null,
            totalPriceSet: { shopMoney: { amount: '2' } },
            lineItems: { edges: [] },
            refunds: [],
          },
        ]),
      )

    const rows = await getOrdersWithLineItems(creds, { from: '2026-04-01', to: '2026-04-30' })

    expect(rows.map((r) => r.orderNumber)).toEqual(['#1', '#2'])
    expect(graphql).toHaveBeenCalledTimes(2)
    const [, , firstVars] = graphql.mock.calls[0] as [unknown, unknown, Record<string, unknown>]
    const [, , secondVars] = graphql.mock.calls[1] as [unknown, unknown, Record<string, unknown>]
    expect(firstVars).toMatchObject({ after: null })
    expect(secondVars).toMatchObject({ after: 'cursor1' })
  })

  it('builds the query date-filter using created_at search syntax with quoted timestamps', async () => {
    graphql.mockResolvedValueOnce(ordersPage([]))

    await getOrdersWithLineItems(creds, { from: '2026-04-01', to: '2026-04-30' })

    const call = graphql.mock.calls[0] as unknown[]
    expect(call[2]).toMatchObject({
      query: "created_at:>='2026-04-01T00:00:00' created_at:<='2026-04-30T23:59:59'",
    })
  })

  it('prefers presentment currency over shop currency for refundAmount only (totalPrice/price stay shop currency)', async () => {
    // shopMoney and presentmentMoney diverge (multi-currency store). The original
    // REST getOrdersWithLineItems preferred presentment_money ONLY for refund
    // transaction amounts (amount_set.presentment_money || amount) — totalPrice
    // and line-item price were always bare (shop-currency) REST fields. This
    // asserts the GraphQL migration reproduces exactly that split, not a
    // blanket presentment preference.
    graphql.mockResolvedValueOnce(
      ordersPage([
        {
          id: 'gid://shopify/Order/1',
          name: '#1001',
          createdAt: '2026-04-01T09:15:00Z',
          displayFinancialStatus: 'PARTIALLY_REFUNDED',
          displayFulfillmentStatus: 'FULFILLED',
          cancelReason: null,
          email: null,
          customer: { firstName: 'Marco', lastName: 'Rossi', email: 'marco@example.com' },
          // shop 100.00 vs presentment 120.00 — totalPrice must read shop (100.00).
          totalPriceSet: { shopMoney: { amount: '100.00' } },
          lineItems: {
            edges: [
              {
                node: {
                  title: 'Denim Jacket',
                  quantity: 1,
                  sku: 'DJ1',
                  variantTitle: 'M',
                  // shop 40.00 vs (hypothetical) presentment — price must read shop (40.00).
                  originalUnitPriceSet: { shopMoney: { amount: '40.00' } },
                },
              },
            ],
          },
          refunds: [
            refundNode({
              transactions: {
                edges: [
                  {
                    node: {
                      id: 'gid://shopify/OrderTransaction/70',
                      kind: 'REFUND',
                      gateway: 'stripe',
                      // shop 40.00 vs presentment 60.00 — refundAmount must read presentment (60.00).
                      amountSet: { shopMoney: { amount: '40.00' }, presentmentMoney: { amount: '60.00' } },
                    },
                  },
                ],
              },
            }),
          ],
        },
      ]),
    )

    const rows = await getOrdersWithLineItems(creds, { from: '2026-04-01', to: '2026-04-30' })

    expect(rows[0]).toMatchObject({
      totalPrice: '100.00',
      refundAmount: 60,
    })
    expect(rows[0].lineItems[0]).toMatchObject({ price: '40.00' })
  })
})

describe('getCustomer', () => {
  function orderNode(overrides: Record<string, unknown> = {}) {
    return {
      id: 'gid://shopify/Order/501',
      name: '#2001',
      createdAt: '2026-05-01T10:00:00Z',
      displayFinancialStatus: 'PAID',
      displayFulfillmentStatus: 'FULFILLED',
      cancelReason: null,
      cancelledAt: null,
      totalPriceSet: { shopMoney: { amount: '150.00' } },
      currencyCode: 'EUR',
      lineItems: {
        edges: [
          {
            node: {
              id: 'gid://shopify/LineItem/30',
              title: 'Wool Scarf',
              variantTitle: 'Grey',
              sku: 'WS1',
              quantity: 1,
              originalUnitPriceSet: { shopMoney: { amount: '150.00' } },
            },
          },
        ],
      },
      fulfillments: [
        { status: 'SUCCESS', trackingInfo: [{ number: 'TRK9', url: 'https://track/TRK9', company: 'UPS' }] },
      ],
      refunds: [
        {
          id: 'gid://shopify/Refund/40',
          createdAt: '2026-05-10T00:00:00Z',
          note: 'Damaged',
          transactions: {
            edges: [
              {
                node: {
                  id: 'gid://shopify/OrderTransaction/80',
                  kind: 'REFUND',
                  gateway: 'stripe',
                  // shopMoney/presentmentMoney diverge on purpose — getCustomer's
                  // original REST refund pass-through read shop-currency amounts,
                  // unlike getOrderDetail/getRefunds which prefer presentment.
                  amountSet: { shopMoney: { amount: '30.00' }, presentmentMoney: { amount: '45.00' } },
                },
              },
            ],
          },
          refundLineItems: { edges: [{ node: { quantity: 1, lineItem: { title: 'Wool Scarf' } } }] },
        },
      ],
      shippingAddress: {
        firstName: 'Léa',
        lastName: 'Martin',
        address1: '5 Rue de Paris',
        address2: null,
        city: 'Paris',
        zip: '75001',
        country: 'France',
        countryCode: 'FR',
        phone: '+33123',
      },
      ...overrides,
    }
  }

  function customerFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'gid://shopify/Customer/321',
      firstName: 'Léa',
      lastName: 'Martin',
      email: 'lea@example.com',
      phone: '+33123',
      defaultAddress: {
        firstName: 'Léa',
        lastName: 'Martin',
        address1: '5 Rue de Paris',
        address2: null,
        city: 'Paris',
        province: 'Île-de-France',
        country: 'France',
        zip: '75001',
        phone: '+33123',
        countryCode: 'FR',
      },
      numberOfOrders: '4',
      amountSpent: { amount: '620.00', currencyCode: 'EUR' },
      tags: ['vip', 'newsletter'],
      note: 'Prefers email contact',
      createdAt: '2025-01-15T12:00:00Z',
      orders: { edges: [{ node: orderNode() }] },
      ...overrides,
    }
  }

  const expectedMappedOrder = {
    id: 501,
    name: '#2001',
    createdAt: '2026-05-01T10:00:00Z',
    financialStatus: 'paid',
    fulfillmentStatus: 'fulfilled',
    cancelReason: null,
    cancelledAt: null,
    totalPrice: '150.00',
    currency: 'EUR',
    lineItems: [
      { id: 30, title: 'Wool Scarf', variantTitle: 'Grey', sku: 'WS1', quantity: 1, price: '150.00' },
    ],
    fulfillments: [
      { trackingNumber: 'TRK9', trackingUrl: 'https://track/TRK9', trackingCompany: 'UPS', status: 'success' },
    ],
    refunds: [
      {
        id: 40,
        created_at: '2026-05-10T00:00:00Z',
        note: 'Damaged',
        transactions: [{ id: 80, kind: 'refund', gateway: 'stripe', amount: '30.00' }],
        refund_line_items: [{ quantity: 1, line_item: { title: 'Wool Scarf' } }],
      },
    ],
    shippingAddress: {
      firstName: 'Léa',
      lastName: 'Martin',
      address1: '5 Rue de Paris',
      address2: '',
      city: 'Paris',
      zip: '75001',
      country: 'France',
      countryCode: 'FR',
      phone: '+33123',
    },
  }

  const expectedMappedCustomer = {
    id: 321,
    firstName: 'Léa',
    lastName: 'Martin',
    email: 'lea@example.com',
    phone: '+33123',
    city: 'Paris',
    country: 'France',
    countryCode: 'FR',
    defaultAddress: {
      firstName: 'Léa',
      lastName: 'Martin',
      address1: '5 Rue de Paris',
      address2: null,
      city: 'Paris',
      province: 'Île-de-France',
      country: 'France',
      zip: '75001',
      phone: '+33123',
    },
    ordersCount: 4,
    totalSpent: '620.00',
    currency: 'EUR',
    tags: 'vip, newsletter',
    note: 'Prefers email contact',
    createdAt: '2025-01-15T12:00:00Z',
  }

  it('looks up a customer by email and merges their orders', async () => {
    graphql
      .mockResolvedValueOnce({ customers: { edges: [{ node: customerFixture() }] } })
      .mockResolvedValueOnce({ draftOrders: { edges: [] } })

    const result = await getCustomer(creds, { email: 'lea@example.com' })

    expect(result).toEqual({
      customer: expectedMappedCustomer,
      orders: [expectedMappedOrder],
    })

    const [, , vars] = graphql.mock.calls[0] as [unknown, unknown, Record<string, unknown>]
    // Exact-match phrase query — an unquoted email:value tokenizes and can
    // match on domain fragments. https://shopify.dev/docs/api/admin-graphql/latest/queries/customers
    expect(vars).toEqual({ query: 'email:"lea@example.com"' })
  })

  it('looks up a customer by order number, stripping a leading #', async () => {
    graphql
      .mockResolvedValueOnce({ orders: { edges: [{ node: { customer: customerFixture() } }] } })
      .mockResolvedValueOnce({ draftOrders: { edges: [] } })

    const result = await getCustomer(creds, { order: '#2001' })

    expect(result).toEqual({
      customer: expectedMappedCustomer,
      orders: [expectedMappedOrder],
    })

    const [, , vars] = graphql.mock.calls[0] as [unknown, unknown, Record<string, unknown>]
    expect(vars).toEqual({ query: 'name:2001' })
  })

  it('returns a null customer and empty orders when no match is found by email', async () => {
    graphql.mockResolvedValueOnce({ customers: { edges: [] } })

    const result = await getCustomer(creds, { email: 'nobody@example.com' })

    expect(result).toEqual({ customer: null, orders: [] })
    // Draft orders are never fetched when there's no customer to fetch them for.
    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it('returns a null customer when the matched order has no linked customer', async () => {
    graphql.mockResolvedValueOnce({ orders: { edges: [{ node: { customer: null } }] } })

    const result = await getCustomer(creds, { order: '3009' })

    expect(result).toEqual({ customer: null, orders: [] })
  })

  it('returns a null customer and empty orders when neither email nor order is given', async () => {
    const result = await getCustomer(creds, {})

    expect(result).toEqual({ customer: null, orders: [] })
    expect(graphql).not.toHaveBeenCalled()
  })

  it('merges GraphQL draft orders in with regular orders, sorted by createdAt desc', async () => {
    graphql
      .mockResolvedValueOnce({ customers: { edges: [{ node: customerFixture() }] } })
      .mockResolvedValueOnce({
        draftOrders: {
          edges: [
            {
              node: {
                id: 'gid://shopify/DraftOrder/77',
                name: '#D77',
                createdAt: '2026-06-01T00:00:00Z', // newer than the regular order
                status: 'OPEN',
                totalPriceSet: { shopMoney: { amount: '42.00', currencyCode: 'EUR' } },
                lineItems: { edges: [] },
                shippingAddress: null,
              },
            },
          ],
        },
      })

    const result = await getCustomer(creds, { email: 'lea@example.com' })

    expect(result.orders.map((o) => (o as { id: unknown }).id)).toEqual(['draft_77', 501])
  })

  it('prefers shop currency over presentment for refund transaction amounts (unlike getOrderDetail/getRefunds)', async () => {
    graphql
      .mockResolvedValueOnce({ customers: { edges: [{ node: customerFixture() }] } })
      .mockResolvedValueOnce({ draftOrders: { edges: [] } })

    const result = await getCustomer(creds, { email: 'lea@example.com' })

    expect(result.orders[0]).toMatchObject({
      refunds: [expect.objectContaining({ transactions: [expect.objectContaining({ amount: '30.00' })] })],
    })
  })
})

describe('syncOrders', () => {
  const workspaceId = 'ws-1'
  const userId = 'user-1'

  // Order whose presentment (checkout) currency diverges from shop currency —
  // every money field must prefer presentmentMoney, matching the original REST
  // `_set.presentment_money || <bare field>` mapping (the whole point of this fn).
  function divergentOrderNode() {
    return {
      id: 'gid://shopify/Order/1001',
      name: '#1001',
      displayFinancialStatus: 'PARTIALLY_REFUNDED',
      cancelReason: 'CUSTOMER',
      sourceName: 'web',
      presentmentCurrencyCode: 'USD',
      currencyCode: 'EUR',
      processedAt: '2026-05-01T10:00:00Z',
      createdAt: '2026-05-01T09:00:00Z',
      updatedAt: '2026-05-02T09:00:00Z',
      subtotalPriceSet: { shopMoney: { amount: '100.00' }, presentmentMoney: { amount: '120.00' } },
      totalPriceSet: { shopMoney: { amount: '110.00' }, presentmentMoney: { amount: '132.00' } },
      totalDiscountsSet: { shopMoney: { amount: '10.00' }, presentmentMoney: { amount: '12.00' } },
      customer: { firstName: 'Marco', lastName: 'Rossi', email: 'marco@example.com' },
      email: 'marco@example.com',
      refunds: [
        {
          transactions: {
            edges: [
              { node: { amountSet: { shopMoney: { amount: '5.00' }, presentmentMoney: { amount: '6.00' } } } },
              { node: { amountSet: { shopMoney: { amount: '2.00' }, presentmentMoney: { amount: '3.00' } } } },
            ],
          },
        },
      ],
    }
  }

  // Order without presentmentMoney and no refunds — money must fall back to
  // shopMoney, and null customer/status/source map through as the REST version did.
  function shopOnlyOrderNode() {
    return {
      id: 'gid://shopify/Order/1002',
      name: '#1002',
      displayFinancialStatus: null,
      cancelReason: null,
      sourceName: null,
      presentmentCurrencyCode: 'EUR',
      currencyCode: 'EUR',
      processedAt: '2026-05-03T10:00:00Z',
      createdAt: '2026-05-03T09:00:00Z',
      updatedAt: '2026-05-03T09:30:00Z',
      subtotalPriceSet: { shopMoney: { amount: '50.00' } },
      totalPriceSet: { shopMoney: { amount: '55.00' } },
      totalDiscountsSet: { shopMoney: { amount: '0.00' } },
      customer: null,
      email: 'guest@example.com',
      refunds: [],
    }
  }

  it('maps GraphQL orders to shopify_orders rows, preferring presentment money with shop fallback', async () => {
    graphql
      .mockResolvedValueOnce({ shop: { currencyCode: 'EUR' } })
      .mockResolvedValueOnce({
        orders: {
          edges: [{ node: divergentOrderNode() }, { node: shopOnlyOrderNode() }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      })

    const result = await syncOrders(workspaceId, creds, userId, { storeId: 'store-1' })

    expect(result).toEqual({ synced: 2 })
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].options).toEqual({ onConflict: 'workspace_id,id' })

    const rows = upsertCalls[0].rows
    expect(rows[0]).toMatchObject({
      id: 1001,
      client_id: userId,
      workspace_id: workspaceId,
      order_number: '#1001',
      financial_status: 'partially_refunded',
      cancel_reason: 'customer',
      subtotal_price: 120, // presentment, not shop 100
      total_price: 132, // presentment, not shop 110
      total_discounts: 12, // presentment, not shop 10
      refund_amount: 9, // presentment 6 + 3, not shop 5 + 2
      presentment_currency: 'USD',
      source_name: 'web',
      customer_email: 'marco@example.com',
      customer_name: 'Marco Rossi',
      processed_at: '2026-05-01T10:00:00Z',
      created_at_shopify: '2026-05-01T09:00:00Z',
      updated_at_shopify: '2026-05-02T09:00:00Z',
      store_id: 'store-1',
    })
    expect(typeof rows[0].synced_at).toBe('string')

    expect(rows[1]).toMatchObject({
      id: 1002,
      order_number: '#1002',
      financial_status: null,
      cancel_reason: null,
      subtotal_price: 50, // shop fallback (no presentmentMoney)
      total_price: 55,
      total_discounts: 0,
      refund_amount: 0,
      presentment_currency: 'EUR',
      source_name: null,
      customer_email: 'guest@example.com',
      customer_name: null,
      store_id: 'store-1',
    })
  })

  it('writes the shop currency to integrations scoped by store + workspace', async () => {
    graphql
      .mockResolvedValueOnce({ shop: { currencyCode: 'USD' } })
      .mockResolvedValueOnce({ orders: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } })

    await syncOrders(workspaceId, creds, userId, { storeId: 'store-1' })

    expect(integrationsUpdates).toHaveLength(1)
    expect(integrationsUpdates[0].patch).toEqual({ store_currency: 'USD' })
    expect(integrationsUpdates[0].filters).toEqual([
      ['store_id', 'store-1'],
      ['workspace_id', workspaceId],
    ])
  })

  it('defaults currency to EUR and scopes the update by workspace only when no storeId', async () => {
    graphql
      .mockResolvedValueOnce({ shop: {} })
      .mockResolvedValueOnce({ orders: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } })

    await syncOrders(workspaceId, creds, userId, {})

    expect(integrationsUpdates[0].patch).toEqual({ store_currency: 'EUR' })
    expect(integrationsUpdates[0].filters).toEqual([['workspace_id', workspaceId]])
  })

  it('paginates orders via GraphQL cursors, carrying endCursor into the next page', async () => {
    graphql
      .mockResolvedValueOnce({ shop: { currencyCode: 'EUR' } })
      .mockResolvedValueOnce({
        orders: { edges: [{ node: divergentOrderNode() }], pageInfo: { hasNextPage: true, endCursor: 'cursor1' } },
      })
      .mockResolvedValueOnce({
        orders: { edges: [{ node: shopOnlyOrderNode() }], pageInfo: { hasNextPage: false, endCursor: null } },
      })

    const result = await syncOrders(workspaceId, creds, userId, { storeId: 'store-1' })

    expect(result).toEqual({ synced: 2 })
    expect(graphql).toHaveBeenCalledTimes(3) // shop + 2 order pages
    const [, , firstOrderVars] = graphql.mock.calls[1] as [unknown, unknown, Record<string, unknown>]
    const [, , secondOrderVars] = graphql.mock.calls[2] as [unknown, unknown, Record<string, unknown>]
    expect(firstOrderVars).toMatchObject({ after: null })
    expect(secondOrderVars).toMatchObject({ after: 'cursor1' })
  })

  it('filters to the last 90 days by processed_at for an incremental sync', async () => {
    graphql
      .mockResolvedValueOnce({ shop: { currencyCode: 'EUR' } })
      .mockResolvedValueOnce({ orders: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } })

    await syncOrders(workspaceId, creds, userId, { storeId: 'store-1' })

    const [, , orderVars] = graphql.mock.calls[1] as [unknown, unknown, Record<string, unknown>]
    expect(String(orderVars.query)).toMatch(/^processed_at:>='.+'$/)
  })

  it('uses no date filter for a full sync', async () => {
    graphql
      .mockResolvedValueOnce({ shop: { currencyCode: 'EUR' } })
      .mockResolvedValueOnce({ orders: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } })

    await syncOrders(workspaceId, creds, userId, { storeId: 'store-1', full: true })

    const [, , orderVars] = graphql.mock.calls[1] as [unknown, unknown, Record<string, unknown>]
    expect(orderVars.query).toBe('')
  })

  it('still syncs orders when the shop-currency query fails', async () => {
    graphql
      .mockRejectedValueOnce(new Error('shop query failed'))
      .mockResolvedValueOnce({
        orders: { edges: [{ node: shopOnlyOrderNode() }], pageInfo: { hasNextPage: false, endCursor: null } },
      })

    const result = await syncOrders(workspaceId, creds, userId, { storeId: 'store-1' })

    expect(result).toEqual({ synced: 1 })
    expect(integrationsUpdates).toHaveLength(0) // currency write skipped, sync continued
    expect(upsertCalls[0].rows[0]).toMatchObject({ id: 1002 })
  })
})
