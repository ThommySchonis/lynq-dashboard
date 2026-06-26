import { describe, it, expect, vi, beforeEach } from 'vitest'

const listStores = vi.fn()
const listOrdersForWorkspace = vi.fn()
const getOrderForWorkspace = vi.fn()
const lookupCustomerForWorkspace = vi.fn()
const getKPIs = vi.fn()
const getRevenueTrend = vi.fn()

vi.mock('@/lib/services/stores', () => ({
  listStores: (...a: unknown[]): unknown => listStores(...a),
}))
vi.mock('@/lib/services/mcp-shopify', () => ({
  listOrdersForWorkspace: (...a: unknown[]): unknown => listOrdersForWorkspace(...a),
  getOrderForWorkspace: (...a: unknown[]): unknown => getOrderForWorkspace(...a),
  lookupCustomerForWorkspace: (...a: unknown[]): unknown => lookupCustomerForWorkspace(...a),
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
})

describe('registerShopifyTools', () => {
  it('registers all six tools', () => {
    const { server, tools } = fakeServer()
    registerShopifyTools(server as never, ctx)
    expect(tools.list_stores).toBeDefined()
    expect(tools.list_orders).toBeDefined()
    expect(tools.get_order).toBeDefined()
    expect(tools.lookup_order).toBeDefined()
    expect(tools.get_kpis).toBeDefined()
    expect(tools.get_revenue_trend).toBeDefined()
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
})
