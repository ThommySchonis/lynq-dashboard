import { logger } from "../logger.ts";
import { ShopifyApiError } from "./shopify-core.ts";
import { shopifyGraphQL } from "./shopify-graphql.ts";
import type {
  CancelOrderParams,
  CreateRefundParams,
  DuplicateOrderParams,
  EditOrderParams,
  FulfillOrderParams,
  RefundLineItemInput,
  ShopifyCredentials,
  UpdateAddressInput,
  UpdateOrderNoteFields,
} from "./shopify-types.ts";

// ── orderUpdate (GraphQL) shared shapes ───────────────────────────────────
// Shopify UserError: { field: string[] | null, message: string }. Shared by
// both mutations below.
interface GqlUserError {
  field: string[] | null;
  message: string;
}

function assertNoUserErrors(userErrors: GqlUserError[], mutationName = "orderUpdate"): void {
  if (userErrors.length > 0) {
    throw new ShopifyApiError(
      `${mutationName}: ${userErrors.map((e) => e.message).join("; ")}`,
      422,
      "graphql",
    );
  }
}

// REST cancel reason string -> OrderCancelReason GraphQL enum. Verified against
// https://shopify.dev/docs/api/admin-graphql/2025-04/enums/OrderCancelReason
// (CUSTOMER, DECLINED, FRAUD, INVENTORY, OTHER, STAFF).
const ORDER_CANCEL_REASONS: Record<string, string> = {
  customer: "CUSTOMER",
  declined: "DECLINED",
  fraud: "FRAUD",
  inventory: "INVENTORY",
  other: "OTHER",
  staff: "STAFF",
};

// Preserves REST's `reason || 'customer'` default. Unrecognized free-text
// reasons (only reachable via the MCP tool) fall back to OTHER — a valid enum —
// rather than triggering a GraphQL variable-coercion error.
function toOrderCancelReason(reason?: string): string {
  const key = (reason || "customer").toLowerCase().trim();
  return ORDER_CANCEL_REASONS[key] ?? "OTHER";
}

// ── refundCreate (GraphQL) shapes ─────────────────────────────────────────────
// Replaces the 3-call REST flow (GET /transactions.json, POST
// /refunds/calculate.json, POST /refunds.json). MONEY-CRITICAL — see the
// CURRENCY LEG note below.
//
// gid://shopify/Refund/999 -> 999 (REST exposed numeric ids, not global ids).
function refundLegacyIdNum(gid: string): number {
  const tail = gid.split("/").pop() ?? "";
  return Number(tail.split("?")[0]);
}

// REST restock_type ('return' | 'no_restock') -> RefundLineItemRestockType enum.
// Verified against https://shopify.dev/docs/api/admin-graphql/2025-04/enums/RefundLineItemRestockType
// RETURN = restock a fulfilled line item; NO_RESTOCK = do not return to inventory.
// The old REST flow only ever produced 'return'/'no_restock', so we map to the
// same two values (never CANCEL/LEGACY_RESTOCK) to preserve exact behavior.
function toRestockType(restock: boolean | undefined): "RETURN" | "NO_RESTOCK" {
  return restock ? "RETURN" : "NO_RESTOCK";
}

interface GqlMoney {
  amount: string;
  currencyCode?: string;
}
interface GqlMoneyBag {
  presentmentMoney: GqlMoney;
  shopMoney?: GqlMoney;
}
interface GqlSuggestedTransaction {
  parentTransaction: { id: string } | null;
  amountSet: GqlMoneyBag;
  gateway: string | null;
  kind: string;
}
interface GqlSuggestedRefundResponse {
  order: {
    suggestedRefund: {
      suggestedTransactions: GqlSuggestedTransaction[];
    } | null;
  } | null;
}
interface GqlOrderTransactionNode {
  id: string;
  kind: string;
  gateway: string | null;
  amountSet: GqlMoneyBag;
}
interface GqlOrderTransactionsResponse {
  order: { transactions: GqlOrderTransactionNode[] } | null;
}
interface GqlRefundNode {
  id: string;
  note: string | null;
  createdAt: string;
  totalRefundedSet: GqlMoneyBag;
}
interface GqlRefundCreateResponse {
  refundCreate: {
    refund: GqlRefundNode | null;
    userErrors: GqlUserError[];
  };
}

// OrderTransactionInput requires orderId (ID!), amount (Money!), gateway
// (String!), kind (OrderTransactionKind!); parentId (ID) is optional.
interface RefundTransactionInput {
  orderId: string;
  parentId?: string;
  amount: string;
  gateway: string;
  kind: "REFUND";
}

// suggestedRefund's shipping arg is `refundShipping: Boolean` (NOT the
// `shipping` object the refundCreate INPUT uses). refundLineItems reuses
// RefundLineItemInput ({ lineItemId, quantity, restockType }).
const ORDER_SUGGESTED_REFUND_QUERY = /* GraphQL */ `
  query OrderSuggestedRefund($orderId: ID!, $refundLineItems: [RefundLineItemInput!], $refundShipping: Boolean) {
    order(id: $orderId) {
      suggestedRefund(refundLineItems: $refundLineItems, refundShipping: $refundShipping) {
        suggestedTransactions {
          parentTransaction { id }
          amountSet {
            presentmentMoney { amount currencyCode }
            shopMoney { amount currencyCode }
          }
          gateway
          kind
        }
      }
    }
  }
`;

