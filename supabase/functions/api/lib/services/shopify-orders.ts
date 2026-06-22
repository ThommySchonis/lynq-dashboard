import { resilientFetch } from "../resilient-fetch.ts";
import { getAdminClient } from "../supabase.ts";
import { SHOPIFY_API_VERSION, shopifyFetchJSON, shopifyPaginatedFetch } from "./shopify-core.ts";
import type {
  PaginatedResult,
  ShopifyCredentials,
  ShopifyCustomerRef,
  ShopifyCustomersResponse,
  ShopifyOrder,
  ShopifyOrdersResponse,
  ShopifyShopResponse,
  ShopifySingleCustomerResponse,
  ShopifySingleOrderResponse,
} from "./shopify-types.ts";

export async function getOrders(credentials: ShopifyCredentials, options: { limit?: number } = {}) {
  const limit = options.limit || 50;
  const data = await shopifyFetchJSON<ShopifyOrdersResponse>(credentials, `/orders.json?status=any&limit=${limit}`);

  return (data.orders || []).map((o) => ({
    id: o.id,
    name: o.name,
    customer: o.customer ? `${o.customer.first_name} ${o.customer.last_name}`.trim() : "Unknown",
    total: parseFloat(o.total_price || "0").toFixed(2),
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || "unfulfilled",
    cancelReason: o.cancel_reason || null,
    hasRefund: o.refunds != null && o.refunds.length > 0,
    createdAt: o.created_at,
  }));
}

export async function getOrderDetail(credentials: ShopifyCredentials, orderId: string | number) {
  const { order } = await shopifyFetchJSON<ShopifySingleOrderResponse>(credentials, `/orders/${orderId}.json`);

  return {
    id: order.id,
    name: order.name,
    createdAt: order.created_at,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status || "unfulfilled",
    cancelReason: order.cancel_reason,
    cancelledAt: order.cancelled_at,
    customer: order.customer
      ? {
          id: order.customer.id,
          firstName: order.customer.first_name,
          lastName: order.customer.last_name,
          email: order.customer.email,
          phone: order.customer.phone,
          ordersCount: order.customer.orders_count,
          totalSpent: order.customer.total_spent,
        }
      : null,
    shippingAddress: order.shipping_address || null,
    billingAddress: order.billing_address || null,
    lineItems: (order.line_items || []).map((item) => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      total: (parseFloat(item.price) * item.quantity).toFixed(2),
    })),
    subtotalPrice: order.subtotal_price,
    totalShippingPrice: order.total_shipping_price_set?.shop_money?.amount || "0.00",
    totalTax: order.total_tax,
    totalPrice: order.total_price,
    currency: order.currency,
    refunds: order.refunds || [],
    fulfillments: (order.fulfillments || []).map((f) => ({
      id: f.id,
      status: f.status,
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      trackingCompany: f.tracking_company,
    })),
    tags: order.tags,
    note: order.note,
  };
}

