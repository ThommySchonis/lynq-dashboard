import { NotificationForm } from '@/components/features/admin/notifications/notification-form'
import { NotificationList } from '@/components/features/admin/notifications/notification-list'

export default function NotificationsPage() {
  return (
    <div className="grid grid-cols-[42%_58%] gap-4 items-start">
      <NotificationForm />
      <NotificationList />
    </div>
  )
}