// Order.transactions is a plain list ([OrderTransaction!]!), not a connection.
const ORDER_TRANSACTIONS_QUERY = /* GraphQL */ `
  query OrderTransactions($orderId: ID!) {
    order(id: $orderId) {
      transactions(first: 50) {
        id
        kind
        gateway
        amountSet {
          presentmentMoney { amount currencyCode }
          shopMoney { amount currencyCode }
        }
      }
    }
  }
`;

const REFUND_CREATE_MUTATION = /* GraphQL */ `
  mutation RefundCreate($input: RefundInput!) {
    refundCreate(input: $input) {
      refund {
        id
        note
        createdAt
        totalRefundedSet {
          presentmentMoney { amount currencyCode }
          shopMoney { amount currencyCode }
        }
      }
      userErrors { field message }
    }
  }
`;

// Maps the created GraphQL refund back to a REST-ish shape. The only real
// consumers are the RefundModal (checks `refund` truthiness) and the MCP
// `refund_order` tool (serializes it as text) — so we surface numeric ids plus
// the presentment total for a human/AI to read. `amount`/`currency` come from
// the PRESENTMENT leg to match the old REST refund amounts.
function toRefundResult(refund: GqlRefundNode, orderId: string | number) {
  const presentment = refund.totalRefundedSet?.presentmentMoney;
  return {
    id: refundLegacyIdNum(refund.id),
    order_id: Number(orderId),
    note: refund.note,
    created_at: refund.createdAt,
    amount: presentment?.amount,
    currency: presentment?.currencyCode,
    total_refunded_set: refund.totalRefundedSet,
  };
}

/**
 * Create a refund on an order (custom amount or line-item based) via the
 * `refundCreate` GraphQL mutation. Replaces the 3-call REST flow.
 *
 * CURRENCY LEG (MONEY-CRITICAL): `OrderTransactionInput.amount` carries no
 * currency field, so the amount is denominated in the ORDER'S PRESENTMENT
 * CURRENCY (the currency the customer was charged in). This matches the old
 * REST calculate `transactions[].amount` and Shopify's own refund inputs
 * (`RefundShippingInput.shippingRefundAmount` is documented "in the presentment
 * currency of the order"). We therefore feed `amountSet.presentmentMoney.amount`
 * from suggestedRefund into each transaction. For single-currency stores the
 * presentment and shop legs are identical, so this only matters for
 * multi-currency orders — validate on a real multi-currency store.
 *
 * `RefundInput.currency` (required by Shopify when the order's currency
 * differs from its presentment currency) is set to that same presentment
 * `currencyCode` so it matches the transaction amounts above; omitted when
 * unresolvable (single-currency stores don't require it).
 *
 * PATH 1 (custom amount): query the order's transactions, find the
 * capture/sale/authorization parent, and refund `customAmount.toFixed(2)`
 * against it. Unlike REST (which fell back to a parentless refund transaction),
 * we THROW when no capturable transaction exists — GraphQL requires a gateway on
 * the transaction and a blind refund with no parent would silently move (or fail
 * to move) money. Fail loud.
 *
 * userErrors -> throws ShopifyApiError, same failure mode as the old non-2xx
 * REST response.
 */
