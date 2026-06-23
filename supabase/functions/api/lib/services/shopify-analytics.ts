import { resilientFetch } from "../resilient-fetch.ts";
import { getAdminClient } from "../supabase.ts";
import { SHOPIFY_API_VERSION } from "./shopify-core.ts";
import type { KPIData, RevenueTrendRow, ShopifyCredentials } from "./shopify-types.ts";

export async function getKPIs(workspaceId: string, dateRange: { from: string; to: string }, storeId?: string) {
  const sb = getAdminClient();
  const rpcResult = await sb.rpc("get_kpis", {
    p_workspace_id: workspaceId,
    p_from: dateRange.from,
    p_to: dateRange.to,
    p_store_id: storeId || null,
  });

  if (rpcResult.error) throw new Error(`get_kpis RPC failed: ${rpcResult.error.message}`);

  const d = rpcResult.data as KPIData;
  const totalOrders = d.totalOrders || 0;
  const totalRefunds = d.totalRefunds || 0;
  const netRevenue = d.netRevenue || 0;
  const returns = d.returns || 0;

  const refundRate = totalOrders > 0 ? ((totalRefunds / totalOrders) * 100).toFixed(1) : "0.0";
  const refundPct = netRevenue > 0 ? ((returns / netRevenue) * 100).toFixed(1) : "0.0";

  return {
    totalOrders,
    cancelledOrders: d.cancelledOrders || 0,
    totalRefunds,
    refundRate,
    refundPct,
    netRevenue: Math.round(netRevenue).toString(),
    totalRevenue: Math.round(netRevenue).toString(),
    discounts: Math.round(d.discounts || 0).toString(),
    returns: Math.round(returns).toString(),
    refundAmount: Math.round(returns).toString(),
  };
}

export async function getRevenueTrend(workspaceId: string, dateRange: { from: string; to: string }, storeId?: string) {
  if (!dateRange.from || !dateRange.to) return [];

  const sb = getAdminClient();
  const trendResult = await sb.rpc("get_revenue_trend", {
    p_workspace_id: workspaceId,
    p_from: dateRange.from,
    p_to: dateRange.to,
    p_store_id: storeId || null,
  });

  if (trendResult.error) throw new Error(`get_revenue_trend RPC failed: ${trendResult.error.message}`);

  return ((trendResult.data as RevenueTrendRow[]) || []).map((row) => ({
    date: row.date,
    revenue: Math.max(0, Number(row.revenue) || 0),
  }));
}

export async function checkConnectionStatus(workspaceId: string) {
  const sb = getAdminClient();
  const { data: integrationRow } = await sb
    .from("integrations")
    .select("shopify_domain")
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ shopify_domain?: string }>();

  if (integrationRow?.shopify_domain) {
    return { connected: true, shop: integrationRow.shopify_domain };
  }
  return { connected: false };
}

export async function getAnalytics(credentials: ShopifyCredentials, dateRange: { from: string; to: string }) {
  const query = `
    FROM orders
    SHOW
      sum(net_sales) AS net_sales,
      sum(gross_sales) AS gross_sales,
      sum(discounts) AS discounts,
      sum(returns) AS returns,
      count(orders) AS total_orders
    SINCE ${dateRange.from} UNTIL ${dateRange.to}
  `;

  const gqlQuery = `
    mutation shopifyqlQuery($query: String!) {
      shopifyqlQuery(query: $query) {
        tableData {
          unformattedData {
            headers
            rowData
          }
        }
        parseErrors { code message }
      }
    }
  `;

  const res = await resilientFetch<unknown>("shopify", `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": credentials.accessToken,
    },
    body: JSON.stringify({ query: gqlQuery, variables: { query } }),
  });

  if (!res.ok) {
    return { status: res.status, raw: res.error };
  }
  return { status: res.status, raw: res.data };
}
