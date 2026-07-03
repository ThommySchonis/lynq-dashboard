'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { MoreHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { formatRelativeTime } from '@/lib/notification-utils'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/notifications'
import type { AppNotification } from '@/types/notifications'

/**
 * Centered notifications modal (Figma 350-5433 / 348-31872). PR1 delivers the
 * panel shell + header (Unread-only toggle, overflow menu, close). The filter
 * tabs (PR2) and the pixel-perfect grouped rows (PR3) land next — the content
 * region below is a temporary functional list until then.
 */
export function NotificationsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { notifications, unreadCount, isLoading, error, refetch } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const visible = unreadOnly ? notifications.filter((n) => !n.read) : notifications

  function handleClick(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id)
    onOpenChange(false)
    if (n.link) router.push(n.link)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-notif-overlay duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none"
        />
        <DialogPrimitive.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex h-[648px] max-h-[calc(100vh-2rem)] w-[700px] max-w-[calc(100vw-2rem)]',
            '-translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground',
            'shadow-[0px_24px_56px_0px_rgba(28,15,54,0.3)] outline-none duration-150',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none',
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border py-2.5 pr-4 pl-5">
            <DialogPrimitive.Title className="text-lg leading-[26px] font-semibold text-foreground">
              Notifications
            </DialogPrimitive.Title>
            <div className="flex items-center gap-2.5">
              <Switch
                checked={unreadOnly}
                onCheckedChange={setUnreadOnly}
                aria-label="Show unread notifications only"
              />
              <span className="text-sm font-medium text-foreground-3">Unread only</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="More options" />
                  }
                >
                  <MoreHorizontal className="size-5 text-foreground-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={unreadCount === 0}
                    onClick={() => markAll.mutate()}
                  >
                    Mark all as read
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DialogPrimitive.Close
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Close notifications" />
                }
              >
                <X className="size-5 text-foreground-3" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Content — temporary functional list; replaced by tabs (PR2) + grouped rows (PR3) */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-sm text-foreground-3">
                Couldn&rsquo;t load notifications.
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => void refetch()}>
                  Try again
                </Button>
              </div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-foreground-3">
                You&rsquo;re all caught up.
              </div>
            ) : (
              <ul>
                {visible.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className="flex w-full gap-3 border-b border-border px-5 py-3.5 text-left transition-colors hover:bg-muted"
                    >
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          n.read ? 'bg-transparent' : 'bg-primary',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {n.title}
                        </span>
                        <span className="block truncate text-sm text-foreground-3">{n.body}</span>
                        <time
                          dateTime={n.created_at}
                          className="mt-0.5 block text-xs text-foreground-4"
                        >
                          {formatRelativeTime(n.created_at)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
