'use client'

import { Button } from '@/components/ui/button'
import { SERVICE_COLORS } from '@/lib/admin-constants'
import type { Inquiry } from '@/types/admin'

interface InquiryCardProps {
  inquiry: Inquiry
  onMarkRead: () => void
}

export function InquiryCard({ inquiry, onMarkRead }: InquiryCardProps) {
  const colorClass = SERVICE_COLORS[inquiry.service] ?? 'text-violet-600'
  const isNew = inquiry.status === 'new'

  return (
    <div
      className={`flex gap-3.5 items-start rounded-[10px] border bg-card p-4 ${
        isNew ? 'border-red-500/15' : 'border-border/60'
      }`}
    >
      <div
        className={`size-2 shrink-0 rounded-full mt-1.5 ${colorClass.replace('text-', 'bg-')}`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span
            className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${colorClass} ${colorClass.replace('text-', 'bg-').replace('600', '500/8')} ${colorClass.replace('text-', 'border-').replace('600', '500/18')}`}
          >
            {inquiry.service}
          </span>
          {isNew && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border text-red-600 bg-red-500/8 border-red-500/20">
              New
            </span>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto">
            {new Date(inquiry.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap mb-1">
          <span className="text-[13px] font-medium text-foreground">
            {inquiry.client_email || '\u2014'}
          </span>
          {inquiry.phone_number && (
            <a
              href={`https://wa.me/${inquiry.phone_number.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/8 border border-green-500/20 text-green-600 text-[11.5px] font-semibold no-underline hover:bg-green-500/12 transition-colors"
            >
              {inquiry.phone_number}
            </a>
          )}
        </div>

        {inquiry.message ? (
          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
            {inquiry.message}
          </p>
        ) : (
          <p className="text-[12.5px] text-muted-foreground/70 italic">
            No specific question
          </p>
        )}
      </div>

      {isNew && (
        <Button
          variant="outline"
          size="sm"
          onClick={onMarkRead}
          className="shrink-0 text-emerald-600 border-emerald-500/25 bg-emerald-500/6 hover:bg-emerald-500/12 text-[11.5px] font-semibold"
        >
          Mark read
        </Button>
      )}
    </div>
  )
}
