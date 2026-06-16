export type NotificationCategory = 'broadcast' | 'emma_pending_draft'
export type NotificationSeverity = 'info' | 'warning' | 'alert'

export interface AppNotification {
  id: string
  category: NotificationCategory
  type: NotificationSeverity
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

export interface NotificationFeed {
  items: AppNotification[]
  unread_count: number
  has_more: boolean
}
