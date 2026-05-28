import type { SubscriptionStatus } from '@/types/billing'

export interface ClientOverviewItem {
  id: string
  companyName: string
  email: string
  status: 'active' | 'inactive'
  createdAt: string

  // Workspace
  workspaceId: string
  suspendedAt: string | null
  suspensionReason: string | null

  // Billing
  billingStatus: SubscriptionStatus | null
  planName: string | null

  // Integrations
  hasShopify: boolean
  hasGmail: boolean
  hasOutlook: boolean

  // Usage
  lastLoginAt: string | null
}

export interface ClientOverviewResponse {
  clients: ClientOverviewItem[]
  summary: {
    total: number
    overdue: number
    disconnected: number
    inactive7d: number
  }
}
