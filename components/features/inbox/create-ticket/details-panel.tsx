'use client'

import { Plus, X, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { ComposeAvatar } from '@/components/features/inbox/compose-avatar'
import { deriveIsVip, fmtPrice } from '@/lib/inbox-utils'
import type { CreateTicketForm } from '@/hooks/inbox/use-create-ticket'

interface CreateTicketDetailsPanelProps {
  form: CreateTicketForm
}

/** Right column — "Ticket details" (Figma 291:22415): Add tags, contact meta as
 *  "+ Add" rows, and the customer card auto-resolved from the To address. Meta +
 *  tags are local until the two-step persist lands (BE #11). VIP / location /
 *  lifetime value degrade to "—" when Shopify doesn't supply them (BE #2/#3). */
export function CreateTicketDetailsPanel({ form }: CreateTicketDetailsPanelProps) {
  const { customer, ordersCount, contactReason, setContactReason,
    product, setProduct, resolution, setResolution, tags, setTags } = form
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)

  const name = customer
    ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || 'Customer'
    : ''
  const isVip = deriveIsVip(customer?.tags)
  const location = [customer?.city, customer?.country].filter(Boolean).join(', ')
  const ltv = customer?.totalSpent != null ? fmtPrice(customer.totalSpent, customer.currency) : ''

  function addTag() {
    if (tagInput.trim()) setTags((p) => [...new Set([...p, tagInput.trim()])])
    setTagInput('')
  }

  return (
    <div className="relative z-[1] flex w-[300px] shrink-0 flex-col gap-[18px] overflow-y-auto border-l border-border bg-card px-5 py-[22px] dark:bg-[rgba(10,4,28,0.4)]">
      {/* Header: title + Add tags */}
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-foreground">Ticket details</span>
        <button
          onClick={() => setShowTagInput((v) => !v)}
          className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-card px-3 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add tags
        </button>
      </div>

      {/* Tag pills + input */}
      {(tags.length > 0 || showTagInput) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-[5px] border border-(--accent-border) bg-(--accent-soft) px-2 py-px text-[11.5px] text-(--accent-text)"
            >
              {t}
              <button onClick={() => setTags((p) => p.filter((x) => x !== t))} className="flex text-muted-foreground">
                <X className="h-[9px] w-[9px]" />
              </button>
            </span>
          ))}
          {showTagInput && (
            <Input
              autoFocus
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
                if (e.key === 'Escape') setShowTagInput(false)
              }}
              onBlur={addTag}
              placeholder="tag name…"
              className="h-7 w-[96px] border-none bg-transparent px-0 text-[11.5px] text-foreground shadow-none placeholder:text-muted-foreground"
            />
          )}
        </div>
      )}

      {/* Contact meta — "+ Add" rows, persisted in a follow-up (BE #11) */}
      <div className="flex flex-col gap-3">
        <MetaRow label="Contact reason" value={contactReason} onChange={setContactReason} />
        <MetaRow label="Product" value={product} onChange={setProduct} />
        <MetaRow label="Resolution" value={resolution} onChange={setResolution} />
      </div>

      <div className="h-px w-full shrink-0 bg-border" />

      {/* Customer card — auto from To address */}
      {customer ? (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5">
            <ComposeAvatar name={name} size={40} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{name}</div>
              <div className="text-xs text-muted-foreground">
                {isVip ? 'VIP customer · ' : ''}{ordersCount} order{ordersCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Row label="Email" value={customer.email} />
            <Row label="Location" value={location} />
            <Row label="Lifetime value" value={ltv} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3.5 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-(--accent-soft) text-(--accent-text)">
            <UserPlus className="h-5 w-5" />
          </span>
          <span className="max-w-[200px] text-[13px] text-muted-foreground">
            Add a recipient to load customer details by name, email or order no.
          </span>
        </div>
      )}
    </div>
  )
}

/** A contact-meta row: label on the left, value or a "+ Add" toggle on the right
 *  that reveals an inline input (Figma "+ Add" affordance). */
function MetaRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false) }}
          onBlur={() => setEditing(false)}
          placeholder="Add…"
          className="h-7 w-[150px] text-right text-[13px] text-foreground"
        />
      ) : value ? (
        <button onClick={() => setEditing(true)} className="max-w-[150px] truncate text-[13px] font-medium text-foreground hover:underline">
          {value}
        </button>
      ) : (
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-0.5 text-[13px] text-(--accent-text)">
          <Plus className="h-3 w-3" />
          Add
        </button>
      )}
    </div>
  )
}

/** Read-only labelled row in the customer card; shows "—" when the value is missing. */
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="max-w-[160px] truncate text-[13px] font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}
