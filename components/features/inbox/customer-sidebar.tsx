'use client'

import Link from 'next/link'
import { extractEmail, extractName, deriveIsVip } from '@/lib/inbox-utils'
import { Search } from 'lucide-react'
import { useMemo, useCallback } from 'react'
import { useInboxUI } from '@/stores/inbox-ui'
import { useConversations, useConversation, useCustomerSearch } from '@/hooks/inbox/use-inbox-data'
import { CustomerSection } from './customer-section'
import { OrdersSection } from './orders-section'

interface SidebarFulfillment {
  trackingCompany?: string
  trackingNumber?: string
  trackingUrl?: string
  [key: string]: unknown
}

interface SidebarLineItem {
  id: string
  title: string
  quantity: number
  price: string | number
  sku?: string
  variantTitle?: string
  [key: string]: unknown
}

interface SidebarAddress {
  firstName?: string
  lastName?: string
  address1?: string
  address2?: string
  city?: string
  country?: string
  province?: string
  zip?: string
  [key: string]: unknown
}

interface SidebarRefund {
  id: string
  [key: string]: unknown
}

interface SidebarOrder {
  id: string
  name: string
  createdAt: string
  totalPrice: string | number
  currency: string
  financialStatus?: string
  fulfillmentStatus?: string
  cancelledAt?: string | null
  note?: string | null
  lineItems?: SidebarLineItem[]
  shippingAddress?: SidebarAddress | null
  fulfillments?: SidebarFulfillment[]
  refunds?: SidebarRefund[]
  [key: string]: unknown
}

interface SidebarCustomerData {
  id?: string | number
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  city?: string
  country?: string
  createdAt?: string
  note?: string | null
  ordersCount?: number
  totalSpent?: string | number
  currency?: string
  tags?: string
  defaultAddress?: {
    firstName?: string
    lastName?: string
    address1?: string
    address2?: string
    city?: string
    province?: string
    country?: string
    zip?: string
    phone?: string
  }
  [key: string]: unknown
}

export interface SidebarCustomerResult {
  customer?: SidebarCustomerData | null
  orders?: SidebarOrder[]
  [key: string]: unknown
}

// Manual customer search isn't in the Figma rail (189-11179) — tabs sit at the
// top, customer info lives inside the Customer tab. Kept behind this flag so the
// client can restore the search; typed `boolean` to keep dead-branch lint quiet.
const SHOW_LEGACY: boolean = false

// Customer-rail tab (Figma 189-11179): active = 2px primary underline + dark
// semibold label; inactive = grey medium.
const railTabClass = (active: boolean) =>
  `flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] border-b-2 transition-colors ${
    active ? "border-b-primary text-foreground font-semibold" : "border-b-transparent text-muted-foreground font-medium hover:text-foreground-2"
  }`

