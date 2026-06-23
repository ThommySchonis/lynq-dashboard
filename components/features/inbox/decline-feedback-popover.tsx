'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface DeclineFeedbackPopoverProps {
  /** Comment-only feedback (categories removed per product decision). */
  onSubmit: (comment?: string) => void
  disabled?: boolean
  children: React.ReactNode
}

/**
 * "What could be better?" feedback popover shown when a reviewer marks an AI
 * draft as not helpful (Figma 782-25163). Free-text comment only.
 */
export function DeclineFeedbackPopover({ onSubmit, disabled, children }: DeclineFeedbackPopoverProps) {
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')

  function close() {
    setOpen(false)
    setComment('')
  }

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger render={(props) => <span {...props} onClick={disabled ? undefined : props.onClick}>{children}</span>} />
      <PopoverContent className="w-[304px] p-4" align="end">
        <p className="text-sm font-semibold text-foreground">What could be better?</p>
        <p className="mb-3 text-[12px] text-muted-foreground">Your feedback trains the AI.</p>
        <Textarea
          placeholder="Add a comment — what should it have said?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mb-3 text-sm"
        />
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { onSubmit(undefined); close() }}>Skip</Button>
          <Button size="sm" onClick={() => { onSubmit(comment.trim() || undefined); close() }}>Submit feedback</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
