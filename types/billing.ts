// types/billing.ts
//
// Shared TS types for the billing surface. Shopify-backed billing.

// ─── Enums ────────────────────────────────────────────────────────────

/** @deprecated Legacy Whop-era status — use ShopifySubscriptionStatus for new code */
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'paused'

export type ShopifySubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'paused'
  | 'pending_shopify_subscription'

export type AddonStatus        = 'coming_soon' | 'beta' | 'live'
export type WorkspaceAddonStatus = 'active' | 'inactive' | 'pending'

// ─── Feature gates (JSONB in plans table) ────────────────────────────

export interface PlanFeatures {
  academy_access: boolean
  email_limit: number | null // null = unlimited
  priority_support: boolean
}

// ─── DB row shapes ───────────────────────────────────────────────────

export interface Plan {
  id:               string
  display_name:     string
  price_eur:        number | null
  ticket_limit:     number | null
  ai_suggest_limit: number | null
  whop_product_id:  string | null
  whop_plan_id:     string | null
  is_active:        boolean
  is_custom:        boolean
  sort_order:       number
  features:         PlanFeatures
}

export interface BillingInfo {
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  country: string | null
  zip: string | null
  company: string | null
}

export interface Invoice {
  id: string           // Shopify GID
  date: string         // ISO timestamp
  amount: number
  currency: string
  status: string
  receiptUrl: string | null
  planName: string
}

export interface BillingStore {
  id: string
  shopifyDomain: string
  isBillingStore: boolean
}

export interface SubscriptionAddon {
  id:                  string
  display_name:        string
  description:         string | null
  status:              AddonStatus
  price_eur:           number | null
  per_unit_price_eur:  number | null
  per_unit_label:      string | null
  sort_order:          number
  // Joined from workspace_addons when relevant
  workspace_status?:   WorkspaceAddonStatus
}

// ─── API response shapes ─────────────────────────────────────────────

export interface InvoicesListResponse {
  invoices: Invoice[]
}

export interface AddonsListResponse {
  addons: SubscriptionAddon[]
}

// ─── Shopify-billing API response shapes ─────────────────────────────

/** Mirrors ShopifyBillingSubscription from the Hono service layer */
export interface ShopifyBillingSubscription {
  planId:               string | null
  status:               ShopifySubscriptionStatus
  shopifyChargeStatus:  string | null
  trialEndsAt:          string | null
  currentPeriodEnd:     string | null
  isGrandfathered:      boolean
  billingShopDomain:    string | null
}

/** Response shape of GET /billing/subscription (Shopify-based) */
export interface SubscriptionWithUsageResponse {
  subscription: ShopifyBillingSubscription
  plan: {
    id: string
    display_name: string
    ticket_limit: number | null
    ai_suggest_limit: number | null
  } | null
  usage: {
    tickets_used: number
    ai_suggest_used: number
    period_start: string
    period_end: string
  } | null
  blocked: {
    tickets: boolean
    aiSuggest: boolean
  }
}

/** Response shape of GET /billing/manage-url */
export interface ManageUrlResponse {
  url: string
}

// ─── Emma AI usage API response shapes ───────────────────────────────

export interface EmmaUsageStore {
  store_id: string
  store_name: string
  count: number
  cost_eur: number
}

export interface EmmaUsageResponse {
  rate_eur: number
  currency: 'EUR'
  period_start: string | null
  period_end: string | null
  total_count: number
  total_cost_eur: number
  stores: EmmaUsageStore[]
}
