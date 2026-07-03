'use client'

import { Plus } from 'lucide-react'

/** Inline ticket-meta strip (Figma 301:3447): Add tags + Contact reason /
 *  Product / Resolution quick "+Add" fields. Generic over the data source so it
 *  works both in Create Ticket (form state) and in an open conversation (ticket
 *  meta store). */
export function TicketMetaStrip({
  contactReason,
  product,
  resolution,
  onSetContactReason,
  onSetProduct,
  onSetResolution,
  onAddTag,
}: {
  contactReason: string
  product: string
  resolution: string
  onSetContactReason: (v: string) => void
  onSetProduct: (v: string) => void
  onSetResolution: (v: string) => void
  onAddTag: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border bg-card px-6 py-3">
      <button onClick={onAddTag} className="inline-flex items-center gap-1 text-[14px] font-medium text-(--accent-text) transition-opacity hover:opacity-80">
        <Plus className="h-3.5 w-3.5" />
        Add tags
      </button>
      <MetaChip label="Contact reason" value={contactReason} onSet={onSetContactReason} />
      <MetaChip label="Product" value={product} onSet={onSetProduct} />
      <MetaChip label="Resolution" value={resolution} onSet={onSetResolution} />
    </div>
  )
}

function MetaChip({ label, value, onSet }: { label: string; value: string; onSet: (v: string) => void }) {
  function edit() {
    const v = prompt(label, value)
    if (v !== null) onSet(v.trim())
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px]">
      <span className="text-muted-foreground">{label}:</span>
      {value ? (
        <button onClick={edit} className="max-w-[160px] truncate font-medium text-foreground hover:underline">
          {value}
        </button>
      ) : (
        <button onClick={edit} className="font-medium text-(--accent-text) transition-opacity hover:opacity-80">
          +Add
        </button>
      )}
    </span>
  )
}
