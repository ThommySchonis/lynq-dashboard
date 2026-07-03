'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CountBadge } from '@/components/shared/count-badge'
import { useNotifications } from '@/hooks/notifications'
import { NotificationsModal } from './notifications-modal'

export function NotificationBell({
  collapsed = false,
  variant = 'icon',
}: {
  collapsed?: boolean
  /** 'icon' = compact icon button; 'row' = full-width footer nav row (Figma sidebar). */
  variant?: 'icon' | 'row'
}) {
  const [open, setOpen] = useState(false)
  const { unreadCount } = useNotifications()

  const asRow = variant === 'row' && !collapsed

  return (
    <>
      {asRow ? (
        <button
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label="Notifications"
          className="group flex h-10 w-full items-center gap-3 rounded-[9px] px-3 text-sm text-foreground-2 transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-5 shrink-0 text-foreground-3 group-hover:text-foreground" />
          <span className="truncate">Notifications</span>
          <CountBadge count={unreadCount} />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label="Notifications"
          className={cn(
            'relative flex items-center justify-center rounded-md text-foreground-3 transition-colors hover:bg-muted hover:text-foreground',
            collapsed ? 'size-8' : 'size-9',
          )}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}
      <NotificationsModal open={open} onOpenChange={setOpen} />
    </>
  )
}