export async function createRefund(credentials: ShopifyCredentials, orderId: string | number, params: CreateRefundParams) {
  const { lineItems, restock, notify, reason, shipping, customAmount } = params;
  const orderGid = `gid://shopify/Order/${orderId}`;

  // ── PATH 1: custom amount refund ────────────────────────────────────────────
  if (customAmount && Number(customAmount) > 0) {
    const txData = await shopifyGraphQL<GqlOrderTransactionsResponse>(credentials, ORDER_TRANSACTIONS_QUERY, {
      orderId: orderGid,
    });
    const originalTx = (txData.order?.transactions || []).find(
      (t) => t.kind === "CAPTURE" || t.kind === "SALE" || t.kind === "AUTHORIZATION",
    );
    if (!originalTx || !originalTx.gateway) {
      throw new ShopifyApiError(
        "refundCreate: no capturable (capture/sale/authorization) transaction found to refund against",
        422,
        "graphql",
      );
    }

    const transactions: RefundTransactionInput[] = [
      {
        orderId: orderGid,
        parentId: originalTx.id,
        amount: String(Number(customAmount).toFixed(2)),
        gateway: originalTx.gateway,
        kind: "REFUND",
      },
    ];

    // RefundInput.currency is required for multi-currency orders and must be
    // the PRESENTMENT currency code (the leg `amount` above is denominated
    // in) — sourced from the parent transaction we're refunding against.
    const presentmentCurrency = originalTx.amountSet.presentmentMoney.currencyCode;
    const refundInput: Record<string, unknown> = {
      orderId: orderGid,
      note: reason || "",
      notify: notify !== false,
      transactions,
    };
    if (presentmentCurrency) refundInput.currency = presentmentCurrency;

    const data = await shopifyGraphQL<GqlRefundCreateResponse>(credentials, REFUND_CREATE_MUTATION, {
      input: refundInput,
    });
    assertNoUserErrors(data.refundCreate.userErrors, "refundCreate");
    if (!data.refundCreate.refund) throw new ShopifyApiError("refundCreate returned no refund", 200, "graphql");
    return toRefundResult(data.refundCreate.refund, orderId);
  }

  // ── PATH 2: line-item based refund ──────────────────────────────────────────
  const refundLineItems = (lineItems || []).map((item: RefundLineItemInput) => ({
    lineItemId: `gid://shopify/LineItem/${item.lineItemId}`,
    quantity: item.quantity,
    restockType: toRestockType(restock),
  }));

  // Step (a): let suggestedRefund CALCULATE the amounts (replaces
  // /refunds/calculate.json). We do NOT hand-calculate money.
  const calcData = await shopifyGraphQL<GqlSuggestedRefundResponse>(credentials, ORDER_SUGGESTED_REFUND_QUERY, {
    orderId: orderGid,
    refundLineItems,
    refundShipping: !!shipping,
  });
  const suggested = calcData.order?.suggestedRefund;
  if (!suggested) throw new ShopifyApiError("refundCreate: order.suggestedRefund returned no suggestion", 422, "graphql");

  const suggestedTransactions = suggested.suggestedTransactions || [];
  const transactions: RefundTransactionInput[] = suggestedTransactions.map((t) => {
    if (!t.gateway) throw new ShopifyApiError("refundCreate: suggested transaction is missing a gateway", 422, "graphql");
    const tx: RefundTransactionInput = {
      orderId: orderGid,
      amount: t.amountSet.presentmentMoney.amount, // PRESENTMENT leg — see fn doc
      gateway: t.gateway,
      kind: "REFUND",
    };
    if (t.parentTransaction?.id) tx.parentId = t.parentTransaction.id;
    return tx;
  });

  // RefundInput.currency is required for multi-currency orders and must be
  // the PRESENTMENT currency code — sourced from the first suggested
  // transaction (all suggested transactions share the order's presentment
  // currency).
  const presentmentCurrency = suggestedTransactions[0]?.amountSet.presentmentMoney.currencyCode;
  const refundInput: Record<string, unknown> = {
    orderId: orderGid,
    note: reason || "",
    notify: notify !== false,
    refundLineItems,
    shipping: { fullRefund: !!shipping },
    transactions,
  };
  if (presentmentCurrency) refundInput.currency = presentmentCurrency;

  // Step (b): apply the refund with the suggested amounts.
  const data = await shopifyGraphQL<GqlRefundCreateResponse>(credentials, REFUND_CREATE_MUTATION, {
    input: refundInput,
  });
  assertNoUserErrors(data.refundCreate.userErrors, "refundCreate");
  if (!data.refundCreate.refund) throw new ShopifyApiError("refundCreate returned no refund", 200, "graphql");
  return toRefundResult(data.refundCreate.refund, orderId);
}

const ORDER_CANCEL_MUTATION = /* GraphQL */ `
  mutation OrderCancel($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean) {
    orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, notifyCustomer: $notifyCustomer) {
      job { id done }
      orderCancelUserErrors { field message }
    }
  }
`;

interface GqlOrderCancelResponse {
  orderCancel: {
    // orderCancel is asynchronous — it returns a job, not the cancelled order.
    job: { id: string; done: boolean } | null;
    orderCancelUserErrors: GqlUserError[];
  };
}

/**
 * Cancel an order via the `orderCancel` GraphQL mutation (replaces REST
 * `POST /orders/{id}/cancel.json`).
 *
 * The mutation is ASYNCHRONOUS: it returns a `job`, not the order, so we
 * synthesize the old REST `{ id, cancelReason }` return from the inputs. The
 * only caller that reads the result (the CancelModal) just needs a truthy
 * `order`; validation failures still surface synchronously via
 * `orderCancelUserErrors` before the job runs.
 *
 * BEHAVIOR DIFFERENCE vs REST: the old REST body requested a shipping-only
 * refund (`{ shipping: { full_refund: true }, refund_line_items: [] }`) when
 * `params.refund` was truthy. The GraphQL `refund: true` argument refunds the
 * WHOLE order (all line items + shipping). Requires real-store validation.
 */
export async function cancelOrder(credentials: ShopifyCredentials, orderId: string | number, params: CancelOrderParams) {
  const { reason, restock, refund, notify } = params;

  const data = await shopifyGraphQL<GqlOrderCancelResponse>(credentials, ORDER_CANCEL_MUTATION, {
    orderId: `gid://shopify/Order/${orderId}`,
    reason: toOrderCancelReason(reason),
    refund: !!refund,
    restock: restock !== false,
    notifyCustomer: notify !== false,
  });
  assertNoUserErrors(data.orderCancel.orderCancelUserErrors, "orderCancel");

  return { id: orderId, cancelReason: reason || "customer" };
}

