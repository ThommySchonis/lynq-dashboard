/**
 * Single source of truth for Shopify OAuth scopes.
 * MUST stay in sync with shopify-app-config/shopify.app.toml `[access_scopes].scopes`.
 * Only scopes tied to a shipped feature (see Task 1 audit). Requirement 3.2.
 */
export const CANONICAL_SHOPIFY_SCOPES =
  'read_orders,write_orders,read_order_edits,write_order_edits,read_draft_orders,write_draft_orders,read_fulfillments,write_fulfillments,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders,read_customers,read_products,read_reports'
