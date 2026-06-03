'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, Loader2, Plus, Search, X } from 'lucide-react'
import { authFetch, fmtPrice } from '@/lib/inbox-utils'
import { apiUrl } from '@/lib/api-client'
import { parseJson } from '@/lib/utils/typed-json'
import { useStoreStore } from '@/stores/store'
import { useProductSearch } from '@/hooks/inbox/use-shopify-products'
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
  customer: CreateOrderCustomer
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
  customer: CreateOrderCustomer
): { address: ShippingAddressState; hasPrefill: boolean } {
  const a = customer.defaultAddress
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
  customerName,
  token,
  onClose,
  onSuccess,
}: CreateOrderModalProps) {
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const currency = customer.currency || 'EUR'
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
  const [loading, setLoading] = useState(false)

  const { address: initialAddress, hasPrefill } = useMemo(
    () => prefillFromCustomer(customer),
    [customer]
  )
  const [address, setAddress] = useState<ShippingAddressState>(initialAddress)
  const [addressOpen, setAddressOpen] = useState(!hasPrefill)

  const {
    data: searchData,
    isFetching: isSearching,
    isError: searchErrored,
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
  const newTotal = Math.max(0, subtotal - discountAmount)

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

  const addressHasAnyField = (Object.values(address) as string[]).some(
    (v) => v.trim().length > 0
  )

  async function handleSubmit() {
    if (cart.length === 0) return
    setLoading(true)

    const body: Record<string, unknown> = {
      customerId: String(customer.id),
      lineItems: cart.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
      })),
    }
    if (addressHasAnyField) {
      body.shippingAddress = {
        firstName: address.firstName || undefined,
        lastName: address.lastName || undefined,
        address1: address.address1 || undefined,
        address2: address.address2 || undefined,
        city: address.city || undefined,
        province: address.province || undefined,
        country: address.country || undefined,
        zip: address.zip || undefined,
        phone: address.phone || undefined,
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

    try {
      const storeParam = activeStoreId ? `?store_id=${activeStoreId}` : ''
      const res = await authFetch(
        `${apiUrl('shopify/orders/create')}${storeParam}`,
        { method: 'POST', body: JSON.stringify(body) },
        token
      )
      const data = await parseJson<{
        success?: boolean
        error?: string
        draftOrder?: { name?: string }
      }>(res)

      if (data.success) {
        onSuccess(`Draft ${data.draftOrder?.name || ''} created!`)
      } else {
        onSuccess(data.error || 'Create order failed', 'error')
      }
    } catch {
      onSuccess('Create order failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const searchResults = searchData?.products ?? []
  const showSearchDropdown = searchInput.trim().length >= 2

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Create order — ${customerName}`}</DialogTitle>
        </DialogHeader>

        {/* Add products */}
        <div className="mb-3.5">
          <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
            Add products
          </label>
          <div className="relative">
            <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted-foreground flex pointer-events-none">
              <Search size={14} />
            </span>
            <Input
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] pl-9 text-[13.5px] text-foreground outline-none"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products..."
            />
          </div>
          {showSearchDropdown && (
            <div className="mt-1.5 border border-border rounded-xl bg-card max-h-[280px] overflow-y-auto thin-scrollbar">
              {isSearching && searchResults.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted-foreground flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  Searching...
                </div>
              )}
              {searchErrored && !isSearching && (
                <div className="px-3 py-2 text-[12px] text-rose-400">
                  Search failed — try again
                </div>
              )}
              {!isSearching &&
                !searchErrored &&
                searchResults.length === 0 && (
                  <div className="px-3 py-2 text-[12px] text-muted-foreground">
                    No products found
                  </div>
                )}
              {searchResults.flatMap((product) =>
                product.variants.map((variant) => (
                  <div
                    key={`${product.productId}_${variant.variantId}`}
                    className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                        {product.productTitle}
                        {variant.title && variant.title !== 'Default Title'
                          ? ` · ${variant.title}`
                          : ''}
                      </div>
                      {!variant.available && (
                        <span className="text-[10px] font-bold px-1.5 py-px rounded bg-[rgba(248,113,133,0.12)] text-[#fb7185] border border-[rgba(248,113,133,0.22)] tracking-[.04em] uppercase">
                          Out of stock
                        </span>
                      )}
                    </div>
                    <span className="text-[12.5px] text-foreground-2 shrink-0">
                      {fmtPrice(variant.price, currency)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addVariant(product, variant)}
                      className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md"
                    >
                      <Plus size={11} />
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <div className="mb-3.5">
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
              Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
            </label>
            <div className="bg-secondary border border-border rounded-xl px-3.5 py-2.5">
              {cart.map((line) => (
                <div
                  key={line.variantId}
                  className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-b-0"
                >
                  <span className="flex-1 text-[12.5px] text-foreground-2 overflow-hidden text-ellipsis whitespace-nowrap">
                    {line.productTitle}
                    {line.variantTitle && line.variantTitle !== 'Default Title'
                      ? ` · ${line.variantTitle}`
                      : ''}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeQty(line.variantId, -1)}
                      className="w-6 h-6 rounded-md border border-border bg-card text-foreground-2 text-xs leading-none cursor-pointer hover:bg-secondary"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="text-[12.5px] text-foreground w-6 text-center">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQty(line.variantId, 1)}
                      className="w-6 h-6 rounded-md border border-border bg-card text-foreground-2 text-xs leading-none cursor-pointer hover:bg-secondary"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[12.5px] text-foreground-2 shrink-0 w-16 text-right">
                    {fmtPrice(Number(line.price) * line.quantity, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(line.variantId)}
                    className="text-muted-foreground hover:text-rose-400 shrink-0"
                    aria-label="Remove line item"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1">
                <span className="text-[12.5px] text-foreground-2">Subtotal</span>
                <span className="text-[13px] font-bold text-foreground">
                  {fmtPrice(subtotal, currency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Discount */}
        <div className="mb-3.5">
          <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
            Discount
          </label>
          <div className={`flex gap-1.5 ${discountType !== 'none' ? 'mb-2.5' : 'mb-0'}`}>
            {[
              { v: 'none', l: 'None' },
              { v: 'percentage', l: 'Percentage %' },
              { v: 'fixed', l: 'Fixed amount' },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => {
                  setDiscountType(o.v as 'none' | 'percentage' | 'fixed')
                  setDiscountValue('')
                }}
                className={`flex-1 px-2 py-[7px] rounded-lg text-[11.5px] font-semibold font-[inherit] cursor-pointer transition-all border border-transparent ${
                  discountType === o.v
                    ? 'bg-foreground text-white'
                    : 'bg-input text-muted-foreground'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {discountType !== 'none' && (
            <div className="flex items-center gap-2.5">
              <Input
                type="number"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none flex-1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={
                  discountType === 'percentage' ? 'e.g. 10' : 'e.g. 5.00'
                }
                min="0"
                max={discountType === 'percentage' ? 100 : undefined}
              />
              <span className="text-[12.5px] font-bold text-foreground-2 shrink-0">
                {discountType === 'percentage' ? '%' : currencySymbol}
              </span>
            </div>
          )}
        </div>

        {discountType !== 'none' && Number(discountValue) > 0 && (
          <div className="bg-secondary border border-border rounded-xl px-3.5 py-2.5 mb-3.5 flex justify-between items-center">
            <div>
              <div className="text-[11px] text-muted-foreground mb-[2px]">
                After discount
              </div>
              <div className="text-[12.5px] font-bold text-rose-400">
                − {fmtPrice(discountAmount, currency)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground mb-[2px]">
                New total
              </div>
              <div className="text-[15px] font-extrabold text-green-400">
                {fmtPrice(newTotal, currency)}
              </div>
            </div>
          </div>
        )}

        {/* Shipping address */}
        <div className="mb-3.5">
          <button
            type="button"
            onClick={() => setAddressOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 mb-[7px] bg-transparent cursor-pointer text-left"
          >
            <span className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground flex-1">
              Shipping address {hasPrefill ? '(prefilled)' : ''}
            </span>
            <ChevronDown
              size={10}
              className={`transition-transform duration-200 text-muted-foreground ${
                addressOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>
          {addressOpen && (
            <div className="flex flex-col gap-1.5">
              {!hasPrefill && (
                <div className="text-[11px] text-muted-foreground italic mb-1">
                  No default address on file — fill in if shipping is needed.
                </div>
              )}
              <div className="flex gap-1.5">
                <Input
                  placeholder="First name"
                  value={address.firstName}
                  onChange={(e) => updateAddress('firstName', e.target.value)}
                  className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
                />
                <Input
                  placeholder="Last name"
                  value={address.lastName}
                  onChange={(e) => updateAddress('lastName', e.target.value)}
                  className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
                />
              </div>
              <Input
                placeholder="Address 1"
                value={address.address1}
                onChange={(e) => updateAddress('address1', e.target.value)}
                className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
              />
              <Input
                placeholder="Address 2"
                value={address.address2}
                onChange={(e) => updateAddress('address2', e.target.value)}
                className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
              />
              <div className="flex gap-1.5">
                <Input
                  placeholder="City"
                  value={address.city}
                  onChange={(e) => updateAddress('city', e.target.value)}
                  className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
                />
                <Input
                  placeholder="Province"
                  value={address.province}
                  onChange={(e) => updateAddress('province', e.target.value)}
                  className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
                />
              </div>
              <div className="flex gap-1.5">
                <Input
                  placeholder="ZIP"
                  value={address.zip}
                  onChange={(e) => updateAddress('zip', e.target.value)}
                  className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
                />
                <Input
                  placeholder="Country"
                  value={address.country}
                  onChange={(e) => updateAddress('country', e.target.value)}
                  className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
                />
              </div>
              <Input
                placeholder="Phone"
                value={address.phone}
                onChange={(e) => updateAddress('phone', e.target.value)}
                className="bg-secondary border border-border rounded-xl px-3 py-2 text-[12.5px]"
              />
            </div>
          )}
        </div>

        {/* Note */}
        <div className="mb-3.5">
          <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
            Note (optional)
          </label>
          <textarea
            className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none resize-y"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note for the draft order"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex items-center gap-[7px]"
            onClick={() => void handleSubmit()}
            disabled={loading || cart.length === 0}
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin text-white" />
            ) : (
              <span className="flex">
                <Plus size={12} />
              </span>
            )}
            {loading ? 'Creating...' : 'Create draft order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
