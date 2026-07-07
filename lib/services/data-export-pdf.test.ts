import { describe, it, expect, vi, beforeEach } from 'vitest'

const resolveAnalyticsInputs = vi.fn()
const resolveOrders = vi.fn()
vi.mock('@/lib/services/data-export-sources', () => ({
  resolveAnalyticsInputs: (...a: unknown[]): unknown => resolveAnalyticsInputs(...a),
  resolveOrders: (...a: unknown[]): unknown => resolveOrders(...a),
}))

import { buildOrdersReportData, buildAnalyticsReportData } from '@/lib/services/data-export-pdf'

const params = { workspaceId: 'w1', storeId: 's1', credentials: { domain: 'shop.myshopify.com', accessToken: 't' } }

beforeEach(() => {
  resolveAnalyticsInputs.mockReset(); resolveOrders.mockReset()
})

describe('buildOrdersReportData', () => {
  it('aggregates top products and monthly breakdown', async () => {
    resolveAnalyticsInputs.mockResolvedValueOnce({
      kpi: { totalOrders: 2, totalRefunds: 1, netRevenue: 200, returns: 50, cancelledOrders: 0, discounts: 0 },
      trend: [], refunds: [],
    })
    resolveOrders.mockResolvedValueOnce([
      { orderNumber: '#1', createdAt: '2026-04-01T00:00:00Z', totalPrice: '100', refundAmount: 0, lineItems: [{ title: 'Jacket', quantity: 2, price: '50' }] },
      { orderNumber: '#2', createdAt: '2026-04-10T00:00:00Z', totalPrice: '100', refundAmount: 50, lineItems: [{ title: 'Jacket', quantity: 1, price: '50' }] },
    ])

    const data = await buildOrdersReportData(params)

    expect(data.totalOrders).toBe(2)
    expect(data.topProducts[0]).toMatchObject({ title: 'Jacket', orders: 3 })
    expect(data.monthlyBreakdown.at(-1)).toMatchObject({ orders: 2, revenue: 200, refunds: 50 })
  })
})

describe('buildAnalyticsReportData', () => {
  it('aggregates top refund reasons and products from refunds + orders', async () => {
    resolveAnalyticsInputs.mockResolvedValueOnce({
      kpi: { totalOrders: 10, totalRefunds: 2, netRevenue: 500, returns: 100, cancelledOrders: 0, discounts: 0 },
      trend: [{ date: '2026-04-01', revenue: 50 }],
      refunds: [],
    })
    resolveOrders.mockResolvedValueOnce([
      { orderNumber: '#1', createdAt: '2026-04-01T00:00:00Z', totalPrice: '100', refundAmount: 50, refundReason: 'Quality', lineItems: [{ title: 'Jacket', quantity: 1, price: '50' }] },
    ])

    const data = await buildAnalyticsReportData(params)

    expect(data.totalOrders).toBe(10)
    expect(data.topRefundReasons[0]).toMatchObject({ reason: 'Quality', count: 1, amount: 50 })
    expect(data.topRefundProducts[0]).toMatchObject({ title: 'Jacket', count: 1, amount: 50 })
  })
})
