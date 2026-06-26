import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listStores } from '@/lib/services/stores'
import { listOrdersForWorkspace, getOrderForWorkspace, lookupCustomerForWorkspace } from '@/lib/services/mcp-shopify'
import { getKPIs, getRevenueTrend } from '@/lib/services/shopify-analytics'
import { ok, fail } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'

// Default the date range to the last 30 days when the caller omits it.
function defaultRange(from?: string, to?: string): { from: string; to: string } {
  const end = to ?? new Date().toISOString().slice(0, 10)
  const start = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { from: start, to: end }
}

export function registerShopifyTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'list_stores',
    { description: 'List the Shopify stores connected to this workspace (id + name). Use a store id with the order/analytics tools when there is more than one.', inputSchema: {} },
    async () => {
      try {
        return ok(await listStores(ctx.workspaceId))
      } catch (e) {
        return fail(`list_stores failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'list_orders',
    { description: 'List recent Shopify orders for a store (defaults to the workspace\'s first store).', inputSchema: { storeId: z.string().optional(), limit: z.number().int().min(1).max(100).optional() } },
    async (a: { storeId?: string; limit?: number }) => {
      try {
        return ok(await listOrdersForWorkspace(ctx.workspaceId, a))
      } catch (e) {
        return fail(`list_orders failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'get_order',
    { description: 'Get full detail for one Shopify order by id (line items, fulfillments, refunds, addresses).', inputSchema: { orderId: z.string(), storeId: z.string().optional() } },
    async (a: { orderId: string; storeId?: string }) => {
      try {
        return ok(await getOrderForWorkspace(ctx.workspaceId, a.orderId, { storeId: a.storeId }))
      } catch (e) {
        return fail(`get_order failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'lookup_order',
    { description: 'Look up a customer and their orders by email or order number.', inputSchema: { email: z.string().optional(), order: z.string().optional(), storeId: z.string().optional() } },
    async (a: { email?: string; order?: string; storeId?: string }) => {
      if (!a.email && !a.order) return fail('Provide an email or an order number.')
      try {
        return ok(await lookupCustomerForWorkspace(ctx.workspaceId, { email: a.email, order: a.order }, { storeId: a.storeId }))
      } catch (e) {
        return fail(`lookup_order failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'get_kpis',
    { description: 'Get store KPIs (orders, revenue, refunds/refund rate) for a date range (defaults to the last 30 days). Dates are YYYY-MM-DD.', inputSchema: { from: z.string().optional(), to: z.string().optional(), storeId: z.string().optional() } },
    async (a: { from?: string; to?: string; storeId?: string }) => {
      try {
        return ok(await getKPIs(ctx.workspaceId, defaultRange(a.from, a.to), a.storeId))
      } catch (e) {
        return fail(`get_kpis failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'get_revenue_trend',
    { description: 'Get daily revenue for a date range (defaults to the last 30 days). Dates are YYYY-MM-DD.', inputSchema: { from: z.string().optional(), to: z.string().optional(), storeId: z.string().optional() } },
    async (a: { from?: string; to?: string; storeId?: string }) => {
      try {
        return ok(await getRevenueTrend(ctx.workspaceId, defaultRange(a.from, a.to), a.storeId))
      } catch (e) {
        return fail(`get_revenue_trend failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
}
