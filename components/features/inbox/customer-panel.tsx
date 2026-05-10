'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { User, Mail, Phone, MapPin, Package, DollarSign, Calendar, Search } from 'lucide-react'

import { useInboxStore } from '@/stores/inbox'
import { useInbox } from '@/hooks/inbox/use-inbox'
import { useAuthStore } from '@/stores/auth'
import { fmtDate, fmtPrice } from '@/lib/inbox-utils'

import { SearchInput } from '@/components/shared/search-input'
import { LoadingState } from '@/components/shared/loading-state'
import { EmptyState } from '@/components/shared/empty-state'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

// ── Local types mirroring the camelCase shape returned by /api/shopify/customer ──

interface CamelAddress {
  firstName?: string
  lastName?: string
  address1?: string
  address2?: string
  city?: string
  zip?: string
  country?: string
  countryCode?: string
  phone?: string
}

interface CamelLineItem {
  id: string | number
  title: string
  variantTitle?: string | null
  sku?: string | null
  quantity: number
  price: string
}

interface CamelFulfillment {
  trackingNumber?: string | null
  trackingUrl?: string | null
  trackingCompany?: string | null
  status?: string
}

interface CamelOrder {
  id: string | number
  name: string
  createdAt: string
  financialStatus: string
  fulfillmentStatus: string
  cancelReason?: string | null
  cancelledAt?: string | null
  totalPrice: string
  currency: string
  lineItems: CamelLineItem[]
  fulfillments: CamelFulfillment[]
  refunds?: unknown[]
  shippingAddress: CamelAddress | null
}

interface CamelCustomer {
  id: string | number
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  city?: string
  country?: string
  ordersCount?: number
  totalSpent?: string
  currency?: string
  tags?: string
  note?: string | null
  createdAt?: string
}

