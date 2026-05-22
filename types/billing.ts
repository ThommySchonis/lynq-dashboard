// types/billing.ts
//
// Shared TS types for the billing surface. Mirrors the DB schema
// from supabase/migrations/20260512_billing_system.sql.

// ─── Enums (matches CHECK constraints) ───────────────────────────────

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'paused'
export type InvoiceStatus      = 'draft' | 'open' | 'paid' | 'void' | 'failed'
export type PaymentMethodType  = 'card' | 'sepa' | 'paypal'
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

export interface WorkspaceSubscription {
  id:                    string
  workspace_id:          string
  plan_id:               string
  status:                SubscriptionStatus
  trial_ends_at:         string | null
  current_period_start:  string
  current_period_end:    string
  canceled_at:           string | null
  cancel_at_period_end:  boolean
  whop_subscription_id:  string | null
  whop_customer_id:      string | null
}

export interface UsageCounter {
  id:                   string
  workspace_id:         string
  period_start:         string
  period_end:           string
  tickets_used:         number
  ai_suggest_used:      number
  ai_resolutions_used:  number
  tickets_overage:      number
  ai_suggest_overage:   number
}

export interface InvoiceLineItem {
  description: string
  quantity:    number
  unit_price:  number
  total:       number
}

export interface InvoiceBillingAddress {
  line1:       string | null
  line2:       string | null
  city:        string | null
  postal_code: string | null
  country:     string | null
  state:       string | null
}

export interface Invoice {
  id:                string
  workspace_id:      string
  invoice_number:    string
  status:            InvoiceStatus
  period_start:      string
  period_end:        string
  subtotal_eur:      number
  vat_amount_eur:    number
  total_eur:         number
  amount_paid_eur:   number
  amount_due_eur:    number
  description:       string | null
  line_items:        InvoiceLineItem[]
  paid_at:           string | null
  pdf_url:           string | null
  billing_email:     string | null
  billing_org_name:  string | null
  billing_address:   InvoiceBillingAddress | null
  vat_number:        string | null
  created_at:        string
}

export interface BillingInfo {
  id:                string
  workspace_id:      string
  billing_email:     string
  organization_name: string
  phone_number:      string | null
  address_line1:     string
  address_line2:     string | null
  city:              string
  postal_code:       string
  country:           string  // ISO-3166-1 alpha-2
  state:             string | null
  vat_number:        string | null
}

export interface PaymentMethod {
  id:          string
  workspace_id: string
  type:        PaymentMethodType
  last_four:   string | null
  brand:       string | null
  is_default:  boolean
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

export interface SubscriptionResponse {
  subscription: WorkspaceSubscription | null
  plan:         Plan | null
  usage:        UsageCounter | null
  percentages: {
    tickets:    number
    ai_suggest: number
  }
  limits: {
    tickets_reached:    boolean
    ai_suggest_reached: boolean
    tickets_at_80:      boolean
    ai_suggest_at_80:   boolean
  }
  trial_days_remaining: number | null
}

export interface UsageResponse {
  period_start:        string
  period_end:          string
  tickets_used:        number
  tickets_limit:       number | null
  tickets_overage:     number
  ai_suggest_used:     number
  ai_suggest_limit:    number | null
  ai_suggest_overage:  number
  ai_resolutions_used: number
  percentages: {
    tickets:    number
    ai_suggest: number
  }
}

export interface InvoicesListResponse {
  invoices: Invoice[]
  total:    number
  page:     number
  per_page: number
}

export interface AddonsListResponse {
  addons: SubscriptionAddon[]
}

// ─── Mutation inputs ─────────────────────────────────────────────────

export interface ChangePlanInput {
  plan_id: string
}

/**
 * Response from POST /api/billing/subscription/change-plan.
 *
 * Discriminated by `mode`:
 *   - 'updated'    → an existing Whop membership was PATCHed in place;
 *                    return shape mirrors the subscription row.
 *   - 'checkout'   → no existing membership yet (first-time purchase
 *                    or post-trial upgrade); the client must redirect
 *                    the user to `checkout_url` to complete payment.
 *                    Our workspace_subscriptions row is created later
 *                    by the `membership.activated` webhook.
 */
export type ChangePlanResponse =
  | { ok: true; mode: 'updated';  subscription: WorkspaceSubscription }
  | { ok: true; mode: 'checkout'; checkout_url: string }

export interface UpdateBillingInfoInput {
  billing_email?:     string
  organization_name?: string
  phone_number?:      string | null
  address_line1?:     string
  address_line2?:     string | null
  city?:              string
  postal_code?:       string
  country?:           string
  state?:             string | null
  vat_number?:        string | null
}
