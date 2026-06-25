// Barrel: Shopify service split into domain modules. Import from here to keep
// a single stable entry point. Submodules: core (fetch helpers + error),
// analytics, orders, order-actions, products, draft-orders.
export * from './shopify-core.ts'
export * from './shopify-analytics.ts'
export * from './shopify-orders.ts'
export * from './shopify-order-actions.ts'
export * from './shopify-products.ts'
export * from './shopify-draft-orders.ts'

// Public types (previously exported from this file).
export type {
  ShopifyCredentials,
  ProductSearchVariant,
  ProductSearchResult,
  CreateDraftOrderParams,
  DraftOrderWithInvoiceResult,
  ShopifyDraftOrderInvoiceResponse,
} from './shopify-types.ts'
