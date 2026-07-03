'use client'

import { groupNotificationsByDate } from '@/lib/notification-utils'
import type { AppNotification } from '@/types/notifications'
import { NotificationRow } from './notification-row'

/**
 * Date-grouped notification list (Figma 355-5788): a `Today` / `Yesterday` /
 * per-day section header above each bucket of rows.
 */
export function NotificationList({
  items,
  onItemClick,
}: {
  items: AppNotification[]
  onItemClick: (n: AppNotification) => void
}) {
  const groups = groupNotificationsByDate(items)

  return (
    <>
      {groups.map((group) => (
        <section key={group.key}>
          <div className="bg-surface-notif-section px-[18px] pt-3.5 pb-2 text-xs leading-[14px] font-semibold tracking-[0.08em] text-foreground-4 uppercase">
            {group.label}
          </div>
          {group.items.map((n) => (
            <NotificationRow key={n.id} n={n} onClick={() => onItemClick(n)} />
          ))}
        </section>
      ))}
    </>
  )
}
