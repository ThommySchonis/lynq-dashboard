'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { relTime, getInitials } from '@/lib/inbox-utils'
import type { Thread } from '@/types'
import { cn } from '@/lib/utils'

interface UrgencyInfo {
  urgency: string
  score: number
}

interface ThreadRowProps {
  thread: Thread
  isActive: boolean
  urgency?: UrgencyInfo
  checked: boolean
  onCheck: (id: string) => void
  onClick: (thread: Thread) => void
}

const URGENCY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-amber-500',
  medium:   'bg-blue-500',
  low:      'bg-zinc-400',
}

const URGENCY_LABEL: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-amber-500',
  medium:   'text-blue-500',
  low:      'text-zinc-400',
}

export function ThreadRow({ thread, isActive, urgency, checked, onCheck, onClick }: ThreadRowProps) {
  const initials = getInitials(thread.from_name || thread.from || '?')
  const time = relTime(thread.last_message_at || thread.date || thread.created_at)
  const urgencyKey = urgency?.urgency?.toLowerCase() ?? ''

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(thread)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(thread) }}
      className={cn(
        'flex cursor-pointer items-start gap-3 border-b border-border px-3 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive && 'border-l-2 border-l-primary bg-primary/5',
      )}
    >
      {/* Checkbox — stop propagation so clicking it doesn't open thread */}
      <div
        className="mt-0.5 shrink-0"
        onClick={(e) => { e.stopPropagation() }}
        onKeyDown={(e) => { e.stopPropagation() }}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={() => onCheck(thread.id)}
          aria-label={`Select thread from ${thread.from_name || thread.from}`}
        />
      </div>

      {/* Avatar */}
      <Avatar size="default" className="mt-0.5 shrink-0">
        <AvatarFallback className="text-xs font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: Sender + Time */}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {thread.from_name || thread.from || 'Unknown'}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{time}</span>
        </div>

        {/* Row 2: Subject */}
        <p
          className={cn(
            'truncate text-sm text-foreground',
            thread.unread && 'font-bold',
          )}
        >
          {thread.subject || '(No subject)'}
        </p>

        {/* Row 3: Snippet */}
        <p className="truncate text-xs text-muted-foreground">
          {thread.snippet || ''}
        </p>

        {/* Row 4: Urgency badge (only when present) */}
        {urgency && urgencyKey && (
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn('size-1.5 shrink-0 rounded-full', URGENCY_DOT[urgencyKey] ?? 'bg-zinc-400')}
              aria-hidden="true"
            />
            <span className={cn('text-xs capitalize', URGENCY_LABEL[urgencyKey] ?? 'text-zinc-400')}>
              {urgency.urgency}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
