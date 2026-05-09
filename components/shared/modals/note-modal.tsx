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
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface NoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ShopifyOrder
  token: string
  onSuccess: (msg: string) => void
}

export function NoteModal({ open, onOpenChange, order, token, onSuccess }: NoteModalProps) {
  const [note, setNote] = useState(order.note || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch(
        `/api/shopify/orders/${order.id}/note`,
        { method: "PUT", body: JSON.stringify({ note }) },
        token,
      )
      const data = await res.json()
      setLoading(false)
      if (data.success) {
        onSuccess("Note saved")
        onOpenChange(false)
      } else {
        setError(data.error || "Failed to save note")
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
          <DialogTitle>Note &mdash; {order.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Internal note (visible in Shopify)</Label>
          <textarea
            className="flex min-h-[100px] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={5}
            placeholder="Add a note to this order..."
          />
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