// ── orderEdit (GraphQL) shapes ────────────────────────────────────────────────
// Replaces the 3-call REST flow (POST /orders/{id}/edits.json, POST
// /order_edits/{editId}/line_items/{lineItemId}/set_quantity.json, POST
// /order_edits/{editId}/commit.json) with orderEditBegin -> orderEditSetQuantity
// (per line) -> orderEditCommit. MONEY-ADJACENT — Shopify recalculates order
// totals on commit.
//
// THE CRITICAL MAPPING (original -> calculated line-item id): REST's set_quantity
// took the ORIGINAL order line-item id directly in its URL path. GraphQL
// `orderEditSetQuantity` requires the CalculatedLineItem id from the
// orderEditBegin result — passing the original LineItem id fails. CalculatedLineItem
// exposes NO field pointing back to its original LineItem (confirmed by Shopify
// staff on community.shopify.dev, thread 34692), BUT the CalculatedLineItem id
// numerically encodes the original: `gid://shopify/CalculatedLineItem/{originalLineItemId}`
// (verified against the official edit-orders guide, which shows
// `gid://shopify/CalculatedLineItem/151617`, + community threads). We therefore
// map by matching the caller's numeric line-item id against the numeric suffix of
// each CalculatedLineItem id ACTUALLY RETURNED by orderEditBegin (never
// blind-constructing a gid) — so a line item that isn't editable simply isn't
// found and is skipped, preserving REST's best-effort behavior.
interface GqlCalculatedLineItemNode {
  id: string;
  quantity: number;
}
interface GqlOrderEditBeginResponse {
  orderEditBegin: {
    calculatedOrder: {
      id: string;
      lineItems: { edges: { node: GqlCalculatedLineItemNode }[] };
    } | null;
    userErrors: GqlUserError[];
  };
}
interface GqlOrderEditSetQuantityResponse {
  orderEditSetQuantity: {
    calculatedOrder: { id: string } | null;
    userErrors: GqlUserError[];
  };
}
interface GqlOrderEditCommitResponse {
  orderEditCommit: {
    order: {
      id: string;
      name: string | null;
      totalPriceSet: GqlMoneyBag | null;
    } | null;
    userErrors: GqlUserError[];
  };
}

// orderEditBegin(id: ID!) -> OrderEditBeginPayload { calculatedOrder, userErrors }.
// lineItems(first:) verified: CalculatedOrder.lineItems is a
// CalculatedLineItemConnection. 250 matches the REST-era ceiling used elsewhere
// in this file.
const ORDER_EDIT_BEGIN_MUTATION = /* GraphQL */ `
  mutation OrderEditBegin($id: ID!) {
    orderEditBegin(id: $id) {
      calculatedOrder {
        id
        lineItems(first: 250) {
          edges { node { id quantity } }
        }
      }
      userErrors { field message }
    }
  }
`;

// orderEditSetQuantity(id: ID!, lineItemId: ID!, quantity: Int!, restock: Boolean)
// verified against the schema. `id` is the CalculatedOrder id, `lineItemId` is the
// CalculatedLineItem id. `restock` defaults to false in GraphQL — REST always sent
// restock:true, so we pass true to preserve behavior.
const ORDER_EDIT_SET_QUANTITY_MUTATION = /* GraphQL */ `
  mutation OrderEditSetQuantity($id: ID!, $lineItemId: ID!, $quantity: Int!, $restock: Boolean) {
    orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity, restock: $restock) {
      calculatedOrder { id }
      userErrors { field message }
    }
  }
`;

// orderEditCommit(id: ID!, notifyCustomer: Boolean, staffNote: String) verified.
// Returns the modified ORDER (not an order_edit). We fetch totalPriceSet so the
// mapped return can surface the RECALCULATED total for verification.
const ORDER_EDIT_COMMIT_MUTATION = /* GraphQL */ `
  mutation OrderEditCommit($id: ID!, $notifyCustomer: Boolean, $staffNote: String) {
    orderEditCommit(id: $id, notifyCustomer: $notifyCustomer, staffNote: $staffNote) {
      order {
        id
        name
        totalPriceSet {
          presentmentMoney { amount currencyCode }
          shopMoney { amount currencyCode }
        }
      }
      userErrors { field message }
    }
  }
`;

