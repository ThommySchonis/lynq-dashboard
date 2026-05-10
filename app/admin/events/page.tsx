import { EventForm } from '@/components/features/admin/events/event-form'
import { EventList } from '@/components/features/admin/events/event-list'

export default function EventsPage() {
  return (
    <div className="grid grid-cols-[42%_58%] items-start gap-4">
      <EventForm />
      <EventList />
    </div>
  )
}
