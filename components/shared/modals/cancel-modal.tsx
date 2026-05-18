'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { authFetch, CANCEL_REASONS } from '@/lib/inbox-utils'
import { parseJson } from '@/lib/utils/typed-json'

export interface CancelOrder {
  id: string
  name: string
  [key: string]: unknown
}

interface CancelModalProps {
  order: CancelOrder
  token: string
  onClose: () => void
  onSuccess: (msg: string, type?: string) => void
}

export function CancelModal({ order, token, onClose, onSuccess }: CancelModalProps) {
  const [reason, setReason] = useState("customer");
  const [restock, setRestock] = useState(true);
  const [notify, setNotify] = useState(true);
  const [refund, setRefund] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    const res = await authFetch(
      `/api/shopify/orders/${order.id}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason, restock, notify, refund }),
      },
      token,
    );
    const data = await parseJson<{ success?: boolean; error?: string }>(res);
    setLoading(false);
    if (data.success) onSuccess("Order cancelled");
    else onSuccess(data.error || "Failed to cancel order", "error");
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
          <DialogTitle>{`Cancel order — ${order.name}`}</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Reason for cancellation</label>
          <select className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none cursor-pointer" value={reason} onChange={(e) => setReason(e.target.value)}>
            {CANCEL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-3 mb-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={restock} onCheckedChange={() => setRestock((v) => !v)} />
            <span className="text-[13px] text-foreground-2">Restock items</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={notify} onCheckedChange={() => setNotify((v) => !v)} />
            <span className="text-[13px] text-foreground-2">Notify customer</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={refund} onCheckedChange={() => setRefund((v) => !v)} />
            <span className="text-[13px] text-foreground-2">Refund payment</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" className="" onClick={onClose}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={() => void handleCancel()} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
