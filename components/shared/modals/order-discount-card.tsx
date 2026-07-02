'use client'

import { useState } from 'react'
import { Check, Percent, Tag } from 'lucide-react'
import { fmtPrice } from '@/lib/inbox-utils'

type DiscountType = 'none' | 'percentage' | 'fixed'

/**
 * Discount card + order totals — right column of Create Order (Figma 693:32590).
 * "Add shipping" reveals the shipping address form. VAT is excluded from the
 * order total — Shopify computes the real tax on the draft order. Promo codes are
 * omitted — the backend only accepts percentage/fixed discounts (BE task #5).
 */
export function OrderDiscountCard({
  currency,
  symbol,
  subtotal,
  discountType,
  discountValue,
  setDiscountType,
  setDiscountValue,
  discountAmount,
  total,
  shippingAdded,
  onAddShipping,
}: {
  currency: string
  symbol: string
  subtotal: number
  discountType: DiscountType
  discountValue: string
  setDiscountType: (t: DiscountType) => void
  setDiscountValue: (v: string) => void
  discountAmount: number
  total: number
  shippingAdded: boolean
  onAddShipping: () => void
}) {
  // "Add discount" checkbox reveals the Percentage / Fixed amount block.
  const [open, setOpen] = useState(discountType !== 'none')
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (!next) {
      setDiscountType('none')
      setDiscountValue('')
    }
  }

  return (
    <div className="flex w-[300px] shrink-0 flex-col gap-3.5">
      {/* Add discount */}
      <div className="flex flex-col gap-3">
        <button type="button" onClick={toggle} className="flex items-center gap-2.5">
          <span className={`flex size-5 items-center justify-center rounded-md border ${open ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>
            {open && <Check size={13} />}
          </span>
          <span className="text-[14px] font-semibold text-foreground">Add discount</span>
        </button>

        {open && (
          <div className="flex flex-col gap-3 rounded-[11px] border border-accent-border bg-accent-soft p-[13px]">
            <DiscountRow
              icon={<Percent size={16} />}
              label="Percentage"
              active={discountType === 'percentage'}
              onSelect={() => setDiscountType('percentage')}
              value={discountType === 'percentage' ? discountValue : ''}
              onChange={setDiscountValue}
              suffix="%"
              placeholder="0"
            />
            <DiscountRow
              icon={<Tag size={16} />}
              label="Fixed amount"
              active={discountType === 'fixed'}
              onSelect={() => setDiscountType('fixed')}
              value={discountType === 'fixed' ? discountValue : ''}
              onChange={setDiscountValue}
              prefix={symbol}
              placeholder="0.00"
            />
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex flex-col gap-2">
        <TotalRow label="Subtotal" value={fmtPrice(subtotal, currency)} />
        {discountAmount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-muted-foreground">Discount</span>
            <span className="text-[14px] text-[#10B981]">−{fmtPrice(discountAmount, currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          {shippingAdded ? (
            <span className="text-[14px] text-muted-foreground">Shipping</span>
          ) : (
            <button type="button" onClick={onAddShipping} className="text-[14px] font-medium text-primary hover:underline">
              Add shipping
            </button>
          )}
          <span className="text-[14px] text-foreground-2">—</span>
        </div>
        <div className="my-1 h-px bg-border" />
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-semibold text-foreground">Total</span>
          <span className="text-[16px] font-semibold text-foreground">{fmtPrice(total, currency)}</span>
        </div>
      </div>
    </div>
  )
}

function DiscountRow({
  icon,
  label,
  active,
  onSelect,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onSelect: () => void
  value: string
  onChange: (v: string) => void
  prefix?: string
  suffix?: string
  placeholder: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={onSelect} className={`flex items-center gap-2.5 text-[14px] ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
        <span className={active ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
        {label}
      </button>
      <div className={`flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1.5 ${active ? 'border-primary' : 'border-border'}`}>
        {prefix && <span className="text-[13px] text-muted-foreground">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => !active && onSelect()}
          inputMode="decimal"
          placeholder={placeholder}
          className="w-12 bg-transparent text-[13px] text-foreground outline-none"
        />
        {suffix && <span className="text-[13px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] text-muted-foreground">{label}</span>
      <span className="text-[14px] text-foreground-2">{value}</span>
    </div>
  )
}
