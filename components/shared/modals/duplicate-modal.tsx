// @ts-nocheck
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Copy, Loader2 } from 'lucide-react'
import { authFetch, fmtPrice } from '@/lib/inbox-utils'

export function DuplicateModal({ order, token, onClose, onSuccess }) {
  const [note, setNote] = useState(`Duplicate of ${order.name}`);
  const [keepAddress, setKeepAddress] = useState(true);
  const [discountType, setDiscountType] = useState("none"); // 'none' | 'percentage' | 'fixed'
  const [discountValue, setDiscountValue] = useState("");
  const [loading, setLoading] = useState(false);

  const originalTotal = Number(order.totalPrice) || 0;
  const discountAmount =
    discountType === "percentage"
      ? (originalTotal * (Number(discountValue) || 0)) / 100
      : discountType === "fixed"
        ? Math.min(Number(discountValue) || 0, originalTotal)
        : 0;
  const newTotal = Math.max(0, originalTotal - discountAmount);

  async function handleDuplicate() {
    setLoading(true);
    const res = await authFetch(
      `/api/shopify/orders/${order.id}/duplicate`,
      {
        method: "POST",
        body: JSON.stringify({
          keepAddress,
          note,
          tags: "",
          discountType: discountType !== "none" ? discountType : undefined,
          discountValue: discountType !== "none" ? Number(discountValue) : undefined,
        }),
      },
      token,
    );
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess(`Draft ${data.draftOrder?.name || ""} created!`);
    else onSuccess(data.error || "Duplicate failed", "error");
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
          <DialogTitle>{`Duplicate — ${order.name}`}</DialogTitle>
        </DialogHeader>
        {/* Products */}
        <div className="bg-(--bg-surface-2) border border-border rounded-xl px-3.5 py-2.5 mb-3.5">
          {(order.lineItems || []).map((li) => (
            <div key={li.id} className="flex justify-between py-[5px] border-b border-white/5">
              <span className="text-[12.5px] text-(--text-2)">
                {li.quantity}× {li.title}
                {li.variantTitle ? ` · ${li.variantTitle}` : ""}
              </span>
              <span className="text-[12.5px] text-(--text-2)">{fmtPrice(Number(li.price) * li.quantity, order.currency)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-1">
            <span className="text-[12.5px] text-(--text-2)">Original</span>
            <span className="text-[13px] font-bold text-(--text-1)">{fmtPrice(originalTotal, order.currency)}</span>
          </div>
        </div>

        {/* Discount section */}
        <div className="mb-3.5">
          <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-(--text-3) mb-[7px] block">Discount</label>
          <div className={`flex gap-1.5 ${discountType !== "none" ? "mb-2.5" : "mb-0"}`}>
            {[
              { v: "none", l: "None" },
              { v: "percentage", l: "Percentage %" },
              { v: "fixed", l: "Fixed amount" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => {
                  setDiscountType(o.v);
                  setDiscountValue("");
                }}
                className={`flex-1 px-2 py-[7px] rounded-lg text-[11.5px] font-semibold font-[inherit] cursor-pointer transition-all border border-transparent ${discountType === o.v ? "bg-(--text-1) text-white" : "bg-(--bg-input) text-(--text-3)"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {discountType !== "none" && (
            <div className="flex items-center gap-2.5">
              <Input
                type="number"
                className="w-full bg-(--bg-surface-2) border border-(--border) rounded-xl px-3.5 py-[11px] text-[13.5px] text-(--text-1) outline-none flex-1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "e.g. 10" : "e.g. 5.00"}
                min="0"
                max={discountType === "percentage" ? 100 : undefined}
              />
              <span className="text-[12.5px] font-bold text-(--text-2) shrink-0">{discountType === "percentage" ? "%" : "€"}</span>
            </div>
          )}
        </div>

        {/* New total preview */}
        {discountType !== "none" && Number(discountValue) > 0 && (
          <div className="bg-(--bg-surface-2) border border-border rounded-xl px-3.5 py-2.5 mb-3.5 flex justify-between items-center">
            <div>
              <div className="text-[11px] text-(--text-3) mb-[2px]">Discount</div>
              <div className="text-[12.5px] font-bold text-rose-400">− {fmtPrice(discountAmount, order.currency)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-(--text-3) mb-[2px]">New total</div>
              <div className="text-[15px] font-extrabold text-green-400">{fmtPrice(newTotal, order.currency)}</div>
            </div>
          </div>
        )}

        <div className="mb-3.5">
          <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-(--text-3) mb-[7px] block">Note</label>
          <Input className="w-full bg-(--bg-surface-2) border border-(--border) rounded-xl px-3.5 py-[11px] text-[13.5px] text-(--text-1) outline-none" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <Checkbox checked={keepAddress} onCheckedChange={() => setKeepAddress((v) => !v)} />
          <span className="text-[13px] text-(--text-2)">Copy shipping address</span>
        </label>
        <DialogFooter>
          <Button variant="outline" className="" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex items-center gap-[7px]" onClick={handleDuplicate} disabled={loading}>
            {loading ? (
              <Loader2 size={13} className="animate-spin text-white" />
            ) : (
              <span className="flex">
                <Copy size={12} />
              </span>
            )}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
