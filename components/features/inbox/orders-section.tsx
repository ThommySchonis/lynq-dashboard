'use client'

import { Button } from '@/components/ui/button'
import { Gate } from '@/components/shared/gate'
import { ORDER_STATUS } from '@/lib/inbox-constants'
import { fmtPrice } from '@/lib/inbox-utils'
import { ParcelTrackingSection } from './parcel-tracking-section'
import type { Order as ParcelTrackingOrder } from '@/types/supply-chain'
import {
  ChevronDown,
  ClipboardList,
  Copy,
  ExternalLink,
  LayoutGrid,
  MapPin,
  MoreHorizontal,
  Plus,
  RotateCcw,
  SquarePen,
  Truck,
  XCircle,
} from 'lucide-react'

interface OrdersFulfillment {
  trackingCompany?: string
  trackingNumber?: string
  trackingUrl?: string
  [key: string]: unknown
}

interface OrdersLineItem {
  id: string
  title: string
  quantity: number
  price: string | number
  sku?: string
  variantTitle?: string
  [key: string]: unknown
}

interface OrdersAddress {
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

interface OrdersRefund {
  id: string
  [key: string]: unknown
}

interface OrdersOrder {
  id: string
  name: string
  createdAt: string
  totalPrice: string | number
  currency: string
  financialStatus?: string
  fulfillmentStatus?: string
  cancelledAt?: string | null
  note?: string | null
  lineItems?: OrdersLineItem[]
  shippingAddress?: OrdersAddress | null
  fulfillments?: OrdersFulfillment[]
  refunds?: OrdersRefund[]
  parcelTrackings?: ParcelTrackingOrder[]
  [key: string]: unknown
}

interface OrdersSectionProps {
  orders: OrdersOrder[]
  loadingCust: boolean
  hasCustomer: boolean
  expandedOrders: Record<string, boolean>
  expandedSubs: Record<string, boolean>
  setExpandedOrders: (fn: (v: Record<string, boolean>) => Record<string, boolean>) => void
  setExpandedSubs: (fn: (v: Record<string, boolean>) => Record<string, boolean>) => void
  setModal: (modal: {
    type: string
    order?: OrdersOrder
    customer?: { id: string | number; [key: string]: unknown }
    customerEmail?: string
    customerName?: string
  }) => void
  customer?: { id?: string | number; [key: string]: unknown } | null
  customerEmail?: string
  customerName?: string
}

export function OrdersSection({
  orders,
  loadingCust,
  hasCustomer,
  expandedOrders,
  expandedSubs,
  setExpandedOrders,
  setExpandedSubs,
  setModal,
  customer,
  customerEmail,
  customerName,
}: OrdersSectionProps) {
  return (
    <div>
      {/* Create order */}
      <div className="px-3 py-2.5 border-b border-border">
        <Button
          variant="outline"
          onClick={() => {
            setModal({
              type: 'create-order',
              customer: customer?.id
                ? (customer as { id: string | number; [key: string]: unknown })
                : undefined,
              customerEmail,
              customerName,
            })
          }}
          className="w-full px-3 py-[7px] rounded-lg border border-dashed border-border bg-transparent text-foreground-2 text-xs font-semibold font-inherit flex items-center justify-center gap-1.5 transition-all duration-150 hover:bg-secondary hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
      {!loadingCust && !hasCustomer && <div className="py-6 text-center text-xs text-muted-foreground">No Shopify data found</div>}
      {!loadingCust && hasCustomer && orders.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">No orders</div>
      )}

      {/* Order sections */}
      {orders.map((order, oi) => {
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
              className="w-full flex items-center gap-1.5 py-2.5 px-3.5 bg-transparent cursor-pointer text-left transition-[background] duration-[120ms] hover:bg-secondary"
              onClick={() =>
                setExpandedOrders((v) => ({
                  ...v,
                  [order.id]: !isOpen,
                }))
              }
            >
              <span className="text-[13.5px] font-bold text-primary flex-1 text-left">{order.name}</span>
              <ChevronDown size={10} className={`transition-transform duration-200 text-muted-foreground shrink-0 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            {isOpen && (
              <div className="px-3.5 pb-3 pt-0">
                {/* Status badges */}
                <div className="flex gap-1 mb-2 flex-wrap">
                  {finS && (
                    <span
                      className="text-[10px] font-bold px-[7px] py-0.5 rounded-md tracking-[.05em] uppercase"
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
                      className="text-[10px] font-bold px-[7px] py-0.5 rounded-md tracking-[.05em] uppercase"
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
                    <span className="text-[10px] font-bold px-[7px] py-0.5 rounded-md tracking-[.05em] uppercase bg-[rgba(248,113,133,0.12)] text-[#fb7185] border border-[rgba(248,113,133,0.22)]">
                      Partial refund
                    </span>
                  )}
                </div>
                {/* Action buttons */}
                <div className="flex gap-1 flex-wrap mb-2.5">
                  <Gate capability="manageOrders" mode="disable" reason="View-only access — you cannot duplicate orders.">
                    <button
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-border bg-card text-foreground cursor-pointer transition-all hover:border-(--border-hover) hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setModal({ type: 'duplicate', order })}
                    >
                      <span className="flex">
                        <Copy size={12} />
                      </span>
                      Duplicate
                    </button>
                  </Gate>
                  <button
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-border bg-card text-foreground cursor-pointer transition-all hover:border-(--border-hover) hover:bg-secondary"
                    onClick={() => setModal({
                      type: 'create-task',
                      order,
                      customerEmail,
                      customerName,
                    })}
                  >
                    <ClipboardList size={11} />
                    Task
                  </button>
                  {canRefund && (
                    <Gate capability="manageOrders" mode="disable" reason="View-only access — you cannot issue refunds.">
                      <button
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-border bg-card text-foreground cursor-pointer transition-all hover:border-(--border-hover) hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setModal({ type: 'refund', order })}
                      >
                        <RotateCcw size={11} />$ Refund
                      </button>
                    </Gate>
                  )}
                  {canCancel && (
                    <Gate capability="manageOrders" mode="disable" reason="View-only access — you cannot cancel orders.">
                      <button
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-border bg-card text-foreground cursor-pointer transition-all hover:border-[rgba(220,38,38,0.35)] hover:text-[#dc2626] hover:bg-[rgba(220,38,38,0.05)] disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setModal({ type: 'cancel', order })}
                      >
                        <XCircle size={11} />
                        Cancel
                      </button>
                    </Gate>
                  )}
                  <Gate capability="manageOrders" mode="disable" reason="View-only access — you cannot edit order notes.">
                    <button
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-border bg-card text-foreground cursor-pointer transition-all hover:border-(--border-hover) hover:bg-secondary px-[7px] py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setModal({ type: 'note', order })}
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </Gate>
                </div>

                {/* Key-value rows */}
                <div className="mb-1">
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Created</span>
                    <span className="text-xs font-medium text-foreground text-right break-words">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Total</span>
                    <span className="text-xs font-medium text-foreground text-right break-words font-bold text-foreground">
                      {fmtPrice(order.totalPrice, order.currency)}
                    </span>
                  </div>
                </div>

                {/* Tracking */}
                {(order.fulfillments || []).length > 0 && (
                  <>
                    <button
                      className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-foreground text-left transition-opacity border-t border-border mt-1.5 hover:opacity-75"
                      onClick={() =>
                        setExpandedSubs((v) => ({
                          ...v,
                          [`${order.id}_track`]: !trackOpen,
                        }))
                      }
                    >
                      <span className="flex text-muted-foreground">
                        <Truck size={12} />
                      </span>
                      <span className="flex-1 font-semibold text-[11.5px] text-foreground-2">Tracking</span>
                      <ChevronDown
                        size={10}
                        className={`transition-transform duration-200 text-muted-foreground ${trackOpen ? 'rotate-180' : 'rotate-0'}`}
                      />
                    </button>
                    {trackOpen &&
                      (order.fulfillments ?? []).slice(0, 1).map((f: OrdersFulfillment, fi: number) => (
                        <div key={fi} className="pb-1.5">
                          <div className="flex items-baseline justify-between gap-4 px-3.5">
                            <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Carrier</span>
                            <span className="text-xs font-medium text-foreground text-right break-words">{f.trackingCompany || '—'}</span>
                          </div>
                          {f.trackingNumber && (
                            <div className="flex items-baseline justify-between gap-4 px-3.5">
                              <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Tracking #</span>
                              <span className="text-xs font-medium text-foreground text-right break-words font-mono text-[10.5px]">
                                {f.trackingNumber}
                              </span>
                            </div>
                          )}
                          <div className="flex items-baseline justify-between gap-4 px-3.5">
                            <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Status</span>
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
                                className="text-[11.5px] text-foreground no-underline inline-flex items-center gap-[3px]"
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

                {/* ParcelPanel shipment tracking */}
                <ParcelTrackingSection trackings={order.parcelTrackings} />

                {/* Shipping address */}
                {sa && (
                  <>
                    <button
                      className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-foreground text-left transition-opacity border-t border-border mt-1.5 hover:opacity-75"
                      onClick={() =>
                        setExpandedSubs((v) => ({
                          ...v,
                          [`${order.id}_shipping`]: !shippingOpen,
                        }))
                      }
                    >
                      <span className="flex text-muted-foreground">
                        <MapPin size={12} />
                      </span>
                      <span className="flex-1 font-semibold text-[11.5px] text-foreground-2">Shipping address</span>
                      <ChevronDown
                        size={10}
                        className={`transition-transform duration-200 text-muted-foreground ${shippingOpen ? 'rotate-180' : 'rotate-0'}`}
                      />
                    </button>
                    {shippingOpen && (
                      <div className="pb-1.5">
                        <div className="mb-1.5">
                          <Gate capability="manageOrders" mode="disable" reason="View-only access — you cannot edit the shipping address.">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setModal({ type: 'address', order })}
                              className="inline-flex items-center gap-1 text-foreground-2 text-[11px] font-semibold px-2 py-[3px] rounded-[6px] border border-border bg-transparent transition-all duration-150 font-inherit hover:text-foreground hover:border-(--border-hover)"
                            >
                              <span className="flex">
                                <SquarePen size={12} />
                              </span>{' '}
                              Edit
                            </Button>
                          </Gate>
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
                              <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">{row.l}</span>
                              <span className="text-xs font-medium text-foreground text-right break-words">{row.v}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                )}

                {/* Line items */}
                {(order.lineItems || []).map((item) => {
                  const itemKey = `${order.id}_item_${item.id}`
                  const itemOpen = expandedSubs[itemKey] === undefined ? true : !!expandedSubs[itemKey]
                  return (
                    <div key={item.id}>
                      <button
                        className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-foreground text-left transition-opacity border-t border-border mt-1.5 hover:opacity-75"
                        onClick={() =>
                          setExpandedSubs((v) => ({
                            ...v,
                            [itemKey]: !itemOpen,
                          }))
                        }
                      >
                        <LayoutGrid size={12} className="text-muted-foreground shrink-0" />
                        <span className="flex-1 text-[11px] font-semibold text-foreground-2 overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.quantity} × {item.title}
                          {item.variantTitle ? ` · ${item.variantTitle}` : ''}
                        </span>
                        <ChevronDown
                          size={10}
                          className={`transition-transform duration-200 text-muted-foreground shrink-0 ${itemOpen ? 'rotate-180' : 'rotate-0'}`}
                        />
                      </button>
                      {itemOpen && (
                        <div className="pb-1">
                          <div className="flex items-baseline justify-between gap-4 px-3.5">
                            <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Amount</span>
                            <span className="text-xs font-medium text-foreground text-right break-words">
                              {fmtPrice(Number(item.price) * item.quantity, order.currency)}
                            </span>
                          </div>
                          {item.sku && (
                            <div className="flex items-baseline justify-between gap-4 px-3.5">
                              <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Sku</span>
                              <span className="text-xs font-medium text-foreground text-right break-words font-mono text-[10.5px]">{item.sku}</span>
                            </div>
                          )}
                          {item.variantTitle && (
                            <div className="flex items-baseline justify-between gap-4 px-3.5">
                              <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Variant</span>
                              <span className="text-xs font-medium text-foreground text-right break-words">{item.variantTitle}</span>
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
  )
}
