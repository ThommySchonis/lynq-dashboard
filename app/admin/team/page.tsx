import { TeamForm } from '@/components/features/admin/team/team-form'
import { TeamList } from '@/components/features/admin/team/team-list'

export default function TeamPage() {
  return (
    <div className="grid grid-cols-[42%_58%] gap-4 items-start">
      <TeamForm />
      <TeamList />
    </div>
  )
}
