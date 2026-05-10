'use client'

import { toast } from 'sonner'
import { X } from 'lucide-react'
import { useNotifications, useDeleteNotification } from '@/hooks/admin'
import { NOTIFICATION_COLORS } from '@/lib/admin-constants'
import type { NotificationType } from '@/types/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function NotificationList() {
  const { data: notifications = [] } = useNotifications()
  const deleteMutation = useDeleteNotification()

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Notification deleted')
    } catch {
      toast.error('Failed to delete notification')
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Sent — {notifications.length}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No notifications sent yet.
          </div>
        ) : (
          notifications.map((n) => {
            const colors = NOTIFICATION_COLORS[n.type as NotificationType] ?? NOTIFICATION_COLORS.info
            return (
              <div
                key={n.id}
                className="flex gap-3 items-start px-4 py-3 border-b border-border/40 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors.bgClass} ${colors.colorClass} ${colors.borderClass}`}
                    >
                      {n.type}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString('en-US')}
                    </span>
                  </div>
                  <div className="text-[13px] font-medium text-foreground mb-0.5">
                    {n.title}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {n.body}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
