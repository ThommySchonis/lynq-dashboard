'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { authFetch } from '@/lib/inbox-utils'

interface AddressFields {
  firstName?: string
  lastName?: string
  address1?: string
  address2?: string
  city?: string
  zip?: string
  country?: string
  countryCode?: string
  phone?: string
  [key: string]: unknown
}

interface EditAddressOrder {
  id: string
  name: string
  shippingAddress?: AddressFields | null
  [key: string]: unknown
}

interface EditAddressModalProps {
  order: EditAddressOrder
  token: string
  onClose: () => void
  onSuccess: (msg: string, type?: string) => void
}

export function EditAddressModal({ order, token, onClose, onSuccess }: EditAddressModalProps) {
  const sa: AddressFields = order.shippingAddress || {};
  const [form, setForm] = useState({
    firstName: sa.firstName || "",
    lastName: sa.lastName || "",
    address1: sa.address1 || "",
    address2: sa.address2 || "",
    city: sa.city || "",
    zip: sa.zip || "",
    country: sa.country || "",
    countryCode: sa.countryCode || "",
    phone: sa.phone || "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    setLoading(true);
    const res = await authFetch(`/api/shopify/orders/${order.id}/address`, { method: "PUT", body: JSON.stringify(form) }, token);
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess("Address updated");
    else onSuccess(data.error || "Failed to save address", "error");
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Edit address — ${order.name}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">First name</label>
              <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Last name</label>
              <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Address line 1</label>
            <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={form.address1} onChange={(e) => set("address1", e.target.value)} />
          </div>
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Address line 2 (optional)</label>
            <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={form.address2} onChange={(e) => set("address2", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">City</label>
              <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Zip code</label>
              <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Country</label>
              <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Phone</label>
              <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="" onClick={onClose}>
            Cancel
          </Button>
          <Button className="" onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
