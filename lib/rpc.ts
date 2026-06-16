'use client'

import { supabase } from '@/lib/supabase'
import type { NotificationFeed } from '@/types/notifications'

export async function rpc<T = unknown>(
  fn: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw new Error(error.message)
  return data as T
}

export async function listNotifications(params?: {
  limit?: number
  offset?: number
}): Promise<NotificationFeed> {
  return rpc<NotificationFeed>('api_list_notifications', {
    p_limit: params?.limit ?? 20,
    p_offset: params?.offset ?? 0,
  })
}

export async function markNotificationRead(id: string): Promise<void> {
  await rpc<null>('api_mark_notification_read', { p_notification_id: id })
}

export async function markAllNotificationsRead(): Promise<void> {
  await rpc<null>('api_mark_all_notifications_read', {})
}
