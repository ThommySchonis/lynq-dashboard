'use client'

import { Inbox } from 'lucide-react'

interface FeedbackEmptyStateProps {
  hasFilter: boolean
  onClear: () => void
}

export function FeedbackEmptyState({ hasFilter, onClear }: FeedbackEmptyStateProps) {
  return (
    <div className="py-20 text-center">
      <Inbox size={48} strokeWidth={1.5} className="text-foreground-4 mx-auto mb-4" />
      {hasFilter ? (
        <>
          <div className="text-[18px] font-medium text-muted-foreground">
            No feedback matches your filters
          </div>
          <button
            onClick={onClear}
            className="mt-3 bg-transparent border-none text-primary cursor-pointer text-[13px] font-medium underline"
          >
            Clear filters
          </button>
        </>
      ) : (
        <>
          <div className="text-[18px] font-medium text-muted-foreground">No feedback yet</div>
          <div className="text-[13px] text-foreground-4 mt-1">
            When customers send feedback, it&apos;ll show up here.
          </div>
        </>
      )}
    </div>
  )
}
