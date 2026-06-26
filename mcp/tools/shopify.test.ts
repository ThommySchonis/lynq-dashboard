import { describe, it, expect, vi, beforeEach } from 'vitest'

const listStores = vi.fn()
const listOrdersForWorkspace = vi.fn()
const getOrderForWorkspace = vi.fn()
const lookupCustomerForWorkspace = vi.fn()
const getKPIs = vi.fn()
const getRevenueTrend = vi.fn()
const refundOrderForWorkspace = vi.fn()
const cancelOrderForWorkspace = vi.fn()
const fulfillOrderForWorkspace = vi.fn()
const updateOrderNoteForWorkspace = vi.fn()
const updateOrderAddressForWorkspace = vi.fn()

vi.mock('@/lib/services/stores', () => ({
  listStores: (...a: unknown[]): unknown => listStores(...a),
}))
vi.mock('@/lib/services/mcp-shopify', () => ({
  listOrdersForWorkspace: (...a: unknown[]): unknown => listOrdersForWorkspace(...a),
  getOrderForWorkspace: (...a: unknown[]): unknown => getOrderForWorkspace(...a),
  lookupCustomerForWorkspace: (...a: unknown[]): unknown => lookupCustomerForWorkspace(...a),
  refundOrderForWorkspace: (...a: unknown[]): unknown => refundOrderForWorkspace(...a),
  cancelOrderForWorkspace: (...a: unknown[]): unknown => cancelOrderForWorkspace(...a),
  fulfillOrderForWorkspace: (...a: unknown[]): unknown => fulfillOrderForWorkspace(...a),
  updateOrderNoteForWorkspace: (...a: unknown[]): unknown => updateOrderNoteForWorkspace(...a),
  updateOrderAddressForWorkspace: (...a: unknown[]): unknown => updateOrderAddressForWorkspace(...a),
}))
vi.mock('@/lib/services/shopify-analytics', () => ({
  getKPIs: (...a: unknown[]): unknown => getKPIs(...a),
  getRevenueTrend: (...a: unknown[]): unknown => getRevenueTrend(...a),
}))

import { registerShopifyTools } from '@/mcp/tools/shopify'
import type { McpToolContext } from '@/mcp/types'

interface Reg {
  handler: (a: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>
}
function fakeServer() {
  const tools: Record<string, Reg> = {}
  return {
    server: {
      registerTool: (n: string, _c: unknown, h: Reg['handler']) => {
        tools[n] = { handler: h }
      },
      tool: (n: string, _s: unknown, h: Reg['handler']) => {
        tools[n] = { handler: h }
      },
    },
    tools,
  }
}

const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'agent' }

beforeEach(() => {
  listStores.mockReset()
  listOrdersForWorkspace.mockReset()
  getOrderForWorkspace.mockReset()
  lookupCustomerForWorkspace.mockReset()
  getKPIs.mockReset()
  getRevenueTrend.mockReset()
  refundOrderForWorkspace.mockReset()
  cancelOrderForWorkspace.mockReset()
  fulfillOrderForWorkspace.mockReset()
  updateOrderNoteForWorkspace.mockReset()
  updateOrderAddressForWorkspace.mockReset()
})

