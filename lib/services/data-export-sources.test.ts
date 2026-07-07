import { describe, it, expect, vi, beforeEach } from 'vitest'

const getRefunds = vi.fn()
const getOrdersWithLineItems = vi.fn()
vi.mock('@/lib/services/shopify-orders', () => ({
  getRefunds: (...a: unknown[]): unknown => getRefunds(...a),
  getOrdersWithLineItems: (...a: unknown[]): unknown => getOrdersWithLineItems(...a),
}))

const rpc = vi.fn()
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { rpc: (...a: unknown[]): unknown => rpc(...a) },
}))

import { resolveAnalyticsInputs, resolveOrders } from '@/lib/services/data-export-sources'
import { DEMO_SHOP, DEMO_KPIS, DEMO_REFUNDS } from '@/lib/demoData'

const range = { from: '2026-04-01', to: '2026-04-30' }

beforeEach(() => {
  getRefunds.mockReset(); getOrdersWithLineItems.mockReset(); rpc.mockReset()
})

describe('resolveAnalyticsInputs', () => {
  it('returns demo datasets for the demo store without calling live sources', async () => {
    const creds = { domain: DEMO_SHOP, accessToken: 'x' }
    const out = await resolveAnalyticsInputs({ workspaceId: 'w1', storeId: 's1', credentials: creds, range })
    expect(out.kpi).toEqual(DEMO_KPIS)
    expect(out.refunds).toEqual(DEMO_REFUNDS)
    expect(rpc).not.toHaveBeenCalled()
    expect(getRefunds).not.toHaveBeenCalled()
  })

  it('calls RPCs (with p_store_id) and getRefunds for a live store', async () => {
    rpc
      .mockResolvedValueOnce({ data: { totalOrders: 5 }, error: null }) // get_kpis
      .mockResolvedValueOnce({ data: [{ date: '2026-04-01', revenue: 10 }], error: null }) // get_revenue_trend
    getRefunds.mockResolvedValueOnce([{ orderId: '#1', reason: 'x', refundAmount: '5', refundedAt: '2026-04-02T00:00:00Z', customer: 'A', customerEmail: null, refundPct: '100', products: [] }])

    const creds = { domain: 'shop.myshopify.com', accessToken: 't' }
    const out = await resolveAnalyticsInputs({ workspaceId: 'w1', storeId: 's1', credentials: creds, range })

    expect(rpc).toHaveBeenNthCalledWith(1, 'get_kpis', { p_workspace_id: 'w1', p_from: '2026-04-01', p_to: '2026-04-30', p_store_id: 's1' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'get_revenue_trend', { p_workspace_id: 'w1', p_from: '2026-04-01', p_to: '2026-04-30', p_store_id: 's1' })
    expect(out.kpi).toEqual({ totalOrders: 5 })
    expect(out.trend).toEqual([{ date: '2026-04-01', revenue: 10 }])
    expect(out.refunds[0].orderId).toBe('#1')
  })

  it('throws when an RPC returns an error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const creds = { domain: 'shop.myshopify.com', accessToken: 't' }
    await expect(resolveAnalyticsInputs({ workspaceId: 'w1', storeId: 's1', credentials: creds, range }))
      .rejects.toThrow(/get_kpis/)
  })
})

describe('resolveOrders', () => {
  it('maps demo orders to OrderWithLineItems with empty line items and merged refunds', async () => {
    const creds = { domain: DEMO_SHOP, accessToken: 'x' }
    const rows = await resolveOrders({ credentials: creds, range })
    const refundedDemo = DEMO_REFUNDS[0]
    const match = rows.find((r) => r.orderNumber === refundedDemo.orderId)
    expect(match).toBeDefined()
    expect(match?.lineItems).toEqual([])
    expect(match?.refundAmount).toBeCloseTo(Number(refundedDemo.refundAmount))
    expect(match?.refundReason).toBe(refundedDemo.reason)
    expect(getOrdersWithLineItems).not.toHaveBeenCalled()
  })

  it('delegates to getOrdersWithLineItems for a live store', async () => {
    getOrdersWithLineItems.mockResolvedValueOnce([{ orderNumber: '#9' }])
    const creds = { domain: 'shop.myshopify.com', accessToken: 't' }
    const rows = await resolveOrders({ credentials: creds, range })
    expect(getOrdersWithLineItems).toHaveBeenCalledWith(creds, range)
    expect(rows).toEqual([{ orderNumber: '#9' }])
  })
})
