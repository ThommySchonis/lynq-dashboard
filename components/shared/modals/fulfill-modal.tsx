'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Truck } from 'lucide-react'
import { authFetch } from '@/lib/inbox-utils'

interface FulfillOrder {
  id: string
  name: string
  [key: string]: unknown
}

interface FulfillModalProps {
  order: FulfillOrder
  token: string
  onClose: () => void
  onSuccess: (msg: string, type?: string) => void
}

export function FulfillModal({ order, token, onClose, onSuccess }: FulfillModalProps) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCompany, setTrackingCompany] = useState("");
  const [notify, setNotify] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleFulfill() {
    setLoading(true);
    const res = await authFetch(
      `/api/shopify/orders/${order.id}/fulfill`,
      {
        method: "POST",
        body: JSON.stringify({ trackingNumber, trackingCompany, notify }),
      },
      token,
    );
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess("Order marked as fulfilled");
    else onSuccess(data.error || "Failed to fulfill order", "error");
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
          <DialogTitle>{`Fulfill order — ${order.name}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="bg-green-400/5 border border-green-400/15 rounded-xl px-3.5 py-2.5 text-[12.5px] text-green-400/80">
            All items will be marked as fulfilled.
          </div>
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Tracking number (optional)</label>
            <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. 3SBME123456789" />
          </div>
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Carrier (optional)</label>
            <Input className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none" value={trackingCompany} onChange={(e) => setTrackingCompany(e.target.value)} placeholder="e.g. PostNL, DHL, UPS…" />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={notify} onCheckedChange={() => setNotify((v) => !v)} />
            <span className="text-[13px] text-foreground-2">Send shipping confirmation to customer</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" className="" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex items-center gap-[7px]" onClick={handleFulfill} disabled={loading}>
            {loading ? (
              <Loader2 size={13} className="animate-spin text-white" />
            ) : (
              <span className="flex">
                <Truck size={12} />
              </span>
            )}
            Mark as fulfilled
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
