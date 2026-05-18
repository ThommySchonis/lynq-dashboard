'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { authFetch, fmtPrice, REFUND_REASONS } from '@/lib/inbox-utils'
import { parseJson } from '@/lib/utils/typed-json'

export interface RefundLineItem {
  id: string
  title: string
  quantity: number
  price: string
  variantTitle?: string
  [key: string]: unknown
}

export interface RefundOrder {
  id: string
  name: string
  totalPrice: string | number
  currency: string
  lineItems?: RefundLineItem[]
  [key: string]: unknown
}

interface RefundModalProps {
  order: RefundOrder
  token: string
  onClose: () => void
  onSuccess: (msg: string, type?: string) => void
}

export function RefundModal({ order, token, onClose, onSuccess }: RefundModalProps) {
  const [mode, setMode] = useState("items"); // 'items' | 'full' | 'custom'
  const [qtys, setQtys] = useState(Object.fromEntries((order.lineItems || []).map((li) => [li.id, 0])));
  const [customAmount, setCustomAmount] = useState("");
  const [restock, setRestock] = useState(false);
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState("");
  const [shipping, setShipping] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "full") setQtys(Object.fromEntries((order.lineItems || []).map((li) => [li.id, li.quantity])));
    else if (mode === "items") setQtys(Object.fromEntries((order.lineItems || []).map((li) => [li.id, 0])));
  }, [mode]);

  const itemsTotal = (order.lineItems || []).reduce((s, li) => s + (qtys[li.id] || 0) * Number(li.price), 0);
  const totalRefund = mode === "custom" ? Number(customAmount) || 0 : itemsTotal;
  const canSubmit = reason && (mode === "custom" ? Number(customAmount) > 0 : totalRefund > 0);

  async function handleRefund() {
    setLoading(true);
    let body;
    if (mode === "custom") {
      body = { customAmount: Number(customAmount), notify, reason };
    } else {
      const lineItems = (order.lineItems || []).filter((li) => qtys[li.id] > 0).map((li) => ({ lineItemId: li.id, quantity: qtys[li.id] }));
      body = { lineItems, restock, notify, reason, shipping };
    }
    const res = await authFetch(`/api/shopify/orders/${order.id}/refund`, { method: "POST", body: JSON.stringify(body) }, token);
    const data = await parseJson<{ success?: boolean; error?: string }>(res);
    setLoading(false);
    if (data.success) onSuccess("Refund processed!");
    else onSuccess(data.error || "Refund failed", "error");
  }

  const MODES = [
    { v: "items", l: "By items" },
    { v: "full", l: "Full refund" },
    { v: "custom", l: "Custom amount" },
  ];

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Refund — ${order.name}`}</DialogTitle>
        </DialogHeader>
        {/* 3-way mode toggle */}
        <div className="flex gap-[5px] mb-[18px] p-1 bg-input rounded-[11px] border border-border">
          {MODES.map((o) => (
            <button
              key={o.v}
              onClick={() => setMode(o.v)}
              className={`flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold font-[inherit] cursor-pointer transition-all border border-transparent ${mode === o.v ? "bg-foreground text-white" : "bg-transparent text-muted-foreground"}`}
            >
              {o.l}
            </button>
          ))}
        </div>

        {/* Custom amount input */}
        {mode === "custom" && (
          <div className="mb-[18px]">
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Refund amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">€</span>
              <Input
                type="number"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none pl-7"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                max={order.totalPrice}
                autoFocus
              />
            </div>
            {Number(customAmount) > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Max: <span className="text-foreground-2 font-semibold">{fmtPrice(order.totalPrice, order.currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* Line items table (items + full mode) */}
        {mode !== "custom" && (
          <div className="mb-4">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center pb-2 mb-1.5 border-b border-white/[0.07]">
              <span className="text-[10px] font-bold text-muted-foreground tracking-[.07em] uppercase">Product</span>
              <span className="text-[10px] font-bold text-muted-foreground tracking-[.07em] uppercase">Price</span>
              <span className="text-[10px] font-bold text-muted-foreground tracking-[.07em] uppercase text-center min-w-20">Qty</span>
              <span className="text-[10px] font-bold text-muted-foreground tracking-[.07em] uppercase text-right">Total</span>
            </div>
            {(order.lineItems || []).map((li) => (
              <div key={li.id} className="flex items-center gap-3 py-[11px] border-b border-border last:border-b-0">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-foreground">{li.title}</div>
                  {li.variantTitle && <div className="text-[11.5px] text-muted-foreground">{li.variantTitle}</div>}
                </div>
                <span className="text-[12.5px] text-foreground-2 min-w-[60px] text-right">{fmtPrice(li.price, order.currency)}</span>
                <div className="flex items-center gap-1.5 min-w-20 justify-center">
                  <button
                    className="w-7 h-7 rounded-[7px] bg-secondary border border-border text-foreground-2 text-[15px] cursor-pointer flex items-center justify-center transition-all hover:border-border-hover hover:text-foreground disabled:opacity-[.28] disabled:cursor-not-allowed"
                    onClick={() =>
                      setQtys((q) => ({
                        ...q,
                        [li.id]: Math.max(0, q[li.id] - 1),
                      }))
                    }
                    disabled={!qtys[li.id] || mode === "full"}
                  >
                    −
                  </button>
                  <span className="text-[13px] font-semibold text-foreground min-w-5 text-center">{qtys[li.id]}</span>
                  <button
                    className="w-7 h-7 rounded-[7px] bg-secondary border border-border text-foreground-2 text-[15px] cursor-pointer flex items-center justify-center transition-all hover:border-border-hover hover:text-foreground disabled:opacity-[.28] disabled:cursor-not-allowed"
                    onClick={() =>
                      setQtys((q) => ({
                        ...q,
                        [li.id]: Math.min(li.quantity, q[li.id] + 1),
                      }))
                    }
                    disabled={qtys[li.id] >= li.quantity || mode === "full"}
                  >
                    +
                  </button>
                  <span className="text-[11px] text-muted-foreground">/{li.quantity}</span>
                </div>
                <span className="text-[13px] font-bold text-foreground min-w-[60px] text-right">
                  {fmtPrice((qtys[li.id] || 0) * Number(li.price), order.currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 mb-4">
          {mode !== "custom" && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Checkbox checked={restock} onCheckedChange={() => setRestock((v) => !v)} />
              <span className="text-[13px] text-foreground-2">Restock items</span>
            </label>
          )}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={notify} onCheckedChange={() => setNotify((v) => !v)} />
            <span className="text-[13px] text-foreground-2">Notify customer</span>
          </label>
          {mode !== "custom" && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Checkbox checked={shipping} onCheckedChange={() => setShipping((v) => !v)} />
              <span className="text-[13px] text-foreground-2">Refund shipping costs</span>
            </label>
          )}
        </div>

        <div className="mb-4">
          <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Reason</label>
          <select className="w-full bg-secondary border border-border rounded-xl px-3.5 py-[11px] text-[13.5px] text-foreground outline-none cursor-pointer" value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="" disabled>
              Select a reason…
            </option>
            {REFUND_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-secondary border border-border rounded-xl px-[15px] py-[13px]">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-foreground">Refund total</span>
            <span className={`text-[15px] font-extrabold ${totalRefund > 0 ? "text-green-400" : "text-muted-foreground"}`}>
              {fmtPrice(totalRefund, order.currency)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleRefund()} disabled={loading || !canSubmit}>
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : "Process refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