/**
 * Edit an order's line-item quantities via the GraphQL order-edit flow
 * (orderEditBegin -> orderEditSetQuantity per line -> orderEditCommit). Replaces
 * the 3-call REST flow. MONEY-ADJACENT: Shopify recalculates order totals on commit.
 *
 * ORIGINAL -> CALCULATED line-item id mapping is the trickiest part — see the
 * block comment above the mutation constants. We build a lookup from the numeric
 * suffix of each CalculatedLineItem id returned by orderEditBegin, then resolve
 * each caller line-item id against it.
 *
 * BEST-EFFORT set-quantity (preserves REST exactly): REST's set_quantity only
 * LOGGED and CONTINUED on failure. We do the same for BOTH a userErrors response
 * AND a transport/GraphQL throw (wrapped in try/catch), plus we skip (log) any
 * caller line item with no matching calculated line item.
 *
 * commit userErrors -> throws ShopifyApiError, the same failure mode as the old
 * non-2xx REST commit. begin returning no calculatedOrder -> throws the same
 * 'No edit session returned from Shopify' the REST flow threw.
 *
 * RETURN: REST returned the opaque `order_edit`; GraphQL returns the committed
 * Order. No caller reads specific fields (the route just wraps it as
 * { orderEdit }), so we surface a REST-ish object with a numeric id + the
 * recalculated presentment total (per the refund convention above).
 */
