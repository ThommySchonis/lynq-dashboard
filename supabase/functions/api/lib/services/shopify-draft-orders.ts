import { logger } from "../logger.ts";
import { ShopifyApiError } from "./shopify-core.ts";
import { shopifyGraphQL } from "./shopify-graphql.ts";
import type {
  CreateDraftOrderParams,
  DraftOrderWithInvoiceResult,
  ShopifyCredentials,
} from "./shopify-types.ts";

// ── shared shapes ──────────────────────────────────────────────────────────
// Shopify UserError: { field: string[] | null, message: string }. Shared by
// both mutations below. Mirrors the same private shape in shopify-order-actions.ts.
interface GqlUserError {
  field: string[] | null;
  message: string;
}

function assertNoUserErrors(userErrors: GqlUserError[], mutationName: string): void {
  if (userErrors.length > 0) {
    throw new ShopifyApiError(
      `${mutationName}: ${userErrors.map((e) => e.message).join("; ")}`,
      422,
      "graphql",
    );
  }
}

// gid://shopify/DraftOrder/999 -> 999 (REST exposed a numeric id, not a global
// id). Mirrors the same private helper (refundLegacyIdNum) in shopify-order-actions.ts.
function draftOrderLegacyId(gid: string): number {
  const tail = gid.split("/").pop() ?? "";
  return Number(tail.split("?")[0]);
}

// ── draftOrderCreate (GraphQL) shapes ─────────────────────────────────────────
// Replaces REST `POST /draft_orders.json` (verified against
// https://shopify.dev/docs/api/admin-graphql/2025-04/mutations/draftOrderCreate,
// /input-objects/DraftOrderInput, /input-objects/DraftOrderLineItemInput,
// /input-objects/DraftOrderAppliedDiscountInput, /input-objects/PurchasingEntityInput,
// /input-objects/MailingAddressInput).

