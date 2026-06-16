'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/rpc'
import type { NotificationFeed } from '@/types/notifications'
import { notificationKeys } from './use-notifications-data'

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.feed() })
      const prev = qc.getQueryData<NotificationFeed>(notificationKeys.feed())
      if (prev) {
        qc.setQueryData<NotificationFeed>(notificationKeys.feed(), {
          ...prev,
          items: prev.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
          unread_count: Math.max(
            0,
            prev.unread_count - (prev.items.find((n) => n.id === id && !n.read) ? 1 : 0),
          ),
        })
      }
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.feed(), ctx.prev)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: notificationKeys.feed() }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.feed() })
      const prev = qc.getQueryData<NotificationFeed>(notificationKeys.feed())
      if (prev) {
        qc.setQueryData<NotificationFeed>(notificationKeys.feed(), {
          ...prev,
          items: prev.items.map((n) => ({ ...n, read: true })),
          unread_count: 0,
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.feed(), ctx.prev)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: notificationKeys.feed() }),
  })
}
