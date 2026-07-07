import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the paginated fetch so no real network call happens.
const paginated = vi.fn()
vi.mock('@/lib/services/shopify-core', () => ({
  shopifyPaginatedFetch: (...args: unknown[]): unknown => paginated(...args),
  SHOPIFY_API_VERSION: '2025-04',
}))

import { getOrdersWithLineItems } from '@/lib/services/shopify-orders'

const creds = { domain: 'shop.myshopify.com', accessToken: 't' }

beforeEach(() => {
  paginated.mockReset()
})

describe('getOrdersWithLineItems', () => {
  it('flattens an order with a refund and line items', async () => {
    paginated.mockResolvedValueOnce({
      data: {
        orders: [
          {
            id: 1,
            name: '#1001',
            created_at: '2026-04-01T09:15:00Z',
            financial_status: 'refunded',
            fulfillment_status: 'fulfilled',
            cancel_reason: null,
            customer: { first_name: 'Marco', last_name: 'Rossi', email: 'marco@example.com' },
            total_price: '89.95',
            line_items: [
              { id: 10, title: 'Denim Jacket', quantity: 1, price: '89.95', sku: 'DJ1', variant_title: 'M' },
            ],
            refunds: [
              {
                created_at: '2026-04-24T10:20:00Z',
                note: 'Quality issue',
                transactions: [{ amount: '89.95' }],
                refund_line_items: [{ quantity: 1, line_item: { title: 'Denim Jacket' } }],
              },
            ],
          },
        ],
      },
      nextUrl: null,
    })

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
    paginated.mockResolvedValueOnce({
      data: {
        orders: [
          {
            id: 2,
            name: '#1002',
            created_at: '2026-04-02T00:00:00Z',
            financial_status: 'paid',
            fulfillment_status: null,
            customer: null,
            email: 'guest@example.com',
            total_price: '59.95',
            line_items: [],
            refunds: [],
          },
        ],
      },
      nextUrl: null,
    })

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

  it('follows pagination via nextUrl', async () => {
    paginated
      .mockResolvedValueOnce({ data: { orders: [{ id: 1, name: '#1', created_at: '2026-04-01T00:00:00Z', financial_status: 'paid', customer: null, total_price: '1', line_items: [], refunds: [] }] }, nextUrl: 'https://next' })
      .mockResolvedValueOnce({ data: { orders: [{ id: 2, name: '#2', created_at: '2026-04-02T00:00:00Z', financial_status: 'paid', customer: null, total_price: '2', line_items: [], refunds: [] }] }, nextUrl: null })

    const rows = await getOrdersWithLineItems(creds, { from: '2026-04-01', to: '2026-04-30' })

    expect(rows.map((r) => r.orderNumber)).toEqual(['#1', '#2'])
    expect(paginated).toHaveBeenCalledTimes(2)
  })
})
