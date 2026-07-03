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
import { NOTIFICATION_TABS, filterNotificationsByTab } from '@/lib/notification-constants'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/notifications'
import type { AppNotification } from '@/types/notifications'
import { NotificationTabs } from './notification-tabs'
import { NotificationList } from './notification-list'
import { NotificationEmpty } from './notification-empty'
import { NotificationSkeleton } from './notification-skeleton'

/**
 * Centered notifications modal (Figma 350-5433 / 348-31872): panel shell +
 * header (Unread-only toggle, overflow menu, close), filter tabs, and the
 * date-grouped notification list / empty state.
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
  const [activeKey, setActiveKey] = useState('all')
  const { notifications, unreadCount, isLoading, error, refetch } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const activeTab = NOTIFICATION_TABS.find((t) => t.key === activeKey)
  const byTab = activeTab ? filterNotificationsByTab(notifications, activeTab) : []
  const visible = unreadOnly ? byTab.filter((n) => !n.read) : byTab

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
            'shadow-modal outline-none duration-150',
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

          {/* Filter tabs */}
          <NotificationTabs activeKey={activeKey} onSelect={setActiveKey} />

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <NotificationSkeleton />
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-sm text-foreground-3">Couldn&rsquo;t load notifications.</p>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Try again
                </Button>
              </div>
            ) : visible.length === 0 ? (
              <NotificationEmpty />
            ) : (
              <NotificationList items={visible} onItemClick={handleClick} />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
