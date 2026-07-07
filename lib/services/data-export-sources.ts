// lib/services/data-export-sources.ts
//
// Resolves the raw inputs the export services need. This is the ONE place that
// branches demo-vs-live and touches the Shopify API / RPCs, so both the CSV and
// PDF services share identical data and demo behaviour.

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getRefunds, getOrdersWithLineItems } from '@/lib/services/shopify-orders'
import { DEMO_SHOP, DEMO_KPIS, DEMO_TREND, DEMO_REFUNDS, DEMO_ORDERS } from '@/lib/demoData'
import type { ShopifyCredentials } from '@/lib/services/shopify-types'
import type {
  AnalyticsInputs,
  ExportKPI,
  ExportTrendPoint,
  OrderWithLineItems,
  RefundRecord,
} from '@/lib/services/data-export.types'

interface DateRange {
  from: string
  to: string
}

interface AnalyticsParams {
  workspaceId: string
  storeId: string
  credentials: ShopifyCredentials
  range: DateRange
}

interface OrdersParams {
  credentials: ShopifyCredentials
  range: DateRange
}

function isDemo(credentials: ShopifyCredentials): boolean {
  return credentials.domain === DEMO_SHOP
}

export async function resolveAnalyticsInputs(params: AnalyticsParams): Promise<AnalyticsInputs> {
  const { workspaceId, storeId, credentials, range } = params

  if (isDemo(credentials)) {
    return {
      kpi: DEMO_KPIS as ExportKPI,
      trend: DEMO_TREND as ExportTrendPoint[],
      refunds: DEMO_REFUNDS as RefundRecord[],
    }
  }

  const [kpiResult, trendResult, refunds] = await Promise.all([
    supabaseAdmin.rpc('get_kpis', {
      p_workspace_id: workspaceId,
      p_from: range.from,
      p_to: range.to,
      p_store_id: storeId,
    }),
    supabaseAdmin.rpc('get_revenue_trend', {
      p_workspace_id: workspaceId,
      p_from: range.from,
      p_to: range.to,
      p_store_id: storeId,
    }),
    getRefunds(credentials, range),
  ])

  if (kpiResult.error) throw new Error(`get_kpis RPC failed: ${kpiResult.error.message}`)
  if (trendResult.error) throw new Error(`get_revenue_trend RPC failed: ${trendResult.error.message}`)

  return {
    kpi: (kpiResult.data as ExportKPI) ?? ({} as ExportKPI),
    trend: (trendResult.data as ExportTrendPoint[]) ?? [],
    refunds: refunds as RefundRecord[],
  }
}

export async function resolveOrders(params: OrdersParams): Promise<OrderWithLineItems[]> {
  const { credentials, range } = params

  if (isDemo(credentials)) {
    const refundByOrder = new Map(DEMO_REFUNDS.map((r) => [r.orderId, r]))
    return DEMO_ORDERS.map((o) => {
      const refund = refundByOrder.get(o.name)
      return {
        orderNumber: o.name,
        createdAt: o.createdAt,
        customer: o.customer,
        customerEmail: refund?.customerEmail ?? null,
        financialStatus: o.financialStatus,
        fulfillmentStatus: o.fulfillmentStatus ?? 'unfulfilled',
        totalPrice: o.total,
        cancelReason: o.cancelReason,
        refundAmount: refund ? Number(refund.refundAmount) : 0,
        refundReason: refund?.reason ?? null,
        refundedAt: refund?.refundedAt ?? null,
        lineItems: [],
      }
    })
  }

  return getOrdersWithLineItems(credentials, range)
}
