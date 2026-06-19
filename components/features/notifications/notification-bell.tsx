'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/notification-utils'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/notifications'
import type { AppNotification } from '@/types/notifications'

export function NotificationBell({
  collapsed = false,
  variant = 'icon',
}: {
  collapsed?: boolean
  /** 'icon' = compact icon button; 'row' = full-width footer nav row (Figma sidebar). */
  variant?: 'icon' | 'row'
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { notifications, unreadCount, isLoading, error, refetch } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  function handleClick(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const asRow = variant === 'row' && !collapsed

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) =>
          asRow ? (
            <button
              {...props}
              aria-label="Notifications"
              className="group flex h-10 w-full items-center gap-3 rounded-[9px] px-3 text-sm text-foreground-2 transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="size-5 shrink-0 text-foreground-3 group-hover:text-foreground" />
              <span className="truncate">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-border px-2 py-0.5 text-xs font-medium text-foreground-3">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ) : (
            <button
              {...props}
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
          )
        }
      />
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">Notifications</span>
          <button
            onClick={() => markAll.mutate()}
            disabled={unreadCount === 0}
            className="text-xs text-foreground-3 transition-colors hover:text-foreground disabled:opacity-50"
          >
            Mark all as read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <SkeletonRows />
          ) : error ? (
            <div className="px-3 py-6 text-center text-sm text-foreground-3">
              Couldn&rsquo;t load notifications.
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => {
                  void refetch()
                }}
              >
                Try again
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState />
          ) : (
            <ul>
              {notifications.map((n) => (
                <NotificationItem key={n.id} n={n} onClick={() => handleClick(n)} />
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationItem({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full gap-2 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <span
          className={cn(
            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
            n.read ? 'bg-transparent' : 'bg-primary'
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{n.title}</span>
          <span className="block truncate text-xs text-foreground-3">{n.body}</span>
          <time dateTime={n.created_at} className="mt-0.5 block text-[11px] text-foreground-3">
            {formatRelativeTime(n.created_at)}
          </time>
        </span>
      </button>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="px-3 py-8 text-center text-sm text-foreground-3">
      You&rsquo;re all caught up.
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
