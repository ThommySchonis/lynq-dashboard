'use client'

import { AvatarFallback, Avatar as ShadAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ChevronDown, MoreVertical, Star } from 'lucide-react'
import { getInitials } from '@/lib/inbox-utils'
import { CustomerStats } from './customer-stats'
import type { SidebarCustomerResult } from './customer-sidebar'

/**
 * Customer tab of the conversation rail (Figma 189-11179): customer card with
 * VIP badge, collapsible Customer Fields, KPI stats and tags. Mirrors the
 * extracted OrdersSection for the Orders tab.
 */
export function CustomerSection({
  customer,
  customerName,
  isVip,
  email,
  loadingCust,
  custFieldsOpen,
  setCustFieldsOpen,
}: {
  customer: SidebarCustomerResult | undefined
  customerName: string
  isVip: boolean
  email: string
  loadingCust: boolean
  custFieldsOpen: boolean
  setCustFieldsOpen: (fn: (v: boolean) => boolean) => void
}) {
  const cust = customer?.customer

  return (
    <>
      {/* Customer header */}
      <div className="px-3.5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <ShadAvatar className="shrink-0 size-7">
            <AvatarFallback className="bg-[#F0F0F0] text-foreground-2 text-[9.5px]">{getInitials(customerName)}</AvatarFallback>
          </ShadAvatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{customerName}</span>
              {isVip && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-[.04em] text-amber-600 dark:text-amber-400">
                  <Star size={9} className="fill-current" />
                  VIP
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-px overflow-hidden text-ellipsis whitespace-nowrap">{email}</div>
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
              <span className="text-xs font-medium text-foreground text-right break-words text-[11px] break-all">{email}</span>
            </div>
            {loadingCust &&
              [0, 1].map((i) => (
                <div
                  key={i}
                  className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-[18px] rounded-[5px] my-1"
                />
              ))}
            {cust && !loadingCust && (
              <>
                {cust.phone && (
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Phone</span>
                    <span className="text-xs font-medium text-foreground text-right break-words">{cust.phone}</span>
                  </div>
                )}
                {(cust.city || cust.country) && (
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Location</span>
                    <span className="text-xs font-medium text-foreground text-right break-words">{[cust.city, cust.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {cust.createdAt && (
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[72px]">Customer since</span>
                    <span className="text-xs font-medium text-foreground text-right break-words">
                      {new Date(cust.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}
                {cust.note && (
                  <div className="mt-1.5 px-[9px] py-1.5 bg-secondary rounded-[7px] border border-border">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[.06em] mb-0.5">Note</div>
                    <div className="text-[11.5px] text-foreground-2 italic leading-[1.5]">{cust.note}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      {cust &&
        !loadingCust &&
        (() => {
          const orders = customer?.orders || []
          const withRefund = orders.filter((o) => o.refunds && o.refunds.length > 0)
          const refundPct = orders.length > 0 ? Math.round((withRefund.length / orders.length) * 100) : 0
          const approx = (cust.ordersCount ?? 0) > 50
          return (
            <CustomerStats
              totalSpent={cust.totalSpent ?? 0}
              currency={cust.currency ?? ''}
              ordersCount={cust.ordersCount ?? 0}
              refundPct={refundPct}
              approx={approx}
            />
          )
        })()}

      {/* Tags */}
      {cust?.tags && (
        <div className="px-3.5 py-2 border-b border-border flex flex-wrap gap-1 shrink-0">
          {cust.tags
            .split(',')
            .filter(Boolean)
            .map((tag) => (
              <span key={tag} className="text-[10px] font-medium py-0.5 px-[7px] rounded bg-secondary text-foreground border border-border">
                {tag.trim()}
              </span>
            ))}
        </div>
      )}

      {!loadingCust && !cust && <div className="px-3.5 py-3 text-xs text-muted-foreground">No Shopify customer found</div>}
    </>
  )
}