interface CustomerResponse {
  customer: CamelCustomer | null
  orders: CamelOrder[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(first?: string, last?: string): string {
  const f = (first?.[0] ?? '').toUpperCase()
  const l = (last?.[0] ?? '').toUpperCase()
  return (f + l) || '?'
}

function fullName(first?: string, last?: string): string {
  return [first, last].filter(Boolean).join(' ') || 'Unknown customer'
}

function addressLine(addr: CamelAddress): string {
  return [addr.address1, addr.address2, addr.city, addr.zip, addr.country]
    .filter(Boolean)
    .join(', ')
}

// ── Inline order row (camelCase shape) ───────────────────────────────────────

function InlineOrderRow({ order, token }: { order: CamelOrder; token: string }) {
  const [expanded, setExpanded] = useState(false)

  const isCancelled = order.cancelledAt != null
  const finStatus = isCancelled ? 'Cancelled' : order.financialStatus
  const fulStatus = order.fulfillmentStatus

  const finBadgeClass =
    finStatus === 'paid'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
      : finStatus === 'refunded'
      ? 'bg-red-500/15 text-red-400 border-red-500/20'
      : finStatus === 'Cancelled'
      ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20'
      : 'bg-amber-500/15 text-amber-400 border-amber-500/20'

  const fulBadgeClass =
    fulStatus === 'fulfilled'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
      : fulStatus === 'partial'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
      : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20'

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <span className="flex-1 text-xs font-bold text-foreground">{order.name}</span>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {fmtDate(order.createdAt)}
        </span>
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border capitalize shrink-0 ${finBadgeClass}`}
        >
          {finStatus}
        </span>
        <span className="text-xs font-bold shrink-0">
          {fmtPrice(order.totalPrice, order.currency)}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5 space-y-2">
          {/* Fulfillment status */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground min-w-[72px]">Fulfillment</span>
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border capitalize ${fulBadgeClass}`}
            >
              {fulStatus || 'unfulfilled'}
            </span>
          </div>

          {/* Line items */}
          {order.lineItems.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                Items ({order.lineItems.length})
              </p>
              <div className="rounded-lg border bg-muted/20 p-2 space-y-1">
                {order.lineItems.map(li => (
                  <div
                    key={li.id}
                    className="flex items-start justify-between gap-2 text-[11px]"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground leading-tight line-clamp-1">
                        {li.title}
                      </span>
                      {li.variantTitle && (
                        <span className="text-muted-foreground block">{li.variantTitle}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground shrink-0">×{li.quantity}</span>
                    <span className="font-semibold shrink-0">
                      {fmtPrice(Number(li.price) * li.quantity, order.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracking */}
          {order.fulfillments.length > 0 && order.fulfillments[0].trackingNumber && (
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground">Tracking</p>
              {order.fulfillments.slice(0, 1).map((f, i) => (
                <div key={i} className="text-[11px] space-y-0.5">
                  {f.trackingCompany && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[72px]">Carrier</span>
                      <span className="font-medium">{f.trackingCompany}</span>
                    </div>
                  )}
                  {f.trackingNumber && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[72px]">Number</span>
                      <span className="font-mono text-[10px] font-medium">{f.trackingNumber}</span>
                    </div>
                  )}
                  {f.trackingUrl && (
                    <a
                      href={f.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Track package
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Shipping address */}
          {order.shippingAddress && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Ship to</p>
              <p className="text-[11px] text-foreground">
                {addressLine(order.shippingAddress)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CustomerPanel() {
  const rawCustomer = useInboxStore(s => s.customer) as CustomerResponse | null
  const loadingCustomer = useInboxStore(s => s.loadingCustomer)
  const inbox = useInbox()
  const token = useAuthStore(s => s.session?.access_token ?? '')

  const [query, setQuery] = useState('')

  const cust = rawCustomer?.customer ?? null
  const orders: CamelOrder[] = rawCustomer?.orders ?? []

  function handleSearch() {
    const q = query.trim()
    if (!q) return
    inbox.custSearch(q)
  }

  function handleSearchChange(val: string) {
    setQuery(val)
  }

  function handleOrderSuccess(msg: string) {
    toast.success(msg)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3 shrink-0">
        <User size={15} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Customer</span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <SearchInput
            placeholder="Search by email or #order…"
            value={query}
            onChange={handleSearchChange}
            debounceMs={0}
          />
          {/* Hidden submit on Enter — achieved via wrapping form */}
        </div>
        <form
          className="hidden"
          onSubmit={e => {
            e.preventDefault()
            handleSearch()
          }}
        >
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearch()
              }
            }}
          />
        </form>
        {/* Enter key on the visible SearchInput */}
      </div>

      {/* Search submit hint */}
      <div className="px-3 pb-2 shrink-0">
        <button
          type="button"
          onClick={handleSearch}
          disabled={!query.trim() || loadingCustomer}
          className="w-full rounded-md border border-border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-40"
        >
          {loadingCustomer ? 'Searching…' : 'Press Enter or click to search'}
        </button>
      </div>

      <Separator className="shrink-0" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {loadingCustomer && (
          <div className="p-4">
            <LoadingState variant="cards" count={2} />
          </div>
        )}

        {/* No customer */}
        {!loadingCustomer && !cust && (
          <EmptyState
            icon={Search}
            title="No customer found"
            description="Search by email address or order number (e.g. #1234) to load customer data."
          />
        )}

        {/* Customer found */}
        {!loadingCustomer && cust && (
          <div className="space-y-0">
            {/* Customer card */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(cust.firstName, cust.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {fullName(cust.firstName, cust.lastName)}
                  </p>
                  {cust.email && (
                    <a
                      href={`mailto:${cust.email}`}
                      className="text-xs text-primary hover:underline truncate block"
                    >
                      {cust.email}
                    </a>
                  )}
                </div>
              </div>

              {/* Contact details */}
              <div className="space-y-1">
                {cust.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={11} className="shrink-0" />
                    <span>{cust.phone}</span>
                  </div>
                )}
                {(cust.city || cust.country) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={11} className="shrink-0" />
                    <span>{[cust.city, cust.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {cust.tags && cust.tags.trim() && (
                <div className="flex flex-wrap gap-1">
                  {cust.tags
                    .split(',')
                    .map(t => t.trim())
                    .filter(Boolean)
                    .map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        {tag}
                      </Badge>
                    ))}
                </div>
              )}

              {/* Customer note */}
              {cust.note && (
                <div className="rounded-lg border border-border bg-muted/20 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Note
                  </p>
                  <p className="text-xs italic text-muted-foreground leading-relaxed">
                    {cust.note}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-border bg-muted/20 px-0 py-0 shrink-0">
              <div className="flex flex-col items-center py-3 gap-0.5">
                <span className="text-sm font-extrabold text-foreground leading-none">
                  {cust.ordersCount ?? '—'}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  Orders
                </span>
              </div>
              <div className="flex flex-col items-center py-3 gap-0.5">
                <span className="text-sm font-extrabold text-foreground leading-none">
                  {cust.totalSpent != null
                    ? fmtPrice(cust.totalSpent, cust.currency)
                    : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  Spent
                </span>
              </div>
              <div className="flex flex-col items-center py-3 gap-0.5">
                <span className="text-sm font-extrabold text-foreground leading-none">
                  {cust.createdAt
                    ? new Date(cust.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  Since
                </span>
              </div>
            </div>

            <Separator />

            {/* Tabs */}
            <Tabs defaultValue="orders" className="w-full">
              <TabsList className="w-full rounded-none border-b border-border bg-transparent h-9 p-0">
                <TabsTrigger
                  value="orders"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-9"
                >
                  Orders
                  {orders.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-semibold">
                      {orders.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="info"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-9"
                >
                  Info
                </TabsTrigger>
              </TabsList>

              {/* Orders tab */}
              <TabsContent value="orders" className="mt-0 p-3 space-y-2">
                {orders.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No orders found for this customer.
                  </div>
                ) : (
                  orders.map(order => (
                    <InlineOrderRow
                      key={order.id}
                      order={order}
                      token={token}
                    />
                  ))
                )}
              </TabsContent>

              {/* Info tab */}
              <TabsContent value="info" className="mt-0 p-3 space-y-4">
                {/* Addresses */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Addresses
                  </p>
                  {/* Primary / default address derived from city/country */}
                  {(cust.city || cust.country) ? (
                    <div className="rounded-lg border border-border bg-muted/10 p-2.5 text-xs space-y-0.5">
                      <p className="font-medium text-foreground">
                        {fullName(cust.firstName, cust.lastName)}
                      </p>
                      {cust.city && <p className="text-muted-foreground">{cust.city}</p>}
                      {cust.country && <p className="text-muted-foreground">{cust.country}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No address on file.</p>
                  )}

                  {/* Shipping addresses from recent orders (unique by address1) */}
                  {(() => {
                    const seen = new Set<string>()
                    const addrs = orders
                      .map(o => o.shippingAddress)
                      .filter((a): a is CamelAddress => Boolean(a))
                      .filter(a => {
                        const key = addressLine(a)
                        if (seen.has(key)) return false
                        seen.add(key)
                        return true
                      })
                      .slice(0, 3)

                    if (addrs.length === 0) return null
                    return (
                      <div className="mt-2 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Shipping addresses
                        </p>
                        {addrs.map((a, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border bg-muted/10 p-2.5 text-xs space-y-0.5"
                          >
                            {(a.firstName || a.lastName) && (
                              <p className="font-medium text-foreground">
                                {[a.firstName, a.lastName].filter(Boolean).join(' ')}
                              </p>
                            )}
                            {a.address1 && <p className="text-muted-foreground">{a.address1}</p>}
                            {a.address2 && <p className="text-muted-foreground">{a.address2}</p>}
                            <p className="text-muted-foreground">
                              {[a.city, a.zip].filter(Boolean).join(', ')}
                            </p>
                            {a.country && <p className="text-muted-foreground">{a.country}</p>}
                            {a.phone && (
                              <p className="text-muted-foreground flex items-center gap-1">
                                <Phone size={10} />
                                {a.phone}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                <Separator />

                {/* Additional details */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Details
                  </p>
                  <div className="space-y-1.5">
                    {cust.email && (
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[11px] text-muted-foreground shrink-0 min-w-[80px]">
                          Email
                        </span>
                        <a
                          href={`mailto:${cust.email}`}
                          className="text-[11px] font-medium text-primary hover:underline text-right break-all"
                        >
                          {cust.email}
                        </a>
                      </div>
                    )}
                    {cust.phone && (
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[11px] text-muted-foreground shrink-0 min-w-[80px]">
                          Phone
                        </span>
                        <span className="text-[11px] font-medium text-right">{cust.phone}</span>
                      </div>
                    )}
                    {cust.createdAt && (
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[11px] text-muted-foreground shrink-0 min-w-[80px]">
                          Customer since
                        </span>
                        <span className="text-[11px] font-medium text-right">
                          {fmtDate(cust.createdAt)}
                        </span>
                      </div>
                    )}
                    {cust.ordersCount != null && (
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[11px] text-muted-foreground shrink-0 min-w-[80px]">
                          Orders
                        </span>
                        <span className="text-[11px] font-medium text-right">
                          {cust.ordersCount}
                        </span>
                      </div>
                    )}
                    {cust.totalSpent != null && (
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[11px] text-muted-foreground shrink-0 min-w-[80px]">
                          Total spent
                        </span>
                        <span className="text-[11px] font-bold text-foreground text-right">
                          {fmtPrice(cust.totalSpent, cust.currency)}
                        </span>
                      </div>
                    )}
                    {cust.tags && cust.tags.trim() && (
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[11px] text-muted-foreground shrink-0 min-w-[80px]">
                          Tags
                        </span>
                        <span className="text-[11px] font-medium text-right">{cust.tags}</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
