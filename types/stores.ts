// types/stores.ts

export interface Store {
  id: string
  workspace_id: string
  name: string
  created_at: string
  ai_auto_generate: boolean
  ai_auto_send_enabled: boolean
}

export interface StorePublic {
  id: string
  name: string
  // Joined from integrations:
  shopify_domain: string | null
  shopify_connected_at: string | null
  store_currency: string | null
  status: string | null
  created_at: string
}

export interface CreateStoreInput {
  name: string
  shopify_domain: string
}

export interface UpdateStoreInput {
  name: string
}

export interface StoreEmailAccount {
  id: string
  provider: string
  email_address: string
  status: string
  connected_at: string | null
  watch_expiry: string | null
}
