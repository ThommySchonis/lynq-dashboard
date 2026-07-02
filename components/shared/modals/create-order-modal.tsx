'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Minus, Plus, Search, X } from 'lucide-react'
import { authFetch, fmtPrice } from '@/lib/inbox-utils'
import { apiUrl } from '@/lib/api-client'
import { parseJson } from '@/lib/utils/typed-json'
import { useStoreStore } from '@/stores/store'
import { useProductSearch } from '@/hooks/inbox/use-shopify-products'
import { OrderDiscountCard } from './order-discount-card'

// The Figma frame (693:32590) assumes a matched customer and has no top
// customer block. Kept behind this flag for the no-customer fallback (the
// backend needs an email when there's no customerId); typed boolean to keep
// dead-branch lint quiet.
const SHOW_LEGACY: boolean = false
import type {
  ProductSearchResult,
  ProductSearchVariant,
} from '@/hooks/inbox/use-shopify-products'

export interface CreateOrderCustomer {
  id: string | number
  email?: string
  currency?: string
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
}

interface CartLine {
  variantId: string
  productTitle: string
  variantTitle: string
  price: string
  quantity: number
}

interface ShippingAddressState {
  firstName: string
  lastName: string
  address1: string
  address2: string
  city: string
  province: string
  country: string
  zip: string
  phone: string
}

interface CreateOrderModalProps {
  customer?: CreateOrderCustomer
  customerEmail?: string
  customerName: string
  token: string
  onClose: () => void
  onSuccess: (msg: string, type?: string) => void
}

function emptyAddress(): ShippingAddressState {
  return {
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    province: '',
    country: '',
    zip: '',
    phone: '',
  }
}

function prefillFromCustomer(
  customer?: CreateOrderCustomer
): { address: ShippingAddressState; hasPrefill: boolean } {
  const a = customer?.defaultAddress
  if (!a) return { address: emptyAddress(), hasPrefill: false }
  return {
    address: {
      firstName: a.firstName ?? '',
      lastName: a.lastName ?? '',
      address1: a.address1 ?? '',
      address2: a.address2 ?? '',
      city: a.city ?? '',
      province: a.province ?? '',
      country: a.country ?? '',
      zip: a.zip ?? '',
      phone: a.phone ?? '',
    },
    hasPrefill: true,
  }
}

