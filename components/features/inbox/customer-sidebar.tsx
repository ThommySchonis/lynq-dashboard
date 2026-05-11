'use client'

import { AvatarFallback, Avatar as ShadAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ORDER_STATUS } from '@/lib/inbox-constants'
import {
  extractEmail,
  extractName,
  fmtPrice,
} from '@/lib/inbox-utils'
import {
  Calendar,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  LayoutGrid,
  Mail,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  Phone,
  Plus,
  RotateCcw,
  Search,
  SquarePen,
  Truck,
  XCircle,
} from 'lucide-react'
import { useMemo, useCallback } from 'react'
import { useInboxUI } from '@/stores/inbox-ui'
import { useConversations, useCustomerSearch } from '@/hooks/inbox/use-inbox-data'

interface SidebarThread {
  id: string
  from: string
  subject: string
  [key: string]: unknown
}

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
  firstName?: string
  lastName?: string
  phone?: string | null
  city?: string
  country?: string
  createdAt?: string
  note?: string | null
  ordersCount?: number
  totalSpent?: string | number
  currency?: string
  tags?: string
  [key: string]: unknown
}

interface SidebarCustomerResult {
  customer?: SidebarCustomerData | null
  orders?: SidebarOrder[]
  [key: string]: unknown
}

export function CustomerSidebar() {
  // Zustand UI state
  const selectedThreadId = useInboxUI((s) => s.selectedThreadId)
  const custSearch = useInboxUI((s) => s.custSearch)
  const rightTab = useInboxUI((s) => s.rightTab)
  const expandedOrders = useInboxUI((s) => s.expandedOrders)
  const expandedSubs = useInboxUI((s) => s.expandedSubs)
  const custFieldsOpen = useInboxUI((s) => s.custFieldsOpen)
  const custShowMore = useInboxUI((s) => s.custShowMore)
  const activeFolder = useInboxUI((s) => s.activeFolder)
  const search = useInboxUI((s) => s.search)

  const setCustSearch = useInboxUI((s) => s.setCustSearch)
  const setRightTab = useInboxUI((s) => s.setRightTab)
  const setExpandedOrders = useInboxUI((s) => s.setExpandedOrders)
  const setExpandedSubs = useInboxUI((s) => s.setExpandedSubs)
  const setCustFieldsOpen = useInboxUI((s) => s.setCustFieldsOpen)
  const setCustShowMore = useInboxUI((s) => s.setCustShowMore)
  const setModal = useInboxUI((s) => s.setModal)

  // TanStack data
  const { data: threads = [] } = useConversations(activeFolder, search) as { data?: SidebarThread[] }

  const selectedThread = useMemo(
    () => (threads || []).find((t: SidebarThread) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  )

  // Customer search: auto-fetch when a thread is selected
  const autoCustomerEmail = selectedThread ? extractEmail(selectedThread.from) || '' : ''
  const customerQuery = custSearch || autoCustomerEmail
  const { data: customer, isLoading: loadingCust } = useCustomerSearch(customerQuery) as { data?: SidebarCustomerResult; isLoading: boolean }

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
        <AvatarFallback className="bg-[#F0F0F0] text-(--text-2)" style={{ fontSize: size * 0.34 }}>
          {ini}
        </AvatarFallback>
      </ShadAvatar>
    )
  }

  const customerName = customer?.customer
    ? `${customer.customer.firstName || ''} ${customer.customer.lastName || ''}`.trim() || extractName(selectedThread.from)
    : extractName(selectedThread.from)

  return (
    <div className="sscroll w-[280px] border-l border-border flex flex-col shrink-0 overflow-y-auto bg-(--bg-surface)">
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="relative">
          <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-(--text-3) flex pointer-events-none">
            <Search size={14} />
          </span>
          <input
            className="w-full py-[7px] px-3 pl-[32px] bg-(--bg-surface-2) border border-(--border) rounded-lg text-(--text-1) text-xs outline-none transition-[border-color] duration-200 focus:border-(--border-hover)"
            placeholder="Search by email or #order number..."
            value={custSearch}
            onChange={(e) => setCustSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustSearch(custSearch)
            }}
          />
        </div>
      </div>

      {/* Customer header */}
      <div className="px-3.5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          {renderAvatar(customerName, 28)}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-(--text-1) overflow-hidden text-ellipsis whitespace-nowrap">
              {customerName}
            </div>
            <div className="text-[11px] text-(--text-3) mt-px overflow-hidden text-ellipsis whitespace-nowrap">{extractEmail(selectedThread.from)}</div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="flex items-center justify-center w-7 h-7 rounded-[7px] text-(--text-3) transition-all duration-150 border border-border bg-transparent shrink-0 hover:text-(--text-1) hover:bg-(--bg-surface-2)"
          >
            <MoreVertical size={13} />
          </Button>
        </div>
      </div>

      {/* Customer Fields — collapsible */}
      <div className="border-b border-border shrink-0">
        <button
          className="w-full flex items-center gap-1.5 py-[9px] px-3.5 bg-transparent cursor-pointer text-left transition-[background] duration-[120ms] hover:bg-(--bg-surface-2)"
          onClick={() => setCustFieldsOpen((v) => !v)}
        >
          <span className="text-[10px] font-bold text-(--text-3) flex-1 tracking-[.07em] uppercase">Customer Fields</span>
          <ChevronDown size={10} className={`transition-transform duration-200 text-(--text-3) shrink-0 ${custFieldsOpen ? 'rotate-180' : 'rotate-0'}`} />
        </button>
        {custFieldsOpen && (
          <div className="px-3.5 pb-2.5 pt-0 flex flex-col">
            <div className="flex items-baseline justify-between gap-4 px-3.5">
              <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Email</span>
              <span className="text-xs font-medium text-(--text-1) text-right break-words text-[11px] break-all">{extractEmail(selectedThread.from)}</span>
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
                    <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Phone</span>
                    <span className="text-xs font-medium text-(--text-1) text-right break-words">{customer.customer.phone}</span>
                  </div>
                )}
                {(customer.customer.city || customer.customer.country) && (
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Location</span>
                    <span className="text-xs font-medium text-(--text-1) text-right break-words">
                      {[customer.customer.city, customer.customer.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {customer.customer.createdAt && (
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Customer since</span>
                    <span className="text-xs font-medium text-(--text-1) text-right break-words">
                      {new Date(customer.customer.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                )}
                {customer.customer.note && (
                  <div className="mt-1.5 px-[9px] py-1.5 bg-(--bg-surface-2) rounded-[7px] border border-border">
                    <div className="text-[10px] font-bold text-(--text-3) uppercase tracking-[.06em] mb-0.5">Note</div>
                    <div className="text-[11.5px] text-(--text-2) italic leading-[1.5]">{customer.customer.note}</div>
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
          const badgeColor = refundPct > 30 ? '#f87171' : refundPct > 10 ? '#fbbf24' : null
          return (
            <div className="flex border-b border-border shrink-0">
              <div className="flex-1 py-2.5 text-center border-r border-border">
                <div className="text-sm font-extrabold text-(--text-1) tracking-[-0.02em]">
                  {fmtPrice(customer.customer.totalSpent ?? 0, customer.customer.currency ?? '')}
                </div>
                <div className="text-[9.5px] text-(--text-3) mt-0.5 uppercase tracking-[.06em]">Spent</div>
              </div>
              <div className="flex-1 py-2.5 text-center border-r border-border">
                <div className="text-sm font-extrabold text-(--text-1) tracking-[-0.02em]">{customer.customer.ordersCount ?? '—'}</div>
                <div className="text-[9.5px] text-(--text-3) mt-0.5 uppercase tracking-[.06em]">Orders</div>
              </div>
              <div className="flex-1 py-2.5 text-center">
                <div className="text-sm font-extrabold tracking-[-0.02em]" style={{ color: badgeColor || 'var(--text-1)' }}>
                  {approx ? '~' : ''}
                  {refundPct}%
                </div>
                <div className="text-[9.5px] text-(--text-3) mt-0.5 uppercase tracking-[.06em]">Refund</div>
              </div>
            </div>
          )
        })()}

      {/* Tags */}
      {customer?.customer?.tags && (
        <div className="px-3.5 py-2 border-b border-border flex flex-wrap gap-1 shrink-0">
          {customer.customer.tags
            .split(',')
            .filter(Boolean)
            .map((tag) => (
              <span key={tag} className="text-[10px] font-medium py-0.5 px-[7px] rounded bg-(--bg-surface-2) text-(--text-1) border border-(--border)">
                {tag.trim()}
              </span>
            ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        <button
          className={`flex-1 py-2 px-1.5 bg-transparent cursor-pointer text-[11.5px] font-medium text-(--text-2) border-b-2 border-transparent transition-all whitespace-nowrap text-center${rightTab === 'info' ? ' on' : ''}`}
          onClick={() => setRightTab('info')}
        >
          Customer
        </button>
        <button
          className={`flex-1 py-2 px-1.5 bg-transparent cursor-pointer text-[11.5px] font-medium text-(--text-2) border-b-2 border-transparent transition-all whitespace-nowrap text-center${rightTab === 'shopify' ? ' on' : ''}`}
          onClick={() => setRightTab('shopify')}
        >
          Orders
          {(customer?.orders || []).length > 0 ? ` (${customer?.orders?.length ?? 0})` : ''}
        </button>
      </div>

      {/* Customer tab */}
      {rightTab === 'info' && (
        <div className="shrink-0">
          {loadingCust && (
            <div className="px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-5 rounded-[5px] mb-2"
                />
              ))}
            </div>
          )}
          {!loadingCust && (
            <div className="pt-2.5 px-3.5 pb-1 flex flex-col">
              {/* Note row */}
              <div className="flex items-start gap-2 py-[5px] border-b border-border mb-0.5">
                <span className="flex text-(--text-3) mt-px shrink-0">
                  <FileText size={13} />
                </span>
                <span className={`text-xs leading-[1.5] ${customer?.customer?.note ? 'text-(--text-2)' : 'text-(--text-3) italic'}`}>
                  {customer?.customer?.note || 'This customer has no note.'}
                </span>
              </div>
              {/* Email row */}
              <div className="flex items-center gap-2 py-[5px]">
                <span className="flex text-(--text-3) shrink-0">
                  <Mail size={13} />
                </span>
                <a
                  href={`mailto:${extractEmail(selectedThread.from)}`}
                  className="text-xs text-(--text-1) no-underline overflow-hidden text-ellipsis whitespace-nowrap hover:underline"
                >
                  {extractEmail(selectedThread.from)}
                </a>
              </div>
              {/* Phone row */}
              {customer?.customer?.phone && (
                <div className="flex items-center gap-2 py-[5px]">
                  <span className="flex text-(--text-3) shrink-0">
                    <Phone size={13} />
                  </span>
                  <a href={`tel:${customer.customer.phone}`} className="text-xs text-(--text-1) no-underline hover:underline">
                    {customer.customer.phone}
                  </a>
                </div>
              )}
              {/* Show more */}
              {customer?.customer && (
                <Button
                  variant="ghost"
                  onClick={() => setCustShowMore((v) => !v)}
                  className="flex items-center gap-1 py-[5px] px-0 text-xs text-(--text-2) font-inherit font-medium"
                >
                  {custShowMore ? 'Show less' : 'Show more'}
                  <ChevronDown size={10} className={`transition-transform duration-200 ${custShowMore ? 'rotate-180' : 'rotate-0'}`} />
                </Button>
              )}
              {custShowMore && customer?.customer && (
                <div className="flex flex-col pt-1 border-t border-border">
                  {(customer.customer.city || customer.customer.country) && (
                    <div className="flex items-baseline justify-between gap-4 px-3.5">
                      <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Location</span>
                      <span className="text-xs font-medium text-(--text-1) text-right break-words">
                        {[customer.customer.city, customer.customer.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {customer.customer.createdAt && (
                    <div className="flex items-baseline justify-between gap-4 px-3.5">
                      <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Customer since</span>
                      <span className="text-xs font-medium text-(--text-1) text-right break-words">
                        {new Date(customer.customer.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Orders</span>
                    <span className="text-xs font-medium text-(--text-1) text-right break-words">{customer.customer.ordersCount ?? '—'}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Total spent</span>
                    <span className="text-xs font-medium text-(--text-1) text-right break-words font-bold text-(--text-1)">
                      {fmtPrice(customer.customer.totalSpent ?? 0, customer.customer.currency ?? '')}
                    </span>
                  </div>
                </div>
              )}
              {!customer?.customer && <div className="py-2 text-xs text-(--text-3)">No Shopify customer found</div>}
            </div>
          )}
          {/* Open Timeline row */}
          <div className="pt-2 px-3.5 pb-3 flex items-center gap-2.5">
            <Button
              variant="outline"
              className="flex items-center gap-1.5 py-[5px] px-3 rounded-[7px] border border-border bg-transparent text-(--text-2) text-[11.5px] font-semibold font-inherit transition-all duration-150 shrink-0 hover:bg-(--bg-surface-2) hover:text-(--text-1)"
            >
              <Calendar size={12} />
              Open Timeline
            </Button>
            {selectedThread?.id && <span className="text-[11px] text-(--text-3)">1 ticket, 1 open</span>}
          </div>
        </div>
      )}

      {/* Orders tab */}
      {rightTab === 'shopify' && (
        <div>
          {/* Create order */}
          <div className="px-3 py-2.5 border-b border-border">
            <Button
              variant="outline"
              className="w-full px-3 py-[7px] rounded-lg border border-border bg-transparent text-(--text-2) text-xs font-semibold font-inherit flex items-center justify-center gap-1.5 transition-all duration-150 hover:bg-(--bg-surface-2) hover:text-(--text-1)"
            >
              <Plus size={12} />
              Create order
            </Button>
          </div>

          {loadingCust &&
            [0, 1].map((i) => (
              <div key={i} className="border-b border-border px-3.5 py-2.5">
                <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-4 rounded-[5px] mb-2 w-[60%]" />
                <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-3 rounded-[5px] mb-[5px] w-[80%]" />
                <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-3 rounded-[5px] w-[50%]" />
              </div>
            ))}
          {!loadingCust && !customer?.customer && <div className="py-6 text-center text-xs text-(--text-3)">No Shopify data found</div>}
          {!loadingCust && customer?.customer && (customer.orders || []).length === 0 && (
            <div className="py-6 text-center text-xs text-(--text-3)">No orders</div>
          )}

          {/* Order sections */}
          {(customer?.orders || []).map((order, oi) => {
            const isOpen = expandedOrders[order.id] === undefined ? oi === 0 : expandedOrders[order.id]
            const shippingOpen = expandedSubs[`${order.id}_shipping`] === undefined ? true : !!expandedSubs[`${order.id}_shipping`]
            const trackOpen = expandedSubs[`${order.id}_track`] === undefined ? true : !!expandedSubs[`${order.id}_track`]
            const isCancelled = !!order.cancelledAt || order.financialStatus === 'cancelled' || order.financialStatus === 'voided'
            const isRefunded = order.financialStatus === 'refunded'
            const canRefund = !isCancelled && !isRefunded
            const canCancel = !isCancelled
            const finS = isCancelled ? ORDER_STATUS.cancelled : ORDER_STATUS[order.financialStatus?.toLowerCase() ?? '']
            const fulS = ORDER_STATUS[order.fulfillmentStatus?.toLowerCase() ?? '']
            const sa = order.shippingAddress
            return (
              <div key={order.id} className="border-b border-border">
                {/* Order header */}
                <button
                  className="w-full flex items-center gap-1.5 py-2.5 px-3.5 bg-transparent cursor-pointer text-left transition-[background] duration-[120ms] hover:bg-(--bg-surface-2)"
                  onClick={() =>
                    setExpandedOrders((v) => ({
                      ...v,
                      [order.id]: !isOpen,
                    }))
                  }
                >
                  <span className="text-[13.5px] font-bold text-(--text-1) flex-1 text-left">{order.name}</span>
                  <ChevronDown size={10} className={`transition-transform duration-200 text-(--text-3) shrink-0 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3 pt-0">
                    {/* Status badges */}
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {finS && (
                        <span
                          className="text-[10px] font-bold px-[7px] py-0.5 rounded tracking-[.05em] uppercase"
                          style={{
                            background: finS.bg,
                            color: finS.color,
                            border: `1px solid ${finS.color}22`,
                          }}
                        >
                          {finS.label}
                        </span>
                      )}
                      {fulS && (
                        <span
                          className="text-[10px] font-bold px-[7px] py-0.5 rounded tracking-[.05em] uppercase"
                          style={{
                            background: fulS.bg,
                            color: fulS.color,
                            border: `1px solid ${fulS.color}22`,
                          }}
                        >
                          {fulS.label}
                        </span>
                      )}
                      {(order.refunds?.length ?? 0) > 0 && order.financialStatus !== 'refunded' && (
                        <span className="text-[10px] font-bold px-[7px] py-0.5 rounded tracking-[.05em] uppercase bg-[rgba(248,113,133,0.12)] text-[#fb7185] border border-[rgba(248,113,133,0.22)]">
                          Partial refund
                        </span>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-1 flex-wrap mb-2.5">
                      <button
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-(--border) bg-(--bg-surface) text-(--text-1) cursor-pointer transition-all hover:border-(--border-hover) hover:bg-(--bg-surface-2)"
                        onClick={() => setModal({ type: 'duplicate', order })}
                      >
                        <span className="flex">
                          <Copy size={12} />
                        </span>
                        Duplicate
                      </button>
                      {canRefund && (
                        <button
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-(--border) bg-(--bg-surface) text-(--text-1) cursor-pointer transition-all hover:border-(--border-hover) hover:bg-(--bg-surface-2)"
                          onClick={() => setModal({ type: 'refund', order })}
                        >
                          <RotateCcw size={11} />$ Refund
                        </button>
                      )}
                      {canCancel && (
                        <button
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-(--border) bg-(--bg-surface) text-(--text-1) cursor-pointer transition-all hover:border-[rgba(220,38,38,0.35)] hover:text-[#dc2626] hover:bg-[rgba(220,38,38,0.05)]"
                          onClick={() => setModal({ type: 'cancel', order })}
                        >
                          <XCircle size={11} />
                          Cancel
                        </button>
                      )}
                      <button
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-(--border) bg-(--bg-surface) text-(--text-1) cursor-pointer transition-all hover:border-(--border-hover) hover:bg-(--bg-surface-2) px-[7px] py-1"
                        onClick={() => setModal({ type: 'note', order })}
                      >
                        <MoreHorizontal size={13} />
                      </button>
                    </div>

                    {/* Key-value rows */}
                    <div className="mb-1">
                      <div className="flex items-baseline justify-between gap-4 px-3.5">
                        <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Created</span>
                        <span className="text-xs font-medium text-(--text-1) text-right break-words">
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 px-3.5">
                        <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Total</span>
                        <span className="text-xs font-medium text-(--text-1) text-right break-words font-bold text-(--text-1)">
                          {fmtPrice(order.totalPrice, order.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Tracking */}
                    {(order.fulfillments || []).length > 0 && (
                      <>
                        <button
                          className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-(--text-1) text-left transition-opacity border-t border-(--border) mt-1.5 hover:opacity-75"
                          onClick={() =>
                            setExpandedSubs((v) => ({
                              ...v,
                              [`${order.id}_track`]: !trackOpen,
                            }))
                          }
                        >
                          <span className="flex text-(--text-3)">
                            <Truck size={12} />
                          </span>
                          <span className="flex-1 font-semibold text-[11.5px] text-(--text-2)">Tracking</span>
                          <ChevronDown
                            size={10}
                            className={`transition-transform duration-200 text-(--text-3) ${trackOpen ? 'rotate-180' : 'rotate-0'}`}
                          />
                        </button>
                        {trackOpen &&
                          (order.fulfillments ?? []).slice(0, 1).map((f: SidebarFulfillment, fi: number) => (
                            <div key={fi} className="pb-1.5">
                              <div className="flex items-baseline justify-between gap-4 px-3.5">
                                <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Carrier</span>
                                <span className="text-xs font-medium text-(--text-1) text-right break-words">{f.trackingCompany || '—'}</span>
                              </div>
                              {f.trackingNumber && (
                                <div className="flex items-baseline justify-between gap-4 px-3.5">
                                  <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Tracking #</span>
                                  <span className="text-xs font-medium text-(--text-1) text-right break-words font-mono text-[10.5px]">
                                    {f.trackingNumber}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-baseline justify-between gap-4 px-3.5">
                                <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Status</span>
                                <span className="text-[10px] font-bold px-1.5 py-px rounded bg-[rgba(74,222,128,0.12)] text-[#16a34a] border border-[rgba(74,222,128,0.25)] tracking-[.04em] uppercase">
                                  Delivered
                                </span>
                              </div>
                              {f.trackingUrl && (
                                <div className="mt-1">
                                  <a
                                    href={f.trackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11.5px] text-(--text-1) no-underline inline-flex items-center gap-[3px]"
                                  >
                                    Track package{' '}
                                    <span className="flex">
                                      <ExternalLink size={11} />
                                    </span>
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                      </>
                    )}

                    {/* Shipping address */}
                    {sa && (
                      <>
                        <button
                          className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-(--text-1) text-left transition-opacity border-t border-(--border) mt-1.5 hover:opacity-75"
                          onClick={() =>
                            setExpandedSubs((v) => ({
                              ...v,
                              [`${order.id}_shipping`]: !shippingOpen,
                            }))
                          }
                        >
                          <span className="flex text-(--text-3)">
                            <MapPin size={12} />
                          </span>
                          <span className="flex-1 font-semibold text-[11.5px] text-(--text-2)">Shipping address</span>
                          <ChevronDown
                            size={10}
                            className={`transition-transform duration-200 text-(--text-3) ${shippingOpen ? 'rotate-180' : 'rotate-0'}`}
                          />
                        </button>
                        {shippingOpen && (
                          <div className="pb-1.5">
                            <div className="mb-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setModal({ type: 'address', order })}
                                className="inline-flex items-center gap-1 text-(--text-2) text-[11px] font-semibold px-2 py-[3px] rounded-[6px] border border-border bg-transparent transition-all duration-150 font-inherit hover:text-(--text-1) hover:border-(--border-hover)"
                              >
                                <span className="flex">
                                  <SquarePen size={12} />
                                </span>{' '}
                                Edit
                              </Button>
                            </div>
                            {[
                              sa.firstName || sa.lastName
                                ? {
                                    l: 'Name',
                                    v: [sa.firstName, sa.lastName].filter(Boolean).join(' '),
                                  }
                                : null,
                              sa.address1 ? { l: 'Address1', v: sa.address1 } : null,
                              sa.address2 ? { l: 'Address2', v: sa.address2 } : null,
                              sa.city ? { l: 'City', v: sa.city } : null,
                              sa.country ? { l: 'Country', v: sa.country } : null,
                              sa.province ? { l: 'Province', v: sa.province } : null,
                              sa.zip ? { l: 'Zip', v: sa.zip } : null,
                            ]
                              .filter((r): r is { l: string; v: string } => r !== null)
                              .map((row) => (
                                <div key={row.l} className="flex items-baseline justify-between gap-4 px-3.5">
                                  <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">{row.l}</span>
                                  <span className="text-xs font-medium text-(--text-1) text-right break-words">{row.v}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Line items */}
                    {(order.lineItems || []).map((item, ii) => {
                      const itemKey = `${order.id}_item_${item.id}`
                      const itemOpen = expandedSubs[itemKey] === undefined ? true : !!expandedSubs[itemKey]
                      return (
                        <div key={item.id}>
                          <button
                            className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-(--text-1) text-left transition-opacity border-t border-(--border) mt-1.5 hover:opacity-75"
                            onClick={() =>
                              setExpandedSubs((v) => ({
                                ...v,
                                [itemKey]: !itemOpen,
                              }))
                            }
                          >
                            <LayoutGrid size={12} className="text-(--text-3) shrink-0" />
                            <span className="flex-1 text-[11px] font-semibold text-(--text-2) overflow-hidden text-ellipsis whitespace-nowrap">
                              {item.quantity} × {item.title}
                              {item.variantTitle ? ` · ${item.variantTitle}` : ''}
                            </span>
                            <ChevronDown
                              size={10}
                              className={`transition-transform duration-200 text-(--text-3) shrink-0 ${itemOpen ? 'rotate-180' : 'rotate-0'}`}
                            />
                          </button>
                          {itemOpen && (
                            <div className="pb-1">
                              <div className="flex items-baseline justify-between gap-4 px-3.5">
                                <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Amount</span>
                                <span className="text-xs font-medium text-(--text-1) text-right break-words">
                                  {fmtPrice(Number(item.price) * item.quantity, order.currency)}
                                </span>
                              </div>
                              {item.sku && (
                                <div className="flex items-baseline justify-between gap-4 px-3.5">
                                  <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Sku</span>
                                  <span className="text-xs font-medium text-(--text-1) text-right break-words font-mono text-[10.5px]">{item.sku}</span>
                                </div>
                              )}
                              {item.variantTitle && (
                                <div className="flex items-baseline justify-between gap-4 px-3.5">
                                  <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Variant</span>
                                  <span className="text-xs font-medium text-(--text-1) text-right break-words">{item.variantTitle}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
