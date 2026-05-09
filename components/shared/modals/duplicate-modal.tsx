"use client"

import { useState } from "react"
import type { ShopifyOrder } from "@/types/inbox"
import { authFetch, fmtPrice } from "@/lib/inbox-utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Copy } from "lucide-react"

interface DuplicateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ShopifyOrder
  token: string
  onSuccess: (msg: string) => void
}

type DiscountType = "none" | "percentage" | "fixed"

export function DuplicateModal({ open, onOpenChange, order, token, onSuccess }: DuplicateModalProps) {
  const [note, setNote] = useState(`Duplicate of ${order.name}`)
  const [keepAddress, setKeepAddress] = useState(true)
  const [discountType, setDiscountType] = useState<DiscountType>("none")
  const [discountValue, setDiscountValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const originalTotal = Number(order.total_price) || 0
  const discountAmount =
    discountType === "percentage"
      ? originalTotal * (Number(discountValue) || 0) / 100
      : discountType === "fixed"
        ? Math.min(Number(discountValue) || 0, originalTotal)
        : 0
  const newTotal = Math.max(0, originalTotal - discountAmount)

  async function handleDuplicate() {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch(
        `/api/shopify/orders/${order.id}/duplicate`,
        {
          method: "POST",
          body: JSON.stringify({
            keepAddress,
            note,
            tags: "",
            discount: discountType !== "none"
              ? { type: discountType, value: Number(discountValue) }
              : undefined,
            discountType: discountType !== "none" ? discountType : undefined,
            discountValue: discountType !== "none" ? Number(discountValue) : undefined,
          }),
        },
        token,
      )
      const data = await res.json()
      setLoading(false)
      if (data.success) {
        onSuccess(`Draft ${data.draftOrder?.name || ""} created!`)
        onOpenChange(false)
      } else {
        setError(data.error || "Duplicate failed")
      }
    } catch {
      setLoading(false)
      setError("Network error")
    }
  }

  const DISCOUNT_OPTS: { v: DiscountType; l: string }[] = [
    { v: "none", l: "None" },
    { v: "percentage", l: "Percentage %" },
    { v: "fixed", l: "Fixed amount" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate &mdash; {order.name}</DialogTitle>
        </DialogHeader>

        {/* Products summary */}
        <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
          {(order.line_items || []).map(li => (
            <div key={li.id} className="flex items-center justify-between border-b border-border/50 py-1 last:border-0">
              <span className="text-xs text-muted-foreground">
                {li.quantity}&times; {li.title}
                {li.variant_title ? ` \u00b7 ${li.variant_title}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {fmtPrice(Number(li.price) * li.quantity, order.currency)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">Original</span>
            <span className="text-sm font-bold">{fmtPrice(originalTotal, order.currency)}</span>
          </div>
        </div>

        {/* Discount section */}
        <div className="space-y-2">
          <Label>Discount</Label>
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
            {DISCOUNT_OPTS.map(o => (
              <button
                key={o.v}
                type="button"
                onClick={() => { setDiscountType(o.v); setDiscountValue("") }}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  discountType === o.v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {discountType !== "none" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="flex-1"
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "e.g. 10" : "e.g. 5.00"}
                min="0"
                max={discountType === "percentage" ? "100" : undefined}
              />
              <span className="text-sm font-bold text-muted-foreground">
                {discountType === "percentage" ? "%" : "\u20ac"}
              </span>
            </div>
          )}
        </div>

        {/* New total preview */}
        {discountType !== "none" && Number(discountValue) > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Discount</p>
              <p className="text-sm font-bold text-rose-400">
                &minus; {fmtPrice(discountAmount, order.currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">New total</p>
              <p className="text-base font-extrabold text-emerald-500">
                {fmtPrice(newTotal, order.currency)}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Note</Label>
          <Input value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={keepAddress} onCheckedChange={() => setKeepAddress(v => !v)} />
          Copy shipping address
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Copy className="mr-2 size-4" />}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