export function CreateOrderModal({
  customer,
  customerEmail,
  customerName,
  token,
  onClose,
  onSuccess,
}: CreateOrderModalProps) {
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const hasCustomer = !!customer?.id
  const currency = customer?.currency || 'EUR'
  const currencySymbol = useMemo(
    () =>
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(0)
        .replace(/\d/g, '')
        .trim() || currency,
    [currency]
  )

  const [searchInput, setSearchInput] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discountType, setDiscountType] = useState<
    'none' | 'percentage' | 'fixed'
  >('none')
  const [discountValue, setDiscountValue] = useState('')
  const [note, setNote] = useState('')
  const [invoiceSubject, setInvoiceSubject] = useState('')
  const [invoiceMessage, setInvoiceMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [productFieldFocused, setProductFieldFocused] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const scrollBoxRef = useRef<HTMLDivElement | null>(null)

  // Manual customer entry — used only when there is no matched Shopify customer.
  const [email, setEmail] = useState(customer?.email ?? customerEmail ?? '')
  const [name, setName] = useState(customerName)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const { address: initialAddress, hasPrefill } = useMemo(
    () => prefillFromCustomer(customer),
    [customer]
  )
  const [address, setAddress] = useState<ShippingAddressState>(initialAddress)
  const [showShipping, setShowShipping] = useState(hasPrefill)
  const [tags, setTags] = useState('')

  const {
    data: searchData,
    isFetching: isSearching,
    isError: searchErrored,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProductSearch(searchInput)

  const subtotal = cart.reduce(
    (sum, line) => sum + Number(line.price) * line.quantity,
    0
  )
  const discountAmount =
    discountType === 'percentage'
      ? (subtotal * (Number(discountValue) || 0)) / 100
      : discountType === 'fixed'
        ? Math.min(Number(discountValue) || 0, subtotal)
        : 0
  // Order total excludes VAT — Shopify computes the real tax on the draft order.
  const grandTotal = Math.max(0, subtotal - discountAmount)

  function addVariant(
    product: ProductSearchResult,
    variant: ProductSearchVariant
  ) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.variantId)
      if (existing) {
        return prev.map((l) =>
          l.variantId === variant.variantId
            ? { ...l, quantity: Math.min(l.quantity + 1, 999) }
            : l
        )
      }
      return [
        ...prev,
        {
          variantId: variant.variantId,
          productTitle: product.productTitle,
          variantTitle: variant.title,
          price: variant.price,
          quantity: 1,
        },
      ]
    })
    setSearchInput('')
  }

  function changeQty(variantId: string, delta: number) {
    setCart((prev) =>
      prev.map((l) =>
        l.variantId === variantId
          ? { ...l, quantity: Math.min(Math.max(l.quantity + delta, 1), 999) }
          : l
      )
    )
  }

  function removeLine(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId))
  }

  function updateAddress<K extends keyof ShippingAddressState>(
    key: K,
    value: string
  ) {
    setAddress((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (cart.length === 0) return
    setLoading(true)

    const body: Record<string, unknown> = {
      lineItems: cart.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
      })),
    }
    if (hasCustomer) {
      body.customerId = String(customer!.id)
    } else {
      body.email = email.trim()
    }

    // When there is no matched customer, fall back to the manually entered name
    // for the shipping address so it isn't lost (spec: name feeds the address).
    const nameParts = name.trim().split(/\s+/).filter(Boolean)
    const shipping = {
      ...address,
      firstName:
        address.firstName || (!hasCustomer ? nameParts[0] ?? '' : ''),
      lastName:
        address.lastName ||
        (!hasCustomer && nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''),
    }
    const shippingHasAnyField = (Object.values(shipping) as string[]).some(
      (v) => v.trim().length > 0
    )
    if (shippingHasAnyField) {
      body.shippingAddress = {
        firstName: shipping.firstName || undefined,
        lastName: shipping.lastName || undefined,
        address1: shipping.address1 || undefined,
        address2: shipping.address2 || undefined,
        city: shipping.city || undefined,
        province: shipping.province || undefined,
        country: shipping.country || undefined,
        zip: shipping.zip || undefined,
        phone: shipping.phone || undefined,
      }
    }
    if (
      discountType !== 'none' &&
      discountValue &&
      Number(discountValue) > 0
    ) {
      body.discount = { type: discountType, value: Number(discountValue) }
    }
    if (note.trim()) body.note = note.trim()
    if (invoiceSubject.trim()) body.invoiceSubject = invoiceSubject.trim()
    if (invoiceMessage.trim()) body.invoiceMessage = invoiceMessage.trim()
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    if (tagList.length) body.tags = tagList

    try {
      const storeParam = activeStoreId ? `?store_id=${activeStoreId}` : ''
      const res = await authFetch(
        `${apiUrl('shopify/orders/create')}${storeParam}`,
        { method: 'POST', body: JSON.stringify(body) },
        token
      )
      const data = await parseJson<{
        error?: string
        draftOrder?: { name?: string }
        invoiceSent?: boolean
      }>(res)

      if (res.ok) {
        const name = data.draftOrder?.name || ''
        if (data.invoiceSent) {
          onSuccess(`Draft ${name} created & invoice sent`)
        } else {
          onSuccess(
            `Draft ${name} created, but invoice email failed — resend it in Shopify`,
            'warning'
          )
        }
      } else {
        onSuccess(data.error || 'Create order failed', 'error')
      }
    } catch {
      onSuccess('Create order failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const searchResults = searchData?.pages.flatMap((p) => p.products) ?? []
  const showSearchDropdown = productFieldFocused || searchInput.trim().length > 0

  useEffect(() => {
    if (!showSearchDropdown) return
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { root: scrollBoxRef.current, rootMargin: '120px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [showSearchDropdown, hasNextPage, isFetchingNextPage, fetchNextPage, searchResults.length])

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-[760px] gap-0 overflow-hidden p-0">
        <DialogHeader className="px-7 py-[22px]">
          <DialogTitle className="text-lg font-bold">Create order</DialogTitle>
        </DialogHeader>
        <div className="h-px bg-border" />

        <div className="thin-scrollbar flex max-h-[68vh] flex-col gap-6 overflow-y-auto px-7 py-6">
          {/* No-customer fallback — email needed by the backend (not in Figma) */}
          {SHOW_LEGACY && !hasCustomer && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground">Customer</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (required)"
                className="rounded-[10px] border border-border bg-card"
              />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional)"
                className="rounded-[10px] border border-border bg-card"
              />
              {!emailValid && email.trim().length > 0 && <span className="text-[11px] text-rose-400">Enter a valid email address.</span>}
            </div>
          )}

          {/* Product search + add custom item */}
          <div className="flex items-start gap-3">
            <div className="relative flex-1">
            <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-border bg-card px-3.5">
              <Search size={15} className="shrink-0 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setProductFieldFocused(true)}
                onBlur={() => setTimeout(() => setProductFieldFocused(false), 150)}
                placeholder="Search products…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-4"
              />
            </div>
            {showSearchDropdown && (
              <div ref={scrollBoxRef} className="thin-scrollbar absolute z-10 mt-1.5 max-h-[280px] w-full overflow-y-auto rounded-[10px] border border-border bg-card shadow-lg">
                {isSearching && searchResults.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" /> Searching…
                  </div>
                )}
                {searchErrored && !isSearching && <div className="px-3 py-2 text-[12px] text-rose-400">Search failed — try again</div>}
                {!isSearching && !searchErrored && searchResults.length === 0 && <div className="px-3 py-2 text-[12px] text-muted-foreground">No products found</div>}
                {searchResults.flatMap((product) =>
                  product.variants.map((variant) => (
                    <div key={`${product.productId}_${variant.variantId}`} className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] text-foreground">
                          {product.productTitle}
                          {variant.title && variant.title !== 'Default Title' ? ` · ${variant.title}` : ''}
                        </div>
                        {!variant.available && <span className="text-[10px] font-bold uppercase tracking-[.04em] text-rose-400">Out of stock</span>}
                      </div>
                      <span className="shrink-0 text-[12.5px] text-foreground-2">{fmtPrice(variant.price, currency)}</span>
                      <Button variant="outline" size="sm" onClick={() => addVariant(product, variant)} className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium">
                        <Plus size={11} /> Add
                      </Button>
                    </div>
                  )),
                )}
                <div ref={loadMoreRef} />
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" /> Loading more…
                  </div>
                )}
              </div>
            )}
            </div>
            <Button
              variant="outline"
              disabled
              title="Custom items need backend support"
              className="h-11 shrink-0 gap-1.5 rounded-[10px] border-foreground/80 px-5 text-sm font-semibold"
            >
              <Plus size={14} /> Add custom item
            </Button>
          </div>

          {/* Product table */}
          <div className="flex flex-col">
            <div className="flex items-center gap-4 px-0.5 pb-3 text-[12px] font-semibold uppercase tracking-[.08em] text-foreground-4">
              <span className="flex-1">Product</span>
              <span className="w-[90px]">In stock</span>
              <span className="w-[90px]">Item price</span>
              <span className="w-[100px]">Qty</span>
              <span className="w-[90px] text-right">Item total</span>
            </div>
            <div className="h-px bg-border" />
            {cart.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Search products to add them to the order</div>
            ) : (
              cart.map((line) => (
                <div key={line.variantId} className="flex items-center gap-4 border-b border-border py-3.5 last:border-b-0">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-violet-100 text-base font-semibold text-primary">
                      {line.productTitle.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{line.productTitle}</div>
                      {line.variantTitle && line.variantTitle !== 'Default Title' && (
                        <div className="truncate text-[12px] text-muted-foreground">{line.variantTitle}</div>
                      )}
                    </div>
                  </div>
                  <span className="w-[90px] text-sm text-muted-foreground">—</span>
                  <span className="w-[90px] text-sm text-foreground-2">{fmtPrice(line.price, currency)}</span>
                  <div className="w-[100px]">
                    <div className="flex h-8 w-24 items-stretch rounded-lg border border-border">
                      <button type="button" onClick={() => changeQty(line.variantId, -1)} className="flex w-7 items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Decrease quantity">
                        <Minus size={12} />
                      </button>
                      <div className="flex flex-1 items-center justify-center border-x border-border text-sm font-semibold text-foreground">{line.quantity}</div>
                      <button type="button" onClick={() => changeQty(line.variantId, 1)} className="flex w-7 items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Increase quantity">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex w-[90px] items-center justify-end gap-2">
                    <span className="text-sm font-semibold text-foreground">{fmtPrice(Number(line.price) * line.quantity, currency)}</span>
                    <button type="button" onClick={() => removeLine(line.variantId)} className="text-muted-foreground hover:text-rose-400" aria-label="Remove line item">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
            <div className="h-px bg-border" />
          </div>

          {/* Notes + Tags (left) + discount/totals (right) */}
          <div className="flex gap-12">
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">Notes</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note…"
                  className="min-h-[72px] resize-y rounded-[10px] border border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">Tags</span>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Add tags…"
                  className="rounded-[10px] border border-border bg-card"
                />
              </div>
            </div>
            <OrderDiscountCard
              currency={currency}
              symbol={currencySymbol}
              subtotal={subtotal}
              discountType={discountType}
              discountValue={discountValue}
              setDiscountType={(t) => {
                setDiscountType(t)
                setDiscountValue('')
              }}
              setDiscountValue={setDiscountValue}
              discountAmount={discountAmount}
              total={grandTotal}
              shippingAdded={showShipping}
              onAddShipping={() => setShowShipping(true)}
            />
          </div>

          {/* Invoice email — optional overrides; blank uses Shopify's default template */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">Invoice email (optional)</span>
            <Input
              value={invoiceSubject}
              onChange={(e) => setInvoiceSubject(e.target.value)}
              placeholder="Subject — leave blank for Shopify default"
              className="rounded-[10px] border border-border bg-card"
            />
            <textarea
              value={invoiceMessage}
              onChange={(e) => setInvoiceMessage(e.target.value)}
              placeholder="Message — leave blank for Shopify default"
              className="min-h-[72px] resize-y rounded-[10px] border border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none"
            />
          </div>

          {/* Shipping address — revealed by "Add shipping" (or prefilled) */}
          {showShipping && (
            <div>
              <div className="mb-[7px] flex items-center gap-1.5">
                <span className="flex-1 text-[10.5px] font-bold uppercase tracking-[.07em] text-muted-foreground">Shipping address {hasPrefill ? '(prefilled)' : ''}</span>
              </div>
              <div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <Input placeholder="First name" value={address.firstName} onChange={(e) => updateAddress('firstName', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                    <Input placeholder="Last name" value={address.lastName} onChange={(e) => updateAddress('lastName', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                  </div>
                  <Input placeholder="Address 1" value={address.address1} onChange={(e) => updateAddress('address1', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                  <Input placeholder="Address 2" value={address.address2} onChange={(e) => updateAddress('address2', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                  <div className="flex gap-1.5">
                    <Input placeholder="City" value={address.city} onChange={(e) => updateAddress('city', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                    <Input placeholder="Province" value={address.province} onChange={(e) => updateAddress('province', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                  </div>
                  <div className="flex gap-1.5">
                    <Input placeholder="ZIP" value={address.zip} onChange={(e) => updateAddress('zip', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                    <Input placeholder="Country" value={address.country} onChange={(e) => updateAddress('country', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                  </div>
                  <Input placeholder="Phone" value={address.phone} onChange={(e) => updateAddress('phone', e.target.value)} className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between gap-3 bg-[#FAF9FF] px-7 py-[18px] dark:bg-[rgba(255,255,255,0.03)]">
          <span className="text-sm text-muted-foreground">Create draft order &amp; send Shopify invoice</span>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void handleSubmit()} disabled={loading || cart.length === 0 || (!hasCustomer && !emailValid)}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : 'Create Draft order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
