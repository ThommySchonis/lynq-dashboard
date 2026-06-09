'use client'

import { Button } from '@/components/ui/button'
import { Check, Pencil, RotateCw, X, Sparkles } from 'lucide-react'
import { DeclineFeedbackPopover } from './decline-feedback-popover'
import type { AiDraft, FeedbackCategory } from '@/types/ai-drafts'

interface EmmaSuggestionCardProps {
  draft: AiDraft
  onApprove: () => void
  onEdit: () => void
  onDecline: (category: FeedbackCategory, comment?: string) => void
  onRegenerate: () => void
  isApproving?: boolean
  isDeclining?: boolean
  isRegenerating?: boolean
}

export function EmmaSuggestionCard({
  draft,
  onApprove,
  onEdit,
  onDecline,
  onRegenerate,
  isApproving,
  isDeclining,
  isRegenerating,
}: EmmaSuggestionCardProps) {
  const busy = isApproving || isDeclining || isRegenerating

  return (
    <div className="mx-4 my-3 rounded-lg border border-amber-500/20 bg-gradient-to-br from-card to-amber-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-amber-500">
            Emma&apos;s Suggested Reply
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(draft.generated_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="rounded-md bg-background/50 p-3 mb-3 text-sm leading-relaxed whitespace-pre-wrap">
        {draft.suggested_text}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={onApprove}
          disabled={busy}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          {isApproving ? 'Sending...' : 'Approve & Send'}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          disabled={busy}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit Before Sending
        </Button>

        <DeclineFeedbackPopover
          onDecline={onDecline}
          onCancel={() => {}}
          disabled={busy}
        >
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            disabled={busy}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {isDeclining ? 'Declining...' : 'Decline'}
          </Button>
        </DeclineFeedbackPopover>

        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={onRegenerate}
          disabled={busy}
        >
          <RotateCw className="mr-1 h-3.5 w-3.5" />
          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
        </Button>
      </div>
    </div>
  )
}
