'use client'

import { AvatarFallback, Avatar as ShadAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  extractEmail,
  extractName,
} from '@/lib/inbox-utils'
import {
  ChevronDown,
  MoreVertical,
  Search,
  Star,
} from 'lucide-react'
import { useMemo, useCallback } from 'react'
import { useInboxUI } from '@/stores/inbox-ui'
import { useConversations, useCustomerSearch } from '@/hooks/inbox/use-inbox-data'
import { CustomerStats } from './customer-stats'
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

interface SidebarCustomerResult {
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
  const customer = rawCustomer as SidebarCustomerResult | undefined

  // Manual customer search handler
  const handleCustSearch = useCallback(
    (query: string) => {
      if (!query.trim()) return
      setCustSearch(query.trim())
    },
    [setCustSearch],
  )

  if (!selectedThread) return null

  // Inline avatar helper
  const renderAvatar = (name: string, size: number) => {
    const ini = (name || '?')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    return (
      <ShadAvatar className="shrink-0" style={{ width: size, height: size }}>
        <AvatarFallback className="bg-[#F0F0F0] text-foreground-2" style={{ fontSize: size * 0.34 }}>
          {ini}
        </AvatarFallback>
      </ShadAvatar>
    )
  }

  const customerName = customer?.customer
    ? `${customer.customer.firstName || ''} ${customer.customer.lastName || ''}`.trim() || extractName(selectedThread.from)
    : extractName(selectedThread.from)

  // VIP badge derived from the Shopify tags string until a structured VIP field
  // exists (backend task #3).
  const isVip = (customer?.customer?.tags ?? '')
    .split(',')
    .some((t) => t.trim().toLowerCase() === 'vip')

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
        <>
      {/* Customer header */}
      <div className="px-3.5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          {renderAvatar(customerName, 28)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                {customerName}
              </span>
              {isVip && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-[.04em] text-amber-600 dark:text-amber-400">
                  <Star size={9} className="fill-current" />
                  VIP
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-px overflow-hidden text-ellipsis whitespace-nowrap">{extractEmail(selectedThread.from)}</div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="flex items-center justify-center w-7 h-7 rounded-[7px] text-muted-foreground transition-all duration-150 border border-border bg-transparent shrink-0 hover:text-foreground hover:bg-secondary"
          >
            <MoreVertical size={13} />
          </Button>
        </div>
      </div>

      {/* Customer Fields — collapsible */}
      <div className="border-b border-border shrink-0">
        <button
          className="w-full flex items-center gap-1.5 py-[9px] px-3.5 bg-transparent cursor-pointer text-left transition-[background] duration-[120ms] hover:bg-secondary"
          onClick={() => setCustFieldsOpen((v) => !v)}
        >
          <span className="text-[10px] font-bold text-muted-foreground flex-1 tracking-[.07em] uppercase">Customer Fields</span>
          <ChevronDown size={10} className={`transition-transform duration-200 text-muted-foreground shrink-0 ${custFieldsOpen ? 'rotate-180' : 'rotate-0'}`} />
        </button>
        {custFieldsOpen && (
          <div className="px-3.5 pb-2.5 pt-0 flex flex-col">
            <div className="flex items-baseline justify-between gap-4 px-3.5">
              <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Email</span>
              <span className="text-xs font-medium text-foreground text-right break-words text-[11px] break-all">{extractEmail(selectedThread.from)}</span>
            </div>
            {loadingCust &&
              [0, 1].map((i) => (
                <div
                  key={i}
                  className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-[18px] rounded-[5px] my-1"
                />
              ))}
            {customer?.customer && !loadingCust && (
              <>
                {customer.customer.phone && (
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Phone</span>
                    <span className="text-xs font-medium text-foreground text-right break-words">{customer.customer.phone}</span>
                  </div>
                )}
                {(customer.customer.city || customer.customer.country) && (
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Location</span>
                    <span className="text-xs font-medium text-foreground text-right break-words">
                      {[customer.customer.city, customer.customer.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {customer.customer.createdAt && (
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Customer since</span>
                    <span className="text-xs font-medium text-foreground text-right break-words">
                      {new Date(customer.customer.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                )}
                {customer.customer.note && (
                  <div className="mt-1.5 px-[9px] py-1.5 bg-secondary rounded-[7px] border border-border">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.06em] mb-0.5">Note</div>
                    <div className="text-[11.5px] text-foreground-2 italic leading-[1.5]">{customer.customer.note}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      {customer?.customer &&
        !loadingCust &&
        (() => {
          const orders = customer.orders || []
          const withRefund = orders.filter((o) => o.refunds && o.refunds.length > 0)
          const refundPct = orders.length > 0 ? Math.round((withRefund.length / orders.length) * 100) : 0
          const approx = (customer.customer.ordersCount ?? 0) > 50
          return (
            <CustomerStats
              totalSpent={customer.customer.totalSpent ?? 0}
              currency={customer.customer.currency ?? ''}
              ordersCount={customer.customer.ordersCount ?? 0}
              refundPct={refundPct}
              approx={approx}
            />
          )
        })()}

      {/* Tags */}
      {customer?.customer?.tags && (
        <div className="px-3.5 py-2 border-b border-border flex flex-wrap gap-1 shrink-0">
          {customer.customer.tags
            .split(',')
            .filter(Boolean)
            .map((tag) => (
              <span key={tag} className="text-[10px] font-medium py-0.5 px-[7px] rounded bg-secondary text-foreground border border-border">
                {tag.trim()}
              </span>
            ))}
        </div>
      )}

          {!loadingCust && !customer?.customer && (
            <div className="px-3.5 py-3 text-xs text-muted-foreground">No Shopify customer found</div>
          )}
        </>
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