export async function getRefunds(credentials: ShopifyCredentials, dateRange: { from: string; to: string }) {
  const from = dateRange.from;
  const to = dateRange.to;

  let nextUrl: string | null = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`;
  if (from) nextUrl += `&updated_at_min=${from}T00:00:00`;
  if (to) nextUrl += `&updated_at_max=${to}T23:59:59`;

  const allOrders: ShopifyOrder[] = [];

  while (nextUrl) {
    const page: PaginatedResult<ShopifyOrdersResponse> = await shopifyPaginatedFetch<ShopifyOrdersResponse>(credentials, nextUrl);
    allOrders.push(...(page.data.orders || []));
    nextUrl = page.nextUrl;
  }

  const fromTs = from ? `${from}T00:00:00` : null;
  const toTs = to ? `${to}T23:59:59` : null;

  return allOrders
    .filter((o) => o.refunds && o.refunds.length > 0)
    .flatMap((o) => {
      const orderTotal = parseFloat(o.total_price_set?.presentment_money?.amount || o.total_price || "0");

      const inRange = (o.refunds || []).filter((r) => {
        if (!fromTs && !toTs) return true;
        if (fromTs && r.created_at < fromTs) return false;
        if (toTs && r.created_at > toTs) return false;
        return true;
      });

      if (inRange.length === 0) return [];

      const refundTotal = inRange.reduce(
        (sum, r) => sum + (r.transactions || []).reduce((ts, t) => ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || "0"), 0),
        0,
      );

      if (refundTotal <= 0) return [];

      const items = inRange.flatMap((r) => r.refund_line_items || []);
      const productNames = [...new Set(items.map((i) => i.line_item?.title).filter(Boolean))];
      const refundNote = inRange
        .map((r) => r.note)
        .filter(Boolean)
        .join("; ");
      const reason = refundNote || o.cancel_reason || null;
      const refundedAt = inRange
        .map((r) => r.created_at)
        .sort()
        .at(-1);

      return [
        {
          orderId: o.name,
          orderIdNumeric: o.id,
          customer: o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() || "Unknown" : o.email || "Unknown",
          customerEmail: o.customer?.email || o.email || null,
          refundAmount: refundTotal.toFixed(2),
          orderTotal: orderTotal.toFixed(2),
          refundPct: orderTotal > 0 ? ((refundTotal / orderTotal) * 100).toFixed(1) : "0.0",
          itemCount: items.reduce((s, i) => s + (i.quantity || 0), 0),
          products: productNames,
          reason,
          refundedAt,
        },
      ];
    })
    .sort((a, b) => new Date(b.refundedAt ?? "").getTime() - new Date(a.refundedAt ?? "").getTime());
}

export async function getCustomer(credentials: ShopifyCredentials, query: { email?: string; order?: string }) {
  let customer: ShopifyCustomerRef | null = null;

  if (query.email) {
    const searchData = await shopifyFetchJSON<ShopifyCustomersResponse>(
      credentials,
      `/customers/search.json?query=email:${encodeURIComponent(query.email)}&limit=1`,
    );
    customer = searchData.customers?.[0] ?? null;
  } else if (query.order) {
    const orderName = query.order.replace(/^#/, "");
    const orderData = await shopifyFetchJSON<ShopifyOrdersResponse>(credentials, `/orders.json?name=${encodeURIComponent(orderName)}&status=any&limit=1`);
    const matchedOrder = orderData.orders?.[0];
    if (matchedOrder?.customer?.id) {
      const custData = await shopifyFetchJSON<ShopifySingleCustomerResponse>(credentials, `/customers/${matchedOrder.customer.id}.json`);
      customer = custData.customer ?? null;
    }
  }

  if (!customer) return { customer: null, orders: [] };

  const ordersData = await shopifyFetchJSON<ShopifyOrdersResponse>(credentials, `/orders.json?customer_id=${customer.id}&status=any&limit=50`);

  const orders = (ordersData.orders || []).map((o) => ({
    id: o.id,
    name: o.name,
    createdAt: o.created_at,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || "unfulfilled",
    cancelReason: o.cancel_reason,
    cancelledAt: o.cancelled_at || null,
    totalPrice: o.total_price,
    currency: o.currency,
    lineItems: (o.line_items || []).map((item) => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
    })),
    fulfillments: (o.fulfillments || []).map((f) => ({
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      trackingCompany: f.tracking_company,
      status: f.status,
    })),
    refunds: o.refunds || [],
    shippingAddress: o.shipping_address
      ? {
          firstName: o.shipping_address.first_name || "",
          lastName: o.shipping_address.last_name || "",
          address1: o.shipping_address.address1 || "",
          address2: o.shipping_address.address2 || "",
          city: o.shipping_address.city || "",
          zip: o.shipping_address.zip || "",
          country: o.shipping_address.country || "",
          countryCode: o.shipping_address.country_code || "",
          phone: o.shipping_address.phone || "",
        }
      : null,
  }));

  return {
    customer: {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      city: customer.default_address?.city,
      country: customer.default_address?.country,
      countryCode: customer.default_address?.country_code,
      defaultAddress: customer.default_address
        ? {
            firstName: customer.default_address.first_name,
            lastName: customer.default_address.last_name,
            address1: customer.default_address.address1,
            address2: customer.default_address.address2,
            city: customer.default_address.city,
            province: customer.default_address.province,
            country: customer.default_address.country,
            zip: customer.default_address.zip,
            phone: customer.default_address.phone,
          }
        : undefined,
      ordersCount: customer.orders_count,
      totalSpent: customer.total_spent,
      currency: customer.currency,
      tags: customer.tags,
      note: customer.note,
      createdAt: customer.created_at,
    },
    orders,
  };
}

export async function syncOrders(workspaceId: string, credentials: ShopifyCredentials, userId: string, options: { full?: boolean; storeId?: string } = {}) {
  const sb = getAdminClient();

  const shopRes = await resilientFetch<ShopifyShopResponse>("shopify", `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: { "X-Shopify-Access-Token": credentials.accessToken },
  });
  if (shopRes.ok) {
    const currency = shopRes.data.shop?.currency || "EUR";
    if (options.storeId) {
      await sb.from("integrations").update({ store_currency: currency }).eq("store_id", options.storeId).eq("workspace_id", workspaceId);
    } else {
      await sb.from("integrations").update({ store_currency: currency }).eq("workspace_id", workspaceId);
    }
  }

  const since = options.full ? "" : `&processed_at_min=${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}`;

  let orders: ShopifyOrder[] = [];
  let url: string | null = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250${since}`;

  while (url) {
    try {
      const page: PaginatedResult<ShopifyOrdersResponse> = await shopifyPaginatedFetch<ShopifyOrdersResponse>(credentials, url);
      orders = orders.concat(page.data.orders || []);
      url = page.nextUrl;
    } catch {
      break;
    }
  }

  const rows = orders.map((order) => {
    const subtotal = parseFloat(order.subtotal_price_set?.presentment_money?.amount || order.subtotal_price || "0");
    const totalPrice = parseFloat(order.total_price_set?.presentment_money?.amount || order.total_price || "0");
    const totalDiscounts = parseFloat(order.total_discounts_set?.presentment_money?.amount || order.total_discounts || "0");
    const refundAmount = (order.refunds || []).reduce(
      (sum, r) => sum + (r.transactions || []).reduce((ts, t) => ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || "0"), 0),
      0,
    );

    return {
      id: order.id,
      client_id: userId,
      workspace_id: workspaceId,
      order_number: order.name,
      financial_status: order.financial_status,
      cancel_reason: order.cancel_reason || null,
      subtotal_price: subtotal,
      total_price: totalPrice,
      total_discounts: totalDiscounts,
      refund_amount: refundAmount,
      presentment_currency: order.presentment_currency || order.currency || null,
      source_name: order.source_name || null,
      customer_email: order.customer?.email || order.email || null,
      customer_name: order.customer ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() : null,
      processed_at: order.processed_at,
      created_at_shopify: order.created_at,
      updated_at_shopify: order.updated_at,
      store_id: options.storeId || null,
      synced_at: new Date().toISOString(),
    };
  });

  for (let i = 0; i < rows.length; i += 100) {
    await sb.from("shopify_orders").upsert(rows.slice(i, i + 100), { onConflict: "workspace_id,id" });
  }

  return { synced: rows.length };
}
