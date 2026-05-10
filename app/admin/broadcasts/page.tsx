import { BroadcastForm } from '@/components/features/admin/broadcasts/broadcast-form'
import { BroadcastList } from '@/components/features/admin/broadcasts/broadcast-list'

export default function BroadcastsPage() {
  return (
    <div className="grid grid-cols-[42%_58%] gap-4 items-start">
      <BroadcastForm />
      <BroadcastList />
    </div>
  )
}
