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
import { Loader2 } from "lucide-react"

interface EditAddressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ShopifyOrder
  token: string
  onSuccess: (msg: string) => void
}

export function EditAddressModal({ open, onOpenChange, order, token, onSuccess }: EditAddressModalProps) {
  const sa = order.shipping_address
  const [form, setForm] = useState({
    firstName: sa?.first_name || "",
    lastName: sa?.last_name || "",
    address1: sa?.address1 || "",
    address2: sa?.address2 || "",
    city: sa?.city || "",
    zip: sa?.zip || "",
    country: sa?.country || "",
    phone: sa?.phone || "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch(
        `/api/shopify/orders/${order.id}/address`,
        { method: "PUT", body: JSON.stringify({ address: form }) },
        token,
      )
      const data = await res.json()
      setLoading(false)
      if (data.success) {
        onSuccess("Address updated")
        onOpenChange(false)
      } else {
        setError(data.error || "Failed to save address")
      }
    } catch {
      setLoading(false)
      setError("Network error")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit address &mdash; {order.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={form.firstName} onChange={e => set("firstName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={form.lastName} onChange={e => set("lastName", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address line 1</Label>
            <Input value={form.address1} onChange={e => set("address1", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Address line 2 (optional)</Label>
            <Input value={form.address2} onChange={e => set("address2", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Zip code</Label>
              <Input value={form.zip} onChange={e => set("zip", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country} onChange={e => set("country", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
