// types/stores.ts

export interface Store {
  id: string
  workspace_id: string
  name: string
  shopify_domain: string
  shopify_access_token: string | null
  shopify_client_secret: string | null
  shopify_scope: string | null
  shopify_connected_at: string | null
  store_currency: string | null
  created_at: string
}

/** Subset returned to the frontend (no secrets) */
export interface StorePublic {
  id: string
  name: string
  shopify_domain: string
  shopify_connected_at: string | null
  store_currency: string | null
  created_at: string
}

export interface StoreEmailConfig {
  id: string
  store_id: string
  workspace_id: string
  provider: 'gmail' | 'outlook' | 'custom'
  email_address: string
  connected_at: string
  watch_expiry: string | null
}

export interface CreateStoreInput {
  name: string
  shopify_domain: string
}

export interface UpdateStoreInput {
  name: string
}
