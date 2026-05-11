import { CreateClientForm } from '@/components/features/admin/create-client/create-client-form'
import { ClientsList } from '@/components/features/admin/clients/clients-list'

export default function CreateClientPage() {
  return (
    <div className="grid grid-cols-[42%_58%] gap-4 items-start">
      <CreateClientForm />
      <ClientsList />
    </div>
  )
}
