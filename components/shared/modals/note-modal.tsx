'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { authFetch } from '@/lib/inbox-utils'
import { apiUrl } from '@/lib/api-client'
import { parseJson } from '@/lib/utils/typed-json'

export interface NoteOrder {
  id: string
  name: string
  note?: string | null
  [key: string]: unknown
}

interface NoteModalProps {
  order: NoteOrder
  token: string
  onClose: () => void
  onSuccess: (msg: string, type?: string) => void
}

export function NoteModal({ order, token, onClose, onSuccess }: NoteModalProps) {
  const [note, setNote] = useState(order.note || "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const res = await authFetch(`${apiUrl(`shopify/orders/${order.id}/note`)}`, { method: "PUT", body: JSON.stringify({ note }) }, token);
    const data = await parseJson<{ success?: boolean; error?: string }>(res);
    setLoading(false);
    if (data.success) onSuccess("Note saved");
    else onSuccess(data.error || "Failed to save note", "error");
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{`Note — ${order.name}`}</DialogTitle>
        </DialogHeader>
        <div>
          <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">Internal note (visible in Shopify)</label>
          <textarea className="w-full bg-secondary border border-border rounded-[11px] px-3.5 py-[13px] text-[13.5px] text-foreground outline-none resize-y min-h-[170px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Add a note to this order…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="" onClick={onClose}>
            Cancel
          </Button>
          <Button className="" onClick={() => void handleSave()} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
