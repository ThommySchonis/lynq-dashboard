'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, ArrowRight, Bookmark } from 'lucide-react'
import { CoverDecor } from './cover-decor'
import { KIND_LABEL, readTimeOf } from '@/lib/value-feed-utils'
import { useIsSaved, useToggleSaved } from '@/hooks/value-feed'
import type { NormalizedFeedItem } from '@/hooks/value-feed'

interface ArticleModalProps {
  item: NormalizedFeedItem
  onClose: () => void
  onNext: () => void
}

/** Article detail modal (Figma node 432:832). Opened from "Read more". */
export function ArticleModal({ item, onClose, onNext }: ArticleModalProps) {
  const isSaved = useIsSaved(item.id)
  const toggleSaved = useToggleSaved()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  const kindLabel = KIND_LABEL[item.kind]
  const badgeLabel = item.kind === 'masterclass' ? 'FEATURED MASTERCLASS' : `FEATURED ${kindLabel}`
  const paragraphs = (item.body ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] bg-card shadow-[0_30px_60px_rgba(28,15,54,0.3),0_8px_20px_rgba(28,15,54,0.14)]"
      >
        {/* Cover */}
        <div className="relative h-[190px] shrink-0 overflow-hidden bg-[linear-gradient(111deg,#F1ECFF_0%,#FFFFFF_74%)] p-[18px]">
          <CoverDecor />
          <div className="relative flex items-center justify-between">
            <span className="inline-flex items-center rounded-full bg-white/[0.92] px-3 py-1.5 text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-primary">
              ★&nbsp;&nbsp;{badgeLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-11 items-center justify-center rounded-full bg-background text-foreground-3 transition-colors hover:text-foreground"
            >
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-10 pb-9 pt-8">
          {/* Meta */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-3">
              {kindLabel}
            </span>
            <span className="text-xs leading-4 text-foreground-4">·</span>
            <span className="text-xs uppercase leading-4 tracking-[0.08em] text-foreground-4">
              {readTimeOf(item.body)}
            </span>
            <span className="flex-1" />
            <span className="text-sm leading-5 text-foreground-4">{item.dateText}</span>
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold leading-[26px] text-foreground">{item.title}</h2>

          {/* Author + Save */}
          <div className="flex items-center justify-between">
            {item.author ? (
              <div className="flex items-center gap-2.5 pt-1">
                <span aria-hidden="true" className="size-8 shrink-0 rounded-full bg-black/[0.14]" />
                <div className="flex flex-col gap-px">
                  <span className="text-sm font-semibold leading-5 text-foreground">{item.author.name}</span>
                  <span className="text-xs leading-4 text-foreground-4">Lynq &amp; Flow</span>
                </div>
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => toggleSaved(item.id)}
              className="flex cursor-pointer items-center gap-1.5 text-xs font-medium leading-4 text-foreground-4 transition-colors hover:text-primary"
            >
              {isSaved ? 'Saved' : 'Save'}
              <Bookmark className={`size-4 ${isSaved ? 'fill-primary text-primary' : ''}`} strokeWidth={2} />
            </button>
          </div>

          {/* Event card — masterclass only */}
          {item.event && (
            <div className="flex items-center gap-3.5 rounded-[14px] border border-[#8B5CF6]/[0.28] bg-[#F7F5FF] py-3.5 pl-3.5 pr-4">
              <div className="flex size-[50px] shrink-0 flex-col items-center justify-center gap-px rounded-[11px] bg-accent-soft">
                <span className="text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-primary">
                  {item.event.month}
                </span>
                <span className="text-base font-bold leading-[22px] text-primary">{item.event.day}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="flex items-center gap-2">
                  <span className="line-clamp-1 text-sm font-medium leading-5 text-foreground">{item.title}</span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft py-0.5 pl-[7px] pr-2">
                    <span className="size-1.5 rounded-full bg-success" />
                    <span className="text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-success">
                      LIVE
                    </span>
                  </span>
                </div>
                <span className="text-xs leading-4 text-foreground-3">{item.event.datetimeText}</span>
              </div>
              {item.calUrl && (
                <a
                  href={item.calUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-2 rounded-[10px] border border-border bg-card py-2.5 pl-3.5 pr-4 text-sm font-semibold leading-5 text-foreground-2 shadow-[0_1px_2px_rgba(15,13,31,0.06)] transition-colors hover:bg-muted"
                >
                  Add to Google Calendar
                  <ExternalLink className="size-[18px]" strokeWidth={2} />
                </a>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Body */}
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-wrap text-sm leading-5 text-foreground-2">
                {p}
              </p>
            ))
          ) : (
            <p className="text-sm leading-5 text-foreground-4">No content yet.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border bg-secondary px-10 py-5">
          <div className="flex items-center gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="flex h-[34px] items-center rounded-[10px] border border-border bg-background px-3 text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-4"
              >
                {tag}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onNext}
            className="flex h-11 cursor-pointer items-center gap-1.5 rounded-[10px] bg-foreground px-10 text-sm font-semibold leading-5 text-background transition-opacity hover:opacity-90"
          >
            Next article
            <ArrowRight className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
