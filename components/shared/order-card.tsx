// @ts-nocheck
"use client"

import { useState } from "react"
import type { ShopifyOrder } from "@/types/inbox"
import { fmtDate, fmtPrice, ORDER_STATUS_CONFIG } from "@/lib/inbox-utils"
import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ChevronDown,
  RotateCcw,
  XCircle,
  Copy,
  MapPin,
  Truck,
  StickyNote,
} from "lucide-react"
import { RefundModal } from "@/components/shared/modals/refund-modal"
import { CancelModal } from "@/components/shared/modals/cancel-modal"
import { DuplicateModal } from "@/components/shared/modals/duplicate-modal"
import { EditAddressModal } from "@/components/shared/modals/edit-address-modal"
import { FulfillModal } from "@/components/shared/modals/fulfill-modal"
import { NoteModal } from "@/components/shared/modals/note-modal"

interface OrderCardProps {
  order: ShopifyOrder
  token: string
  onSuccess: (msg: string) => void
}

type ModalType = "refund" | "cancel" | "duplicate" | "address" | "fulfill" | "note" | null

export function OrderCard({ order, token, onSuccess }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showLineItems, setShowLineItems] = useState(true)
  const [showShipping, setShowShipping] = useState(true)
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  const isCancelled = order.financial_status === "cancelled" || order.financial_status === "voided"
  const isRefunded = order.financial_status === "refunded"
  const canRefund = !isCancelled && !isRefunded
  const canCancel = !isCancelled

  const finConfig = ORDER_STATUS_CONFIG[isCancelled ? "cancelled" : order.financial_status?.toLowerCase()]
  const fulConfig = ORDER_STATUS_CONFIG[order.fulfillment_status?.toLowerCase() ?? ""]

  const sa = order.shipping_address

  return (
    <>
      <Card size="sm" className="overflow-hidden">
        {/* Header - always visible */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        >
          <span className="flex-1 text-sm font-bold">{order.name}</span>
          <span className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</span>
          {finConfig && (
            <StatusBadge status={finConfig.label} className={undefined} />
          )}
          {fulConfig && (
            <StatusBadge status={fulConfig.label} className={undefined} />
          )}
          <span className="text-sm font-bold">{fmtPrice(order.total_price, order.currency)}</span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded && (
          <CardContent className="space-y-3 pt-0">
            <Separator />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setActiveModal("duplicate")}>
                <Copy className="mr-1.5 size-3.5" />
                Duplicate
              </Button>
              {canRefund && (
                <Button variant="outline" size="sm" onClick={() => setActiveModal("refund")}>
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Refund
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setActiveModal("cancel")}>
                  <XCircle className="mr-1.5 size-3.5" />
                  Cancel
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setActiveModal("fulfill")}>
                <Truck className="mr-1.5 size-3.5" />
                Fulfill
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveModal("address")}>
                <MapPin className="mr-1.5 size-3.5" />
                Edit address
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveModal("note")}>
                <StickyNote className="mr-1.5 size-3.5" />
                Note
              </Button>
            </div>

            {/* Line items - collapsible sub-section */}
            <div>
              <button
                type="button"
                onClick={() => setShowLineItems(v => !v)}
                className="flex w-full items-center gap-2 py-1 text-xs font-semibold text-muted-foreground"
              >
                <span className="flex-1 text-left">Line items ({(order.line_items || []).length})</span>
                <ChevronDown className={`size-3 transition-transform ${showLineItems ? "rotate-180" : ""}`} />
              </button>
              {showLineItems && (
                <div className="mt-1 rounded-lg border bg-muted/30 p-2">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-border/50 pb-1.5 text-[11px] font-medium text-muted-foreground">
                    <span>Product</span>
                    <span>Qty</span>
                    <span className="text-right">Price</span>
                  </div>
                  {(order.line_items || []).map(li => (
                    <div key={li.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-1.5 border-b border-border/30 last:border-0">
                      <div>
                        <p className="text-xs font-medium">{li.title}</p>
                        {li.variant_title && (
                          <p className="text-[11px] text-muted-foreground">{li.variant_title}</p>
                        )}
                        {li.sku && (
                          <p className="text-[10px] text-muted-foreground">SKU: {li.sku}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">&times;{li.quantity}</span>
                      <span className="text-right text-xs font-semibold">
                        {fmtPrice(Number(li.price) * li.quantity, order.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Shipping address - collapsible sub-section */}
            {sa && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowShipping(v => !v)}
                  className="flex w-full items-center gap-2 py-1 text-xs font-semibold text-muted-foreground"
                >
                  <MapPin className="size-3" />
                  <span className="flex-1 text-left">Shipping address</span>
                  <ChevronDown className={`size-3 transition-transform ${showShipping ? "rotate-180" : ""}`} />
                </button>
                {showShipping && (
                  <div className="mt-1 rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground space-y-0.5">
                    {sa.name && <p className="font-medium text-foreground">{sa.name}</p>}
                    {!sa.name && (sa.first_name || sa.last_name) && (
                      <p className="font-medium text-foreground">
                        {[sa.first_name, sa.last_name].filter(Boolean).join(" ")}
                      </p>
                    )}
                    {sa.address1 && <p>{sa.address1}</p>}
                    {sa.address2 && <p>{sa.address2}</p>}
                    <p>
                      {[sa.city, sa.province, sa.zip].filter(Boolean).join(", ")}
                    </p>
                    {sa.country && <p>{sa.country}</p>}
                    {sa.phone && <p>{sa.phone}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Order note */}
            {order.note && (
              <div className="rounded-lg border bg-muted/30 p-2">
                <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Note</p>
                <p className="text-xs">{order.note}</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Modals */}
      <RefundModal
        open={activeModal === "refund"}
        onOpenChange={open => !open && setActiveModal(null)}
        order={order}
        token={token}
        onSuccess={onSuccess}
      />
      <CancelModal
        open={activeModal === "cancel"}
        onOpenChange={open => !open && setActiveModal(null)}
        order={order}
        token={token}
        onSuccess={onSuccess}
      />
      <DuplicateModal
        open={activeModal === "duplicate"}
        onOpenChange={open => !open && setActiveModal(null)}
        order={order}
        token={token}
        onSuccess={onSuccess}
      />
      <EditAddressModal
        open={activeModal === "address"}
        onOpenChange={open => !open && setActiveModal(null)}
        order={order}
        token={token}
        onSuccess={onSuccess}
      />
      <FulfillModal
        open={activeModal === "fulfill"}
        onOpenChange={open => !open && setActiveModal(null)}
        order={order}
        token={token}
        onSuccess={onSuccess}
      />
      <NoteModal
        open={activeModal === "note"}
        onOpenChange={open => !open && setActiveModal(null)}
        order={order}
        token={token}
        onSuccess={onSuccess}
      />
    </>
  )
}
