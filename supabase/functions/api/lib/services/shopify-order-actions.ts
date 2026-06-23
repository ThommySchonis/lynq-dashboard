import { logger } from "../logger.ts";
import { resilientFetch } from "../resilient-fetch.ts";
import { SHOPIFY_API_VERSION, shopifyFetchJSON } from "./shopify-core.ts";
import type {
  CancelOrderParams,
  CreateRefundParams,
  DuplicateOrderParams,
  EditOrderParams,
  FulfillOrderParams,
  RefundLineItemInput,
  ShopifyCancelResponse,
  ShopifyDraftOrderResponse,
  ShopifyEditCommitResponse,
  ShopifyEditResponse,
  ShopifyFulfillmentOrdersResponse,
  ShopifyFulfillmentResponse,
  ShopifyRefundCalcResponse,
  ShopifyRefundResponse,
  ShopifyCredentials,
  ShopifySingleOrderResponse,
  ShopifyTransactionsResponse,
  ShopifyUpdateAddressResponse,
  UpdateAddressInput,
  UpdateOrderNoteFields,
} from "./shopify-types.ts";

export async function createRefund(credentials: ShopifyCredentials, orderId: string | number, params: CreateRefundParams) {
  const { lineItems, restock, notify, reason, shipping, customAmount } = params;

  if (customAmount && Number(customAmount) > 0) {
    const txData = await shopifyFetchJSON<ShopifyTransactionsResponse>(credentials, `/orders/${orderId}/transactions.json`);
    const originalTx = (txData.transactions || []).find((t) => t.kind === "capture" || t.kind === "sale" || t.kind === "authorization");

    const transaction = originalTx
      ? { parent_id: originalTx.id, kind: "refund", gateway: originalTx.gateway, currency: originalTx.currency, amount: String(Number(customAmount).toFixed(2)) }
      : { kind: "refund", amount: String(Number(customAmount).toFixed(2)) };

    const refundData = await shopifyFetchJSON<ShopifyRefundResponse>(credentials, `/orders/${orderId}/refunds.json`, {
      method: "POST",
      body: JSON.stringify({
        refund: { notify: notify !== false, note: reason || "", transactions: [transaction] },
      }),
    });
    return refundData.refund;
  }

  const refundLineItems = (lineItems || []).map((item: RefundLineItemInput) => ({
    line_item_id: item.lineItemId,
    quantity: item.quantity,
    restock_type: restock ? "return" : "no_restock",
  }));

  const calcData = await shopifyFetchJSON<ShopifyRefundCalcResponse>(credentials, `/orders/${orderId}/refunds/calculate.json`, {
    method: "POST",
    body: JSON.stringify({
      refund: { shipping: { full_refund: !!shipping }, refund_line_items: refundLineItems },
    }),
  });

  const transactions = (calcData.refund?.transactions || []).map((t) => ({
    parent_id: t.parent_id,
    amount: t.amount,
    kind: "refund",
    gateway: t.gateway,
    currency: t.currency,
  }));

  const refundData = await shopifyFetchJSON<ShopifyRefundResponse>(credentials, `/orders/${orderId}/refunds.json`, {
    method: "POST",
    body: JSON.stringify({
      refund: {
        notify: notify !== false,
        note: reason || "",
        shipping: { full_refund: !!shipping },
        refund_line_items: refundLineItems,
        transactions,
      },
    }),
  });
  return refundData.refund;
}

