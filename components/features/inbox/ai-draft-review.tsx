'use client'

import { DeclineFeedbackPopover } from './decline-feedback-popover'

/**
 * Inline AI-draft review header shown inside the composer when a pending draft
 * is loaded (Figma 517-18097). The draft text itself lives in the composer
 * editable, so Send approves it and editing happens in place. Regenerate and
 * the tone chip are intentionally omitted.
 */
export function AiDraftReview({
  onHelpfulYes,
  onHelpfulNo,
  disabled = false,
}: {
  onHelpfulYes: () => void
  onHelpfulNo: (comment?: string) => void
  disabled?: boolean
}) {
  return (
    <div className="mx-3.5 mt-2 flex items-center justify-between gap-2 rounded-[10px] bg-accent-soft px-3 py-2">
      <span className="flex items-center gap-1.5 text-primary">
        <span className="text-[14px] leading-none">✦</span>
        <span className="text-[13px] font-semibold">AI draft · review before sending</span>
      </span>
      <span className="flex items-center gap-1.5 text-[12px]">
        <span className="text-muted-foreground">Helpful?</span>
        <button type="button" onClick={onHelpfulYes} disabled={disabled} className="font-semibold text-primary disabled:opacity-50">
          Yes
        </button>
        <span className="text-foreground-4">·</span>
        <DeclineFeedbackPopover onSubmit={onHelpfulNo} disabled={disabled}>
          <button type="button" disabled={disabled} className="font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
            No
          </button>
        </DeclineFeedbackPopover>
      </span>
    </div>
  )
}