export async function editOrder(credentials: ShopifyCredentials, orderId: string | number, params: EditOrderParams) {
  const { lineItems, reason, notify } = params;
  const orderGid = `gid://shopify/Order/${orderId}`;

  // Step 1: begin the edit — returns the CalculatedOrder + its calculated line items.
  const beginData = await shopifyGraphQL<GqlOrderEditBeginResponse>(credentials, ORDER_EDIT_BEGIN_MUTATION, {
    id: orderGid,
  });
  const calculatedOrder = beginData.orderEditBegin.calculatedOrder;
  if (!calculatedOrder) throw new Error("No edit session returned from Shopify");

  // Map each ORIGINAL line-item id (numeric) -> its CalculatedLineItem gid, keyed
  // by the numeric suffix of the ids orderEditBegin actually returned.
  const calculatedLineItemByOriginalId = new Map<number, string>();
  for (const edge of calculatedOrder.lineItems.edges) {
    calculatedLineItemByOriginalId.set(refundLegacyIdNum(edge.node.id), edge.node.id);
  }

  // Step 2: set quantities — BEST-EFFORT (matches REST: log & continue on failure).
  for (const item of lineItems || []) {
    const calculatedLineItemId = calculatedLineItemByOriginalId.get(Number(item.lineItemId));
    if (!calculatedLineItemId) {
      logger.error("[shopify]", "set_quantity skipped: no calculated line item for original line item", {
        lineItemId: item.lineItemId,
      });
      continue;
    }
    try {
      const setData = await shopifyGraphQL<GqlOrderEditSetQuantityResponse>(credentials, ORDER_EDIT_SET_QUANTITY_MUTATION, {
        id: calculatedOrder.id,
        lineItemId: calculatedLineItemId,
        quantity: item.quantity,
        restock: true,
      });
      if (setData.orderEditSetQuantity.userErrors.length > 0) {
        logger.error("[shopify]", "set_quantity failed", {
          error: setData.orderEditSetQuantity.userErrors.map((e) => e.message).join("; "),
        });
      }
    } catch (err) {
      logger.error("[shopify]", "set_quantity failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Step 3: commit — userErrors throw, same as REST's non-2xx commit failure.
  const commitData = await shopifyGraphQL<GqlOrderEditCommitResponse>(credentials, ORDER_EDIT_COMMIT_MUTATION, {
    id: calculatedOrder.id,
    notifyCustomer: notify !== false,
    staffNote: reason || "Order updated via support agent",
  });
  assertNoUserErrors(commitData.orderEditCommit.userErrors, "orderEditCommit");
  const order = commitData.orderEditCommit.order;
  if (!order) throw new ShopifyApiError("orderEditCommit returned no order", 200, "graphql");

  // gid://shopify/Order/123 -> 123. Surface the recalculated PRESENTMENT total
  // (the currency the customer sees), consistent with the refund mapping above.
  const presentment = order.totalPriceSet?.presentmentMoney;
  return {
    id: refundLegacyIdNum(order.id),
    name: order.name,
    total_price: presentment?.amount,
    currency: presentment?.currencyCode,
    total_price_set: order.totalPriceSet,
  };
}

// ── duplicateOrder (GraphQL) shapes ───────────────────────────────────────────
// Replaces the 2-call REST flow (GET /orders/{id}.json, POST
// /draft_orders.json) with an `order` read query + `draftOrderCreate`
// mutation (verified against
// https://shopify.dev/docs/api/admin-graphql/2025-04/mutations/draftOrderCreate,
// /input-objects/DraftOrderInput, /input-objects/DraftOrderLineItemInput,
// /input-objects/DraftOrderAppliedDiscountInput, /input-objects/PurchasingEntityInput).

interface GqlDuplicateLineItemNode {
  quantity: number;
  variant: { id: string } | null;
  discountAllocations: Array<{ allocatedAmountSet: { shopMoney: { amount: string } } }>;
}
interface GqlDuplicateOrderNode {
  name: string;
  tags: string[];
  customer: { id: string } | null;
  shippingAddress: {
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    zip: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
  lineItems: { edges: Array<{ node: GqlDuplicateLineItemNode }> };
}
interface GqlDuplicateOrderReadResponse {
  order: GqlDuplicateOrderNode | null;
}
interface GqlDraftOrderCreateResponse {
  draftOrderCreate: {
    draftOrder: { id: string; name: string; invoiceUrl: string } | null;
    userErrors: GqlUserError[];
  };
}

// Order.lineItems is a LineItemConnection; LineItem.variant is nullable (custom
// line items have none) and LineItem.discountAllocations carries a MoneyBag
// (allocatedAmountSet) — verified against the Order/LineItem/DiscountAllocation
// object docs.
const DUPLICATE_ORDER_READ_QUERY = /* GraphQL */ `
  query DuplicateOrderRead($orderId: ID!) {
    order(id: $orderId) {
      name
      tags
      customer { id }
      shippingAddress {
        address1
        address2
        city
        province
        country
        zip
        firstName
        lastName
        phone
      }
      lineItems(first: 250) {
        edges {
          node {
            quantity
            variant { id }
            discountAllocations {
              allocatedAmountSet {
                shopMoney { amount }
              }
            }
          }
        }
      }
    }
  }
`;

const DRAFT_ORDER_CREATE_MUTATION = /* GraphQL */ `
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
      }
      userErrors { field message }
    }
  }
`;

/**
 * Duplicate an order by creating a draft order with copied line items, via
 * the `order` read query + `draftOrderCreate` mutation. Replaces the 2-call
 * REST flow (GET /orders/{id}.json, POST /draft_orders.json).
 *
 * CUSTOMER ATTACHMENT: `DraftOrderInput.customerId` is DEPRECATED (verified
 * against the DraftOrderInput docs) — a customer is attached via
 * `purchasingEntity: { customerId }` (`PurchasingEntityInput`), which is what
 * we use here instead of a field named `customerId` on the top-level input.
 *
 * DISCOUNT valueType: REST's `'fixed_amount'`/`'percentage'` map to the
 * `DraftOrderAppliedDiscountType` enum `FIXED_AMOUNT`/`PERCENTAGE` (verified
 * against the enum docs — those are the only two values). `value` is a
 * required `Float` (not the `String(discountValue)` REST's JSON body took),
 * so we coerce with `Number(...)`.
 *
 * PER-LINE-ITEM DISCOUNT CURRENCY LEG (MONEY-CRITICAL): REST's
 * `discount_allocations[0].amount` was the order's SHOP-currency amount (REST's
 * plain `amount` field, as opposed to `amount_set.presentment_money`).
 * GraphQL's `DiscountAllocation.allocatedAmountSet` carries both legs; we read
 * `shopMoney.amount` to match. This also happens to be the currency
 * `DraftOrderAppliedDiscountInput` itself expects for a FIXED_AMOUNT `value`
 * ("a fixed amount in your shop currency" per its docs) — so REST parity and
 * the GraphQL input's own requirement point to the same field.
 *
 * userErrors -> throws ShopifyApiError, same failure mode as the old non-2xx
 * REST response. A null `order` read (bad orderId) also throws — the old REST
 * GET would have thrown via shopifyFetchJSON's non-2xx handling; GraphQL
 * returns 200 with `order: null` instead, so we throw explicitly rather than
 * silently building a draft order from an empty order.
 */
export async function duplicateOrder(credentials: ShopifyCredentials, orderId: string | number, params: DuplicateOrderParams = {}) {
  const { keepAddress, note, tags, discountType, discountValue, applyDiscount } = params;
  const orderGid = `gid://shopify/Order/${orderId}`;

  const readData = await shopifyGraphQL<GqlDuplicateOrderReadResponse>(credentials, DUPLICATE_ORDER_READ_QUERY, {
    orderId: orderGid,
  });
  const order = readData.order;
  if (!order) throw new ShopifyApiError(`Order ${orderId} not found`, 404, "graphql");

  const lineItems = order.lineItems.edges
    .map(({ node: item }) => {
      const base: Record<string, unknown> = { variantId: item.variant?.id, quantity: item.quantity };
      // Per-line-item discount copying (flat wrapper's applyDiscount behavior)
      if (applyDiscount && item.discountAllocations?.length) {
        base.appliedDiscount = {
          value: Number(item.discountAllocations[0]?.allocatedAmountSet.shopMoney.amount),
          valueType: "FIXED_AMOUNT",
          title: "Duplicated discount",
        };
      }
      return base;
    })
    .filter((item) => item.variantId);

  const input: Record<string, unknown> = {
    lineItems,
    note: note || `Duplicate of ${order.name}`,
    // DraftOrderInput.tags is [String!] — REST's `tags` param was a single
    // comma-separated string; order.tags is already an array from GraphQL.
    tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : order.tags,
  };

  if (order.customer) {
    input.purchasingEntity = { customerId: order.customer.id };
  }

  if (discountType && discountValue && Number(discountValue) > 0) {
    input.appliedDiscount = {
      description: "Discount",
      valueType: discountType === "percentage" ? "PERCENTAGE" : "FIXED_AMOUNT",
      value: Number(discountValue),
      title: discountType === "percentage" ? `${discountValue}% discount` : `€${discountValue} discount`,
    };
  }

  if (keepAddress !== false && order.shippingAddress) {
    const a = order.shippingAddress;
    input.shippingAddress = {
      address1: a.address1,
      address2: a.address2,
      city: a.city,
      province: a.province,
      country: a.country,
      zip: a.zip,
      firstName: a.firstName,
      lastName: a.lastName,
      phone: a.phone,
    };
  }

  const data = await shopifyGraphQL<GqlDraftOrderCreateResponse>(credentials, DRAFT_ORDER_CREATE_MUTATION, { input });
  assertNoUserErrors(data.draftOrderCreate.userErrors, "draftOrderCreate");
  const draftOrder = data.draftOrderCreate.draftOrder;
  if (!draftOrder) throw new ShopifyApiError("draftOrderCreate returned no draft order", 200, "graphql");

  return {
    id: refundLegacyIdNum(draftOrder.id),
    name: draftOrder.name,
    invoiceUrl: draftOrder.invoiceUrl,
  };
}

const ORDER_UPDATE_NOTE_MUTATION = /* GraphQL */ `
  mutation OrderUpdateNote($input: OrderInput!) {
    orderUpdate(input: $input) {
      order { id note }
      userErrors { field message }
    }
  }
`;

interface GqlOrderUpdateNoteResponse {
  orderUpdate: {
    order: { id: string; note: string | null } | null;
    userErrors: GqlUserError[];
  };
}

/**
 * Update order note and/or tags via the `orderUpdate` GraphQL mutation.
 * Mirrors the old REST `PUT /orders/{id}.json` behavior: no return value,
 * throws on failure (including a non-empty `userErrors`).
 */
export async function updateOrderNote(credentials: ShopifyCredentials, orderId: string | number, fields: UpdateOrderNoteFields): Promise<void> {
  const input: Record<string, unknown> = { id: `gid://shopify/Order/${orderId}` };
  if (fields.note !== undefined) input.note = fields.note;
  // OrderInput.tags is [String!] — REST accepted a single comma-separated string.
  if (fields.tags !== undefined) {
    input.tags = fields.tags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const data = await shopifyGraphQL<GqlOrderUpdateNoteResponse>(credentials, ORDER_UPDATE_NOTE_MUTATION, { input });
  assertNoUserErrors(data.orderUpdate.userErrors);
}

const ORDER_UPDATE_ADDRESS_MUTATION = /* GraphQL */ `
  mutation OrderUpdateAddress($input: OrderInput!) {
    orderUpdate(input: $input) {
      order {
        id
        shippingAddress {
          address1
          address2
          city
          province
          country
          zip
          firstName
          lastName
          phone
        }
      }
      userErrors { field message }
    }
  }
`;

interface GqlMailingAddress {
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  zip: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

interface GqlOrderUpdateAddressResponse {
  orderUpdate: {
    order: { id: string; shippingAddress: GqlMailingAddress | null } | null;
    userErrors: GqlUserError[];
  };
}

/**
 * Update order shipping address via the `orderUpdate` GraphQL mutation.
 * `MailingAddressInput.country`/`province` are deprecated in favor of the ISO
 * `countryCode`/`provinceCode`, but this input never carried a province — and
 * `countryCode` is a `CountryCode` ENUM, so it is only included when present
 * (an empty string would fail GraphQL variable coercion, unlike REST's
 * tolerant empty `country_code`). `country` (deprecated but still a plain
 * String) is still sent to preserve the old REST behavior of storing the
 * free-text country name independently of the code.
 * Returns the snake_case shape the old REST caller expected.
 */
export async function updateOrderAddress(credentials: ShopifyCredentials, orderId: string | number, address: UpdateAddressInput) {
  const shippingAddress: Record<string, unknown> = {
    firstName: address.firstName,
    lastName: address.lastName,
    address1: address.address1,
    address2: address.address2 || "",
    city: address.city,
    zip: address.zip,
    country: address.country || "",
    phone: address.phone || "",
  };
  if (address.countryCode) shippingAddress.countryCode = address.countryCode;

  const data = await shopifyGraphQL<GqlOrderUpdateAddressResponse>(credentials, ORDER_UPDATE_ADDRESS_MUTATION, {
    input: {
      id: `gid://shopify/Order/${orderId}`,
      shippingAddress,
    },
  });
  assertNoUserErrors(data.orderUpdate.userErrors);

  const sa = data.orderUpdate.order?.shippingAddress;
  if (!sa) return undefined;

  return {
    first_name: sa.firstName,
    last_name: sa.lastName,
    address1: sa.address1,
    address2: sa.address2,
    city: sa.city,
    province: sa.province,
    country: sa.country,
    zip: sa.zip,
    phone: sa.phone,
  };
}

// ── fulfillmentCreate (GraphQL) shapes ────────────────────────────────────────
// Replaces the 2-call REST flow (GET /orders/{id}/fulfillment_orders.json,
// POST /fulfillments.json). NOTE: `fulfillmentCreateV2` is DEPRECATED in favor
// of `fulfillmentCreate` (verified against
// https://shopify.dev/docs/api/admin-graphql/2025-04/mutations/fulfillmentCreateV2
// — "Deprecated. Use fulfillmentCreate instead") — both take the same
// `fulfillment: FulfillmentInput!` argument shape, so we use the
// non-deprecated `fulfillmentCreate`.

const ORDER_FULFILLMENT_ORDERS_QUERY = /* GraphQL */ `
  query OrderFulfillmentOrders($orderId: ID!) {
    order(id: $orderId) {
      fulfillmentOrders(first: 250) {
        edges {
          node {
            id
            status
          }
        }
      }
    }
  }
`;

interface GqlFulfillmentOrderNode {
  id: string;
  status: string;
}
interface GqlOrderFulfillmentOrdersResponse {
  order: {
    fulfillmentOrders: {
      edges: { node: GqlFulfillmentOrderNode }[];
    };
  } | null;
}

// FulfillmentInput fields verified against
// https://shopify.dev/docs/api/admin-graphql/2025-04/input-objects/FulfillmentInput:
// lineItemsByFulfillmentOrder ([FulfillmentOrderLineItemsInput!]!, required),
// notifyCustomer (Boolean), trackingInfo (FulfillmentTrackingInput).
// FulfillmentOrderLineItemsInput.fulfillmentOrderLineItems is left blank
// (verified optional — "If left blank, all line items of the fulfillment
// order will be fulfilled") to match REST's behavior of fulfilling every
// line item on each open fulfillment order.
// FulfillmentTrackingInput fields verified against
// https://shopify.dev/docs/api/admin-graphql/2025-04/input-objects/FulfillmentTrackingInput:
// number/company/url (the singular trio REST's tracking_info also used).
const FULFILLMENT_CREATE_MUTATION = /* GraphQL */ `
  mutation FulfillmentCreate($fulfillment: FulfillmentInput!) {
    fulfillmentCreate(fulfillment: $fulfillment) {
      fulfillment {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface GqlFulfillmentCreateResponse {
  fulfillmentCreate: {
    fulfillment: { id: string; status: string } | null;
    userErrors: GqlUserError[];
  };
}

/**
 * Fulfill an order by creating a fulfillment with tracking info, via the
 * `fulfillmentCreate` GraphQL mutation. Replaces the 2-call REST flow (GET
 * fulfillment_orders.json + POST fulfillments.json).
 *
 * FulfillmentOrderStatus is UPPERCASE in GraphQL (verified against
 * https://shopify.dev/docs/api/admin-graphql/2025-04/enums/FulfillmentOrderStatus)
 * — filters for OPEN / IN_PROGRESS, same as REST's 'open'/'in_progress'.
 *
 * Fulfillment.status (FulfillmentStatus enum) is also UPPERCASE
 * (SUCCESS/CANCELLED/ERROR/FAILURE, plus deprecated OPEN/PENDING) — lowercased
 * on return to preserve REST's lowercase status strings exactly
 * (verified against https://shopify.dev/docs/api/admin-graphql/2025-04/enums/FulfillmentStatus).
 *
 * userErrors -> throws ShopifyApiError, same failure mode as the old non-2xx
 * REST response.
 */
export async function fulfillOrder(credentials: ShopifyCredentials, orderId: string | number, params: FulfillOrderParams = {}) {
  const { trackingNumber, trackingCompany, trackingUrl, notify } = params;
  const orderGid = `gid://shopify/Order/${orderId}`;

  const foData = await shopifyGraphQL<GqlOrderFulfillmentOrdersResponse>(credentials, ORDER_FULFILLMENT_ORDERS_QUERY, {
    orderId: orderGid,
  });
  const open = (foData.order?.fulfillmentOrders.edges || [])
    .map((e) => e.node)
    .filter((fo) => fo.status === "OPEN" || fo.status === "IN_PROGRESS");
  if (!open.length) throw new Error("No open fulfillment found");

  const fulfillmentInput: Record<string, unknown> = {
    lineItemsByFulfillmentOrder: open.map((fo) => ({ fulfillmentOrderId: fo.id })),
    notifyCustomer: notify !== false,
  };
  if (trackingNumber) {
    fulfillmentInput.trackingInfo = {
      number: trackingNumber,
      company: trackingCompany || "",
      url: trackingUrl || "",
    };
  }

  const data = await shopifyGraphQL<GqlFulfillmentCreateResponse>(credentials, FULFILLMENT_CREATE_MUTATION, {
    fulfillment: fulfillmentInput,
  });
  assertNoUserErrors(data.fulfillmentCreate.userErrors, "fulfillmentCreate");
  const fulfillment = data.fulfillmentCreate.fulfillment;
  if (!fulfillment) throw new ShopifyApiError("fulfillmentCreate returned no fulfillment", 200, "graphql");

  // gid://shopify/Fulfillment/999 -> 999 (REST exposed a numeric id, not a
  // global id). Reuses the generic gid-parsing helper defined above for
  // refunds — it doesn't care which resource the gid belongs to.
  return { id: refundLegacyIdNum(fulfillment.id), status: fulfillment.status.toLowerCase() };
}
