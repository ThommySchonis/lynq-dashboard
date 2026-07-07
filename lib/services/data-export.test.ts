import { describe, it, expect, vi, beforeEach } from 'vitest'

const resolveAnalyticsInputs = vi.fn()
const resolveOrders = vi.fn()
vi.mock('@/lib/services/data-export-sources', () => ({
  resolveAnalyticsInputs: (...a: unknown[]): unknown => resolveAnalyticsInputs(...a),
  resolveOrders: (...a: unknown[]): unknown => resolveOrders(...a),
}))

import { exportAnalyticsCSV, exportOrdersCSV, formatCSV } from '@/lib/services/data-export'

const creds = { domain: 'shop.myshopify.com', accessToken: 't' }
const params = { workspaceId: 'w1', storeId: 's1', credentials: creds }

beforeEach(() => {
  resolveAnalyticsInputs.mockReset(); resolveOrders.mockReset()
})

describe('formatCSV', () => {
  it('quotes fields with commas', () => {
    expect(formatCSV(['a'], [['x,y']])).toBe('a\r\n"x,y"')
  })
})

describe('exportAnalyticsCSV', () => {
  it('emits KPI, trend, and refund sections from resolved inputs', async () => {
    resolveAnalyticsInputs.mockResolvedValueOnce({
      kpi: { totalOrders: 5, totalRefunds: 1, netRevenue: 100, returns: 20, cancelledOrders: 0, discounts: 3 },
      trend: [{ date: '2026-04-01', revenue: 50 }],
      refunds: [{ orderId: '#1', customer: 'Marco', reason: 'Quality', refundAmount: '89.95', refundedAt: '2026-04-24T10:20:00Z', products: ['Jacket'], customerEmail: null, refundPct: '100' }],
    })

    const csv = await exportAnalyticsCSV(params)

    expect(csv).toContain('--- KPI Summary ---')
    expect(csv).toContain('Total Orders,5')
    expect(csv).toContain('--- Revenue Trend (Last 90 Days) ---')
    expect(csv).toContain('2026-04-01,50')
    expect(csv).toContain('--- Refunds ---')
    expect(csv).toContain('Order,Customer,Reason,Amount,Date,Products')
    expect(csv).toContain('#1,Marco,Quality,89.95,2026-04-24T10:20:00Z,Jacket')
  })
})

describe('exportOrdersCSV', () => {
  it('emits one row per line item and a blank-item row when there are none', async () => {
    resolveOrders.mockResolvedValueOnce([
      {
        orderNumber: '#1', createdAt: '2026-04-01T00:00:00Z', customer: 'A', customerEmail: 'a@x.com',
        financialStatus: 'refunded', fulfillmentStatus: 'fulfilled', totalPrice: '89.95', cancelReason: null,
        refundAmount: 89.95, refundReason: 'Quality', refundedAt: '2026-04-24T10:20:00Z',
        lineItems: [{ title: 'Jacket', quantity: 1, price: '89.95', sku: 'DJ1', variantTitle: 'M' }],
      },
      {
        orderNumber: '#2', createdAt: '2026-04-02T00:00:00Z', customer: 'B', customerEmail: null,
        financialStatus: 'paid', fulfillmentStatus: 'unfulfilled', totalPrice: '10', cancelReason: null,
        refundAmount: 0, refundReason: null, refundedAt: null, lineItems: [],
      },
    ])

    const csv = await exportOrdersCSV(params)
    const lines = csv.split('\r\n')

    expect(lines[0]).toContain('Order Number')
    expect(lines[0]).toContain('Item Title')
    expect(csv).toContain('#1,2026-04-01T00:00:00Z,A,a@x.com,refunded,fulfilled,89.95,Quality,89.95,2026-04-24T10:20:00Z,Jacket,M,DJ1,1,89.95')
    // order #2 has no line items -> one row with blank item columns
    expect(csv).toContain('#2,2026-04-02T00:00:00Z,B,,paid,unfulfilled,10,,0,,,,,,')
  })
})