export function CustomerSidebar() {
  // Zustand UI state
  const selectedThreadId = useInboxUI((s) => s.selectedThreadId)
  const custSearch = useInboxUI((s) => s.custSearch)
  const rightTab = useInboxUI((s) => s.rightTab)
  const expandedOrders = useInboxUI((s) => s.expandedOrders)
  const expandedSubs = useInboxUI((s) => s.expandedSubs)
  const custFieldsOpen = useInboxUI((s) => s.custFieldsOpen)
  const activeFolder = useInboxUI((s) => s.activeFolder)
  const search = useInboxUI((s) => s.search)

  const setCustSearch = useInboxUI((s) => s.setCustSearch)
  const setRightTab = useInboxUI((s) => s.setRightTab)
  const setExpandedOrders = useInboxUI((s) => s.setExpandedOrders)
  const setExpandedSubs = useInboxUI((s) => s.setExpandedSubs)
  const setCustFieldsOpen = useInboxUI((s) => s.setCustFieldsOpen)
  const setModal = useInboxUI((s) => s.setModal)

  // TanStack data
  const { data: threads = [] } = useConversations(activeFolder, search)

  const selectedThread = useMemo(
    () => (threads || []).find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  )

  // Customer search: auto-fetch when a thread is selected
  const autoCustomerEmail = selectedThread ? extractEmail(selectedThread.from) || '' : ''
  const customerQuery = custSearch || autoCustomerEmail
  const { data: rawCustomer, isLoading: loadingCust } = useCustomerSearch(customerQuery)
  const needsReauth = (rawCustomer as { code?: string } | undefined)?.code === 'reauth_required'
  const customer = rawCustomer as SidebarCustomerResult | undefined

  // Workspace conversation tags for the selected thread — shown in the sidebar
  // after the Shopify customer tags. Shares the cache with the conversation panel.
  const { data: conversationDetail } = useConversation(selectedThreadId)
  const conversationTags = conversationDetail?.tags ?? []

  // Manual customer search handler
  const handleCustSearch = useCallback(
    (query: string) => {
      if (!query.trim()) return
      setCustSearch(query.trim())
    },
    [setCustSearch],
  )

  if (!selectedThread) return null

  const customerName = customer?.customer
    ? `${customer.customer.firstName || ''} ${customer.customer.lastName || ''}`.trim() || extractName(selectedThread.from)
    : extractName(selectedThread.from)

  // VIP badge derived from the Shopify tags string until a structured VIP field
  // exists (backend task #3).
  const isVip = deriveIsVip(customer?.customer?.tags)

  return (
    <div className="thin-scrollbar w-[280px] border-l border-border flex flex-col shrink-0 overflow-y-auto bg-card">
      {/* Search — hidden per Figma (restore via SHOW_LEGACY) */}
      {SHOW_LEGACY && (
        <div className="px-3 py-2.5 border-b border-border shrink-0">
          <div className="relative">
            <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted-foreground flex pointer-events-none">
              <Search size={14} />
            </span>
            <input
              className="w-full py-[7px] px-3 pl-[32px] bg-secondary border border-border rounded-lg text-foreground text-xs outline-none transition-[border-color] duration-200 focus:border-(--border-hover)"
              placeholder="Search by email or #order number..."
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustSearch(custSearch)
              }}
            />
          </div>
        </div>
      )}

      {/* Tabs — top of the rail (Figma 189-11179): active = 2px primary
          underline + dark semibold; inactive = grey medium */}
      <div className="flex shrink-0 border-b border-border">
        <button className={railTabClass(rightTab === 'info')} onClick={() => setRightTab('info')}>
          Customer
        </button>
        <button className={railTabClass(rightTab === 'shopify')} onClick={() => setRightTab('shopify')}>
          Orders
          {(customer?.orders || []).length > 0 && (
            <span className="rounded-md bg-border px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{customer?.orders?.length ?? 0}</span>
          )}
        </button>
      </div>

      {/* Customer tab */}
      {rightTab === 'info' && (
        needsReauth ? (
          <div className="shrink-0 px-3.5 pt-2.5 pb-1">
            <div className="flex flex-col items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This store&apos;s Shopify connection needs to be re-authorized before customer data can load.
              </p>
              <Link
                href="/settings/workspace/stores"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Go to store settings to reconnect →
              </Link>
            </div>
          </div>
        ) : (
          <CustomerSection
            customer={customer}
            customerName={customerName}
            isVip={isVip}
            email={extractEmail(selectedThread.from)}
            loadingCust={loadingCust}
            custFieldsOpen={custFieldsOpen}
            setCustFieldsOpen={setCustFieldsOpen}
            conversationTags={conversationTags}
          />
        )
      )}

      {/* Orders tab */}
      {rightTab === 'shopify' && (
        <OrdersSection
          orders={customer?.orders || []}
          loadingCust={loadingCust}
          hasCustomer={!!customer?.customer}
          expandedOrders={expandedOrders}
          expandedSubs={expandedSubs}
          setExpandedOrders={setExpandedOrders}
          setExpandedSubs={setExpandedSubs}
          setModal={setModal}
          customer={customer?.customer ?? null}
          customerEmail={customer?.customer?.email || autoCustomerEmail}
          customerName={customerName}
        />
      )}
    </div>
  )
}
