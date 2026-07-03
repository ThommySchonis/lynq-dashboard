'use client'

import { cn } from '@/lib/utils'
import { NOTIFICATION_VISUALS } from '@/lib/notification-constants'
import { formatCompactTime } from '@/lib/notification-utils'
import type { AppNotification } from '@/types/notifications'

/**
 * Single notification row (Figma 355-5791). Category badge + title + compact
 * time + unread dot + secondary body. Unread rows sit on the lavender surface;
 * read rows on the card surface.
 */
export function NotificationRow({
  n,
  onClick,
}: {
  n: AppNotification
  onClick: () => void
}) {
  const { icon: Icon, badgeClass } = NOTIFICATION_VISUALS[n.category]

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-[13px] border-b border-border py-3.5 pr-4 pl-[18px] text-left transition-colors',
        n.read ? 'bg-card hover:bg-muted' : 'bg-surface-notif-unread hover:brightness-[0.98]',
      )}
    >
      <span
        className={cn(
          'flex size-[38px] shrink-0 items-center justify-center rounded-full',
          badgeClass,
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium text-foreground">
            {n.title}
          </span>
          <span className="flex shrink-0 items-center gap-[7px] pt-0.5">
            <time dateTime={n.created_at} className="text-xs leading-4 text-foreground-4">
              {formatCompactTime(n.created_at)}
            </time>
            {!n.read && <span className="size-2 rounded-full bg-primary" />}
          </span>
        </span>
        <span className="truncate text-sm leading-5 text-foreground-3">{n.body}</span>
      </span>
    </button>
  )
}
