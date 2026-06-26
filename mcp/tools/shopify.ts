import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listStores } from '@/lib/services/stores'
import { listOrdersForWorkspace, getOrderForWorkspace, lookupCustomerForWorkspace, refundOrderForWorkspace, cancelOrderForWorkspace, fulfillOrderForWorkspace, updateOrderNoteForWorkspace, updateOrderAddressForWorkspace } from '@/lib/services/mcp-shopify'
import { getKPIs, getRevenueTrend } from '@/lib/services/shopify-analytics'
import { ok, fail } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'
import { can } from '@/lib/permissions'

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

  server.registerTool(
    'refund_order',
    { description: 'Refund a Shopify order. customAmount is the refund amount; restock returns items to inventory; notify emails the customer. CAUTION: moves real money.', inputSchema: { orderId: z.string(), storeId: z.string().optional(), customAmount: z.union([z.string(), z.number()]).optional(), reason: z.string().optional(), restock: z.boolean().optional(), shipping: z.boolean().optional(), notify: z.boolean().optional() } },
    async (a: { orderId: string; storeId?: string; customAmount?: string | number; reason?: string; restock?: boolean; shipping?: boolean; notify?: boolean }) => {
      if (!can.manageOrders(ctx.role)) return fail('Your role cannot perform order actions.')
      const { orderId, ...params } = a
      try { return ok(await refundOrderForWorkspace(ctx.workspaceId, orderId, params)) } catch (e) { return fail(`refund_order failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
    },
  )

  server.registerTool(
    'cancel_order',
    { description: 'Cancel a Shopify order. refund=true also refunds; restock returns items; notify emails the customer.', inputSchema: { orderId: z.string(), storeId: z.string().optional(), reason: z.string().optional(), restock: z.boolean().optional(), refund: z.boolean().optional(), notify: z.boolean().optional() } },
    async (a: { orderId: string; storeId?: string; reason?: string; restock?: boolean; refund?: boolean; notify?: boolean }) => {
      if (!can.manageOrders(ctx.role)) return fail('Your role cannot perform order actions.')
      const { orderId, ...params } = a
      try { return ok(await cancelOrderForWorkspace(ctx.workspaceId, orderId, params)) } catch (e) { return fail(`cancel_order failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
    },
  )

  server.registerTool(
    'fulfill_order',
    { description: 'Mark a Shopify order fulfilled, optionally with tracking. notify emails the customer.', inputSchema: { orderId: z.string(), storeId: z.string().optional(), trackingNumber: z.string().optional(), trackingCompany: z.string().optional(), trackingUrl: z.string().optional(), notify: z.boolean().optional() } },
    async (a: { orderId: string; storeId?: string; trackingNumber?: string; trackingCompany?: string; trackingUrl?: string; notify?: boolean }) => {
      if (!can.manageOrders(ctx.role)) return fail('Your role cannot perform order actions.')
      const { orderId, ...params } = a
      try { return ok(await fulfillOrderForWorkspace(ctx.workspaceId, orderId, params)) } catch (e) { return fail(`fulfill_order failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
    },
  )

  server.registerTool(
    'update_order_note',
    { description: 'Update a Shopify order\'s note and/or tags (tags is a comma-separated string).', inputSchema: { orderId: z.string(), storeId: z.string().optional(), note: z.string().optional(), tags: z.string().optional() } },
    async (a: { orderId: string; storeId?: string; note?: string; tags?: string }) => {
      if (!can.manageOrders(ctx.role)) return fail('Your role cannot perform order actions.')
      const { orderId, ...params } = a
      try { return ok(await updateOrderNoteForWorkspace(ctx.workspaceId, orderId, params)) } catch (e) { return fail(`update_order_note failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
    },
  )

  server.registerTool(
    'update_order_address',
    { description: 'Update the shipping address on a Shopify order. IMPORTANT: this REPLACES the whole address — any field you omit is cleared. Read the order first (get_order) and pass ALL current address fields plus your changes, not just the field you want to change.', inputSchema: { orderId: z.string(), storeId: z.string().optional(), firstName: z.string().optional(), lastName: z.string().optional(), address1: z.string().optional(), address2: z.string().optional(), city: z.string().optional(), zip: z.string().optional(), country: z.string().optional(), countryCode: z.string().optional(), phone: z.string().optional() } },
    async (a: { orderId: string; storeId?: string; firstName?: string; lastName?: string; address1?: string; address2?: string; city?: string; zip?: string; country?: string; countryCode?: string; phone?: string }) => {
      if (!can.manageOrders(ctx.role)) return fail('Your role cannot perform order actions.')
      const { orderId, ...params } = a
      try { return ok(await updateOrderAddressForWorkspace(ctx.workspaceId, orderId, params)) } catch (e) { return fail(`update_order_address failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
    },
  )
}
