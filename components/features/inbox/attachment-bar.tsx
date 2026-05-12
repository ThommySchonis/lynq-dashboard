'use client'

import { Button } from '@/components/ui/button'
import { Paperclip, X } from 'lucide-react'
import { useInboxUI } from '@/stores/inbox-ui'

export function AttachmentBar() {
  const attachments = useInboxUI((s) => s.attachments)
  const setAttachments = useInboxUI((s) => s.setAttachments)

  if (attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-[5px] pt-2 px-3.5 pb-0">
      {attachments.map((a, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-[5px] px-2.5 py-1 bg-secondary border border-border rounded-lg text-[11px] text-foreground-2"
        >
          <Paperclip size={13} /> {a.name}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
            className="text-muted-foreground flex p-0 ml-0.5"
          >
            <X size={10} />
          </Button>
        </span>
      ))}
    </div>
  )
}
