"use client"

import { useState } from "react"
import type { ShopifyOrder } from "@/types/inbox"
import { authFetch } from "@/lib/inbox-utils"
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
import { Loader2, Truck } from "lucide-react"

interface FulfillModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ShopifyOrder
  token: string
  onSuccess: (msg: string) => void
}

export function FulfillModal({ open, onOpenChange, order, token, onSuccess }: FulfillModalProps) {
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingCompany, setTrackingCompany] = useState("")
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleFulfill() {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch(
        `/api/shopify/orders/${order.id}/fulfill`,
        {
          method: "POST",
          body: JSON.stringify({
            tracking_number: trackingNumber,
            tracking_company: trackingCompany,
            notify_customer: notifyCustomer,
          }),
        },
        token,
      )
      const data = await res.json()
      setLoading(false)
      if (data.success) {
        onSuccess("Order marked as fulfilled")
        onOpenChange(false)
      } else {
        setError(data.error || "Failed to fulfill order")
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
          <DialogTitle>Fulfill order &mdash; {order.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
            All items will be marked as fulfilled.
          </div>

          <div className="space-y-1.5">
            <Label>Tracking number (optional)</Label>
            <Input
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="e.g. 3SBME123456789"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Carrier (optional)</Label>
            <Input
              value={trackingCompany}
              onChange={e => setTrackingCompany(e.target.value)}
              placeholder="e.g. PostNL, DHL, UPS..."
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notifyCustomer} onCheckedChange={() => setNotifyCustomer(v => !v)} />
            Send shipping confirmation to customer
          </label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleFulfill} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Truck className="mr-2 size-4" />}
            Mark as fulfilled
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