describe('registerShopifyTools', () => {
  it('registers all tools (6 read + 5 order actions)', () => {
    const { server, tools } = fakeServer()
    registerShopifyTools(server as never, ctx)
    expect(tools.list_stores).toBeDefined()
    expect(tools.list_orders).toBeDefined()
    expect(tools.get_order).toBeDefined()
    expect(tools.lookup_order).toBeDefined()
    expect(tools.get_kpis).toBeDefined()
    expect(tools.get_revenue_trend).toBeDefined()
    expect(tools.refund_order).toBeDefined()
    expect(tools.cancel_order).toBeDefined()
    expect(tools.fulfill_order).toBeDefined()
    expect(tools.update_order_note).toBeDefined()
    expect(tools.update_order_address).toBeDefined()
  })

  it('list_orders calls listOrdersForWorkspace with workspace and opts', async () => {
    const { server, tools } = fakeServer()
    listOrdersForWorkspace.mockResolvedValue([{ id: '123' }])
    registerShopifyTools(server as never, ctx)
    await tools.list_orders.handler({ storeId: 'store1', limit: 10 })
    expect(listOrdersForWorkspace).toHaveBeenCalledWith('w1', { storeId: 'store1', limit: 10 })
  })

  it('get_kpis calls getKPIs with workspace, date range, and storeId', async () => {
    const { server, tools } = fakeServer()
    getKPIs.mockResolvedValue({ totalOrders: 5 })
    registerShopifyTools(server as never, ctx)
    await tools.get_kpis.handler({ from: '2026-01-01', to: '2026-01-31', storeId: 'store1' })
    expect(getKPIs).toHaveBeenCalledWith('w1', { from: '2026-01-01', to: '2026-01-31' }, 'store1')
  })

  it('lookup_order calls lookupCustomerForWorkspace with email', async () => {
    const { server, tools } = fakeServer()
    lookupCustomerForWorkspace.mockResolvedValue({ email: 'test@example.com' })
    registerShopifyTools(server as never, ctx)
    await tools.lookup_order.handler({ email: 'test@example.com' })
    expect(lookupCustomerForWorkspace).toHaveBeenCalledWith('w1', { email: 'test@example.com', order: undefined }, { storeId: undefined })
  })

  it('lookup_order returns isError when no email or order provided', async () => {
    const { server, tools } = fakeServer()
    registerShopifyTools(server as never, ctx)
    const r = await tools.lookup_order.handler({})
    expect(r.isError).toBe(true)
  })

  it('order-action tools return isError when observer role (no permission)', async () => {
    const { server, tools } = fakeServer()
    const observerCtx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'observer' }
    registerShopifyTools(server as never, observerCtx)
    const refundRes = await tools.refund_order.handler({ orderId: '123' })
    expect(refundRes.isError).toBe(true)
    expect(refundOrderForWorkspace).not.toHaveBeenCalled()
  })

  it('refund_order (agent) calls refundOrderForWorkspace with workspace, orderId, and params', async () => {
    const { server, tools } = fakeServer()
    refundOrderForWorkspace.mockResolvedValue({ refund: { id: 1 } })
    registerShopifyTools(server as never, ctx)
    await tools.refund_order.handler({ orderId: '123', customAmount: '10', reason: 'x' })
    expect(refundOrderForWorkspace).toHaveBeenCalledWith('w1', '123', { customAmount: '10', reason: 'x' })
  })

  it('cancel_order (agent) calls cancelOrderForWorkspace with storeId in params', async () => {
    const { server, tools } = fakeServer()
    cancelOrderForWorkspace.mockResolvedValue({ ok: true })
    registerShopifyTools(server as never, ctx)
    await tools.cancel_order.handler({ orderId: '123', storeId: 's1', reason: 'fraud' })
    expect(cancelOrderForWorkspace).toHaveBeenCalledWith('w1', '123', { storeId: 's1', reason: 'fraud' })
  })

  it('fulfill_order (agent) calls fulfillOrderForWorkspace', async () => {
    const { server, tools } = fakeServer()
    fulfillOrderForWorkspace.mockResolvedValue({ fulfillment: { id: 1 } })
    registerShopifyTools(server as never, ctx)
    await tools.fulfill_order.handler({ orderId: '123', trackingNumber: 'track123' })
    expect(fulfillOrderForWorkspace).toHaveBeenCalledWith('w1', '123', { trackingNumber: 'track123' })
  })

  it('update_order_note (agent) calls updateOrderNoteForWorkspace', async () => {
    const { server, tools } = fakeServer()
    updateOrderNoteForWorkspace.mockResolvedValue({ ok: true })
    registerShopifyTools(server as never, ctx)
    await tools.update_order_note.handler({ orderId: '123', note: 'hi' })
    expect(updateOrderNoteForWorkspace).toHaveBeenCalledWith('w1', '123', { note: 'hi' })
  })

  it('update_order_address (agent) calls updateOrderAddressForWorkspace', async () => {
    const { server, tools } = fakeServer()
    updateOrderAddressForWorkspace.mockResolvedValue({ ok: true })
    registerShopifyTools(server as never, ctx)
    await tools.update_order_address.handler({ orderId: '123', firstName: 'John', city: 'NYC' })
    expect(updateOrderAddressForWorkspace).toHaveBeenCalledWith('w1', '123', { firstName: 'John', city: 'NYC' })
  })
})
