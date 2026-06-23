// Barrel: Shopify service split into domain modules. Import from here to keep
// a single stable entry point. Submodules: core (fetch helpers + error),
// analytics, orders, order-actions, products, draft-orders.
export * from './shopify-core'
export * from './shopify-analytics'
export * from './shopify-orders'
export * from './shopify-order-actions'
export * from './shopify-products'
export * from './shopify-draft-orders'

// Public types (previously exported from this file).
export type {
  ProductSearchVariant,
  ProductSearchResult,
  CreateDraftOrderParams,
} from './shopify-types'
