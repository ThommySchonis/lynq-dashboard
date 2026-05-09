"use client"

import { useState, useEffect } from "react"
import type { ShopifyOrder } from "@/types/inbox"
import { authFetch, fmtPrice, REFUND_REASONS } from "@/lib/inbox-utils"
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Loader2, Minus, Plus } from "lucide-react"

interface RefundModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ShopifyOrder
  token: string
  onSuccess: (msg: string) => void
}

type RefundMode = "items" | "full" | "custom"

export function RefundModal({ open, onOpenChange, order, token, onSuccess }: RefundModalProps) {
  const [mode, setMode] = useState<RefundMode>("items")
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [customAmount, setCustomAmount] = useState("")
  const [restock, setRestock] = useState(false)
  const [notify, setNotify] = useState(true)
  const [shipping, setShipping] = useState(false)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (mode === "full") {
      setQtys(Object.fromEntries((order.line_items || []).map(li => [li.id, li.quantity])))
    } else if (mode === "items") {
      setQtys(Object.fromEntries((order.line_items || []).map(li => [li.id, 0])))
    }
  }, [mode, order.line_items])

  const itemsTotal = (order.line_items || []).reduce(
    (sum, li) => sum + (qtys[li.id] || 0) * Number(li.price),
    0,
  )
  const totalRefund = mode === "custom" ? Number(customAmount) || 0 : itemsTotal
  const canSubmit = reason && (mode === "custom" ? Number(customAmount) > 0 : totalRefund > 0)

  async function handleRefund() {
    setLoading(true)
    setError("")
    try {
      let body
      if (mode === "custom") {
        body = { customAmount: Number(customAmount), notify, reason }
      } else {
        const line_items = (order.line_items || [])
          .filter(li => qtys[li.id] > 0)
          .map(li => ({ lineItemId: li.id, quantity: qtys[li.id] }))
        body = { line_items, restock, notify, reason, shipping }
      }
      const res = await authFetch(
        `/api/shopify/orders/${order.id}/refund`,
        { method: "POST", body: JSON.stringify(body) },
        token,
      )
      const data = await res.json()
      setLoading(false)
      if (data.success) {
        onSuccess("Refund processed!")
        onOpenChange(false)
      } else {
        setError(data.error || "Refund failed")
      }
    } catch {
      setLoading(false)
      setError("Network error")
    }
  }

  const MODES: { v: RefundMode; l: string }[] = [
    { v: "items", l: "By items" },
    { v: "full", l: "Full refund" },
    { v: "custom", l: "Custom amount" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund &mdash; {order.name}</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
          {MODES.map(o => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === o.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>

        {/* Custom amount input */}
        {mode === "custom" && (
          <div className="space-y-1.5">
            <Label>Refund amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                &euro;
              </span>
              <Input
                type="number"
                className="pl-7"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                max={order.total_price}
                autoFocus
              />
            </div>
            {Number(customAmount) > 0 && (
              <p className="text-xs text-muted-foreground">
                Max: <span className="font-semibold text-foreground">{fmtPrice(order.total_price, order.currency)}</span>
              </p>
            )}
          </div>
        )}

        {/* Line items table */}
        {mode !== "custom" && (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-b pb-2 text-xs font-medium text-muted-foreground">
              <span>Product</span>
              <span>Price</span>
              <span className="min-w-[80px] text-center">Qty</span>
              <span className="text-right">Total</span>
            </div>
            {(order.line_items || []).map(li => (
              <div key={li.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 py-1.5">
                <div>
                  <p className="text-sm font-semibold">{li.title}</p>
                  {li.variant_title && (
                    <p className="text-xs text-muted-foreground">{li.variant_title}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{fmtPrice(li.price, order.currency)}</span>
                <div className="flex min-w-[80px] items-center justify-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setQtys(q => ({ ...q, [li.id]: Math.max(0, q[li.id] - 1) }))}
                    disabled={!qtys[li.id] || mode === "full"}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="min-w-[20px] text-center text-sm font-semibold">{qtys[li.id] || 0}</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setQtys(q => ({ ...q, [li.id]: Math.min(li.quantity, q[li.id] + 1) }))}
                    disabled={qtys[li.id] >= li.quantity || mode === "full"}
                  >
                    <Plus className="size-3" />
                  </Button>
                  <span className="text-[11px] text-muted-foreground">/{li.quantity}</span>
                </div>
                <span className="min-w-[60px] text-right text-sm font-bold">
                  {fmtPrice((qtys[li.id] || 0) * Number(li.price), order.currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Checkboxes */}
        <div className="space-y-3">
          {mode !== "custom" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={restock} onCheckedChange={() => setRestock(v => !v)} />
              Restock items
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={() => setNotify(v => !v)} />
            Notify customer
          </label>
          {mode !== "custom" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={shipping} onCheckedChange={() => setShipping(v => !v)} />
              Refund shipping costs
            </label>
          )}
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              {REFUND_REASONS.map(r => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Refund total */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Refund total</span>
            <span className={`text-base font-extrabold ${totalRefund > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
              {fmtPrice(totalRefund, order.currency)}
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRefund} disabled={loading || !canSubmit}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Process refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