interface GqlDraftOrderCreateResponse {
  draftOrderCreate: {
    draftOrder: { id: string; name: string; invoiceUrl: string } | null;
    userErrors: GqlUserError[];
  };
}

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
 * Create a Shopify draft order for an existing customer (or guest email), via
 * the `draftOrderCreate` GraphQL mutation. Replaces REST `POST /draft_orders.json`.
 * Used by the inbox CreateOrderModal.
 *
 * ONLY variant-based line items: `CreateDraftOrderParams.lineItems` (and the
 * old REST body — `variant_id` + `quantity` only) never carried a custom/title
 * shape; the CreateOrderModal always builds line items from product/variant
 * search results (`variantId` is always present). So no
 * `title`+`originalUnitPriceWithCurrency` custom-item branch of
 * `DraftOrderLineItemInput` is needed here (verified against the
 * DraftOrderLineItemInput docs: `variantId` is required for variant-based
 * items and must be null for custom items — we never send a custom item).
 * `li.variantId` is the numeric legacy id (see shopify-products.ts's
 * `legacyId()`), so it's wrapped into a gid here.
 *
 * CUSTOMER ATTACHMENT: `DraftOrderInput.customerId` is DEPRECATED (verified
 * against the DraftOrderInput docs) — a customer is attached via
 * `purchasingEntity: { customerId }` (`PurchasingEntityInput.customerId: ID`),
 * same as `duplicateOrder` in shopify-order-actions.ts. `params.customerId` is
 * a plain numeric id (REST did `Number(customerId)`), so it's wrapped into a gid.
 *
 * DISCOUNT valueType: REST's `'percentage'`/`'fixed'`
 * (`CreateDraftOrderParams.discount.type`) map to the
 * `DraftOrderAppliedDiscountType` enum `PERCENTAGE`/`FIXED_AMOUNT` (verified
 * against the enum docs — those are the only two values).
 * `DraftOrderAppliedDiscountInput.value` is a required `Float` (not the
 * `String(discount.value)` REST's JSON body took), so we coerce with
 * `Number(...)`. The discount `title` text is preserved byte-for-byte from the
 * REST code (no currency symbol, unlike duplicateOrder's fixed-discount title).
 *
 * SHIPPING ADDRESS: `params.shippingAddress` carries plain `country`/`province`
 * strings (no ISO code data available), so — same reasoning as
 * `updateOrderAddress` — we map onto `MailingAddressInput`'s deprecated-but-
 * still-functional `country`/`province` fields (verified against the
 * MailingAddressInput docs: deprecated, not removed) to preserve REST behavior
 * exactly, matching duplicateOrder's identical shippingAddress mapping.
 *
 * userErrors -> throws ShopifyApiError, same failure mode as the old non-2xx
 * REST response. A null `draftOrder` on success also throws (defensive;
 * unreachable when userErrors is empty, per Shopify's contract).
 */
export async function createDraftOrder(
  credentials: ShopifyCredentials,
  params: CreateDraftOrderParams,
) {
  const email = params.email?.trim();
  if (!params.customerId && !email) {
    throw new Error("createDraftOrder requires a customer id or email");
  }

  const input: Record<string, unknown> = {
    lineItems: params.lineItems.map((li) => ({
      variantId: `gid://shopify/ProductVariant/${li.variantId}`,
      quantity: li.quantity,
    })),
  };

  if (params.customerId) {
    input.purchasingEntity = { customerId: `gid://shopify/Customer/${params.customerId}` };
  } else {
    input.email = email;
  }

  if (params.note) input.note = params.note;

  if (params.shippingAddress) {
    const a = params.shippingAddress;
    input.shippingAddress = {
      firstName: a.firstName,
      lastName: a.lastName,
      address1: a.address1,
      address2: a.address2,
      city: a.city,
      province: a.province,
      country: a.country,
      zip: a.zip,
      phone: a.phone,
    };
  }

  if (params.discount) {
    input.appliedDiscount = {
      description: "Discount",
      valueType: params.discount.type === "percentage" ? "PERCENTAGE" : "FIXED_AMOUNT",
      value: Number(params.discount.value),
      title: params.discount.type === "percentage"
        ? `${params.discount.value}% discount`
        : `${params.discount.value} discount`,
    };
  }

  const data = await shopifyGraphQL<GqlDraftOrderCreateResponse>(
    credentials,
    DRAFT_ORDER_CREATE_MUTATION,
    { input },
  );
  assertNoUserErrors(data.draftOrderCreate.userErrors, "draftOrderCreate");
  const draftOrder = data.draftOrderCreate.draftOrder;
  if (!draftOrder) throw new ShopifyApiError("draftOrderCreate returned no draft order", 200, "graphql");

  return {
    id: draftOrderLegacyId(draftOrder.id),
    name: draftOrder.name,
    invoiceUrl: draftOrder.invoiceUrl,
  };
}

// ── draftOrderInvoiceSend (GraphQL) shapes ────────────────────────────────────
// Replaces REST `POST /draft_orders/{id}/send_invoice.json` (verified against
// https://shopify.dev/docs/api/admin-graphql/2025-04/mutations/draftOrderInvoiceSend,
// /input-objects/EmailInput).

interface GqlDraftOrderInvoiceSendResponse {
  draftOrderInvoiceSend: {
    draftOrder: { id: string } | null;
    userErrors: GqlUserError[];
  };
}

const DRAFT_ORDER_INVOICE_SEND_MUTATION = /* GraphQL */ `
  mutation DraftOrderInvoiceSend($id: ID!, $email: EmailInput) {
    draftOrderInvoiceSend(id: $id, email: $email) {
      draftOrder { id }
      userErrors { field message }
    }
  }
`;

/**
 * Send a draft order invoice email via the `draftOrderInvoiceSend` GraphQL
 * mutation. Replaces REST `POST /draft_orders/{id}/send_invoice.json`.
 *
 * `EmailInput` fields (verified against the EmailInput docs): `to`, `subject`,
 * `customMessage`, `bcc`, `from`, `body` — all optional Strings/`[String!]`.
 * We only ever set `to`/`subject`/`customMessage` (REST's `draft_order_invoice`
 * body never carried `bcc`/`from`/`body`), each included ONLY when the opt is a
 * non-empty trimmed string — same conditional as the REST `.trim()` checks.
 * `email` is always sent (possibly `{}`), matching REST always POSTing a
 * `draft_order_invoice` object (possibly empty) so Shopify falls back to its
 * default invoice template.
 *
 * userErrors -> throws ShopifyApiError, same failure mode as the old non-2xx
 * REST response. Void return, same as REST.
 */
export async function sendDraftOrderInvoice(
  credentials: ShopifyCredentials,
  draftOrderId: number,
  opts: { to?: string; subject?: string; customMessage?: string } = {},
): Promise<void> {
  const email: Record<string, unknown> = {};
  if (opts.to?.trim()) email.to = opts.to.trim();
  if (opts.subject?.trim()) email.subject = opts.subject.trim();
  if (opts.customMessage?.trim()) email.customMessage = opts.customMessage.trim();

  const data = await shopifyGraphQL<GqlDraftOrderInvoiceSendResponse>(
    credentials,
    DRAFT_ORDER_INVOICE_SEND_MUTATION,
    { id: `gid://shopify/DraftOrder/${draftOrderId}`, email },
  );
  assertNoUserErrors(data.draftOrderInvoiceSend.userErrors, "draftOrderInvoiceSend");
}

/**
 * Create a draft order and best-effort send its invoice email in one call.
 * Orchestrates `createDraftOrder` + `sendDraftOrderInvoice` — no GraphQL of
 * its own. BEST-EFFORT invoice send is unchanged from REST: on invoice
 * failure, log a warning and keep the created draft order, returning
 * `invoiceSent: false` + `invoiceError` rather than throwing.
 */
export async function createDraftOrderWithInvoice(
  credentials: ShopifyCredentials,
  params: CreateDraftOrderParams,
): Promise<DraftOrderWithInvoiceResult> {
  const draftOrder = await createDraftOrder(credentials, params);

  if (!draftOrder.id) {
    return { draftOrder, invoiceSent: false, invoiceError: "Draft order has no id" };
  }

  try {
    await sendDraftOrderInvoice(credentials, draftOrder.id, {
      subject: params.invoiceSubject,
      customMessage: params.invoiceMessage,
    });
    return { draftOrder, invoiceSent: true };
  } catch (err) {
    const invoiceError = err instanceof Error ? err.message : "Invoice send failed";
    logger.warn("[shopify-draft-orders]", "invoice send failed; draft kept", {
      draftOrderId: draftOrder.id,
      error: invoiceError,
    });
    return { draftOrder, invoiceSent: false, invoiceError };
  }
}
