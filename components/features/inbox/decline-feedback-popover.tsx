'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from '@/types/ai-drafts'

interface DeclineFeedbackPopoverProps {
  onDecline: (category: FeedbackCategory, comment?: string) => void
  onCancel: () => void
  disabled?: boolean
  children: React.ReactNode
}

const categories = Object.entries(FEEDBACK_CATEGORY_LABELS) as [FeedbackCategory, string][]

export function DeclineFeedbackPopover({
  onDecline,
  onCancel,
  disabled,
  children,
}: DeclineFeedbackPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<FeedbackCategory | null>(null)
  const [comment, setComment] = useState('')

  function handleSubmit() {
    if (!selected) return
    onDecline(selected, comment.trim() || undefined)
    setOpen(false)
    setSelected(null)
    setComment('')
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setSelected(null)
      setComment('')
      onCancel()
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={(props) => (
          <span {...props} onClick={disabled ? undefined : props.onClick}>
            {children}
          </span>
        )}
      />
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-sm font-medium mb-2">Why are you declining?</p>
        <div className="flex flex-col gap-1 mb-3">
          {categories.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`text-left text-sm px-2 py-1.5 rounded transition-colors ${
                selected === key
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Additional details (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="mb-2 text-sm"
        />
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!selected}
            onClick={handleSubmit}
          >
            Decline
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
