"use client"

import { useState } from "react"
import type { ShopifyOrder } from "@/types/inbox"
import { authFetch, CANCEL_REASONS } from "@/lib/inbox-utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface CancelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ShopifyOrder
  token: string
  onSuccess: (msg: string) => void
}

export function CancelModal({ open, onOpenChange, order, token, onSuccess }: CancelModalProps) {
  const [reason, setReason] = useState("customer")
  const [restock, setRestock] = useState(true)
  const [notify, setNotify] = useState(true)
  const [refund, setRefund] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleCancel() {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch(
        `/api/shopify/orders/${order.id}/cancel`,
        { method: "POST", body: JSON.stringify({ reason, restock, email: notify, refund }) },
        token,
      )
      const data = await res.json()
      setLoading(false)
      if (data.success) {
        onSuccess("Order cancelled")
        onOpenChange(false)
      } else {
        setError(data.error || "Failed to cancel order")
      }
    } catch {
      setLoading(false)
      setError("Network error")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel order &mdash; {order.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Reason for cancellation</Label>
          <Select value={reason} onValueChange={(v) => setReason(v ?? "customer")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANCEL_REASONS.map(r => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={restock} onCheckedChange={() => setRestock(v => !v)} />
            Restock items
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={() => setNotify(v => !v)} />
            Notify customer
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={refund} onCheckedChange={() => setRefund(v => !v)} />
            Refund payment
          </label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