export async function cancelOrder(credentials: ShopifyCredentials, orderId: string | number, params: CancelOrderParams) {
  const { reason, restock, refund, notify } = params;

  const body: Record<string, unknown> = {
    reason: reason || "customer",
    restock: restock !== false,
    email: notify !== false,
  };

  if (refund) {
    body.refund = { shipping: { full_refund: true }, refund_line_items: [] };
  }

  const data = await shopifyFetchJSON<ShopifyCancelResponse>(credentials, `/orders/${orderId}/cancel.json`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return { id: data.order?.id, cancelReason: data.order?.cancel_reason };
}

export async function editOrder(credentials: ShopifyCredentials, orderId: string | number, params: EditOrderParams) {
  const { lineItems, reason, notify } = params;

  const beginData = await shopifyFetchJSON<ShopifyEditResponse>(credentials, `/orders/${orderId}/edits.json`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const editId = beginData.order_edit?.id;
  if (!editId) throw new Error("No edit session returned from Shopify");

  for (const item of lineItems || []) {
    const setRes = await resilientFetch<Record<string, unknown>>(
      "shopify",
      `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/order_edits/${editId}/line_items/${item.lineItemId}/set_quantity.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": credentials.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: item.quantity, restock: true }),
      },
    );
    if (!setRes.ok) {
      logger.error("[shopify]", "set_quantity failed", { error: setRes.error });
    }
  }

  const commitData = await shopifyFetchJSON<ShopifyEditCommitResponse>(credentials, `/order_edits/${editId}/commit.json`, {
    method: "POST",
    body: JSON.stringify({
      order_edit: {
        notify_customer: notify !== false,
        staff_note: reason || "Order updated via support agent",
      },
    }),
  });

  return commitData.order_edit;
}

export async function duplicateOrder(credentials: ShopifyCredentials, orderId: string | number, params: DuplicateOrderParams = {}) {
  const { keepAddress, note, tags, discountType, discountValue, applyDiscount } = params;

  const { order } = await shopifyFetchJSON<ShopifySingleOrderResponse>(credentials, `/orders/${orderId}.json`);

  const lineItems = (order.line_items || [])
    .map((item) => {
      const base: Record<string, unknown> = { variant_id: item.variant_id, quantity: item.quantity };
      if (applyDiscount && item.discount_allocations?.length) {
        base.applied_discount = {
          value: item.discount_allocations[0]?.amount,
          value_type: "fixed_amount",
          title: "Duplicated discount",
        };
      }
      return base;
    })
    .filter((item) => item.variant_id);

  const draftOrder: Record<string, unknown> = {
    line_items: lineItems,
    customer: order.customer ? { id: order.customer.id } : undefined,
    note: note || `Duplicate of ${order.name}`,
    tags: tags || order.tags,
  };

  if (discountType && discountValue && Number(discountValue) > 0) {
    draftOrder.applied_discount = {
      description: "Discount",
      value_type: discountType === "percentage" ? "percentage" : "fixed_amount",
      value: String(discountValue),
      title: discountType === "percentage" ? `${discountValue}% discount` : `€${discountValue} discount`,
    };
  }

  if (keepAddress !== false && order.shipping_address) {
    draftOrder.shipping_address = order.shipping_address;
  }

  const data = await shopifyFetchJSON<ShopifyDraftOrderResponse>(credentials, "/draft_orders.json", {
    method: "POST",
    body: JSON.stringify({ draft_order: draftOrder }),
  });

  return {
    id: data.draft_order?.id,
    name: data.draft_order?.name,
    invoiceUrl: data.draft_order?.invoice_url,
  };
}

export async function updateOrderNote(credentials: ShopifyCredentials, orderId: string | number, fields: UpdateOrderNoteFields) {
  const body: { order: Record<string, unknown> } = { order: { id: Number(orderId) } };
  if (fields.note !== undefined) body.order.note = fields.note;
  if (fields.tags !== undefined) body.order.tags = fields.tags;

  await shopifyFetchJSON(credentials, `/orders/${orderId}.json`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function updateOrderAddress(credentials: ShopifyCredentials, orderId: string | number, address: UpdateAddressInput) {
  const data = await shopifyFetchJSON<ShopifyUpdateAddressResponse>(credentials, `/orders/${orderId}.json`, {
    method: "PUT",
    body: JSON.stringify({
      order: {
        id: orderId,
        shipping_address: {
          first_name: address.firstName,
          last_name: address.lastName,
          address1: address.address1,
          address2: address.address2 || "",
          city: address.city,
          zip: address.zip,
          country: address.country || "",
          country_code: address.countryCode || "",
          phone: address.phone || "",
        },
      },
    }),
  });

  return data.order?.shipping_address;
}

export async function fulfillOrder(credentials: ShopifyCredentials, orderId: string | number, params: FulfillOrderParams = {}) {
  const { trackingNumber, trackingCompany, trackingUrl, notify } = params;

  const foData = await shopifyFetchJSON<ShopifyFulfillmentOrdersResponse>(credentials, `/orders/${orderId}/fulfillment_orders.json`);
  const open = (foData.fulfillment_orders || []).filter((fo) => fo.status === "open" || fo.status === "in_progress");
  if (!open.length) throw new Error("No open fulfillment found");

  const body = {
    fulfillment: {
      line_items_by_fulfillment_order: open.map((fo) => ({ fulfillment_order_id: fo.id })),
      notify_customer: notify !== false,
      tracking_info: trackingNumber
        ? {
            number: trackingNumber,
            company: trackingCompany || "",
            url: trackingUrl || "",
          }
        : undefined,
    },
  };

  const data = await shopifyFetchJSON<ShopifyFulfillmentResponse>(credentials, "/fulfillments.json", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return { id: data.fulfillment?.id, status: data.fulfillment?.status };
}
