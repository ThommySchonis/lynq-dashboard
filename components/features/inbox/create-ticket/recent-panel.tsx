'use client'

import { ChevronLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ComposeAvatar } from '@/components/features/inbox/compose-avatar'
import { DEMO_RECENT, STATUS_COLOR } from '@/lib/inbox-create-constants'

interface CreateTicketRecentPanelProps {
  onBack: () => void
}

/** Left column of the Create Ticket page — "Recent tickets" list.
 *  Still backed by DEMO_RECENT; wire to real recent conversations when needed. */
export function CreateTicketRecentPanel({ onBack }: CreateTicketRecentPanelProps) {
  return (
    <div className="relative z-[1] flex w-[260px] shrink-0 flex-col border-r border-border bg-card dark:border-white/[0.07] dark:bg-[rgba(10,4,28,0.52)] dark:backdrop-blur-[24px]">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-3.5 pb-2.5 pt-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold tracking-tight text-foreground">Inbox</span>
            <span className="rounded border border-border bg-secondary px-1.5 py-px text-[10px] font-semibold text-foreground-2">
              New ticket
            </span>
          </div>
          <Button variant="outline" size="xs" onClick={onBack} className="gap-1 text-[11.5px] font-semibold">
            <ChevronLeft className="h-2.5 w-2.5" />
            Back
          </Button>
        </div>
        <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Recent tickets
        </div>
      </div>

      {/* Thread list (demo) */}
      <div className="flex-1 overflow-y-auto">
        {DEMO_RECENT.map((t) => (
          <div
            key={t.id}
            className="flex cursor-pointer items-start gap-[9px] border-b border-border px-3.5 py-2.5 transition-colors hover:bg-secondary"
          >
            <ComposeAvatar name={t.from} size={28} />
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center justify-between gap-1.5">
                <span className="truncate text-[11.5px] font-semibold text-foreground">{t.from}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{t.time}</span>
              </div>
              <div className="flex items-center gap-[5px]">
                <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${STATUS_COLOR[t.status]}`} />
                <span className="truncate text-[11px] text-foreground-2">{t.subject}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-3.5 py-2.5">
        <div className="flex items-center gap-[5px] text-[11px] text-muted-foreground">
          <AlertCircle className="h-2.5 w-2.5" />
          Press Esc to return to inbox
        </div>
      </div>
    </div>
  )
}
