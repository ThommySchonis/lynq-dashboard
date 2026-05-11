'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { MacroEditor } from '@/components/features/inbox/macro-editor'

export default function EditMacroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  // The MacroEditor fetches its own data based on the macro id.
  // We pass a stub with just the id so the editor knows it's in edit mode.
  return (
    <MacroEditor
      macro={{ id }}
      onSave={() => router.push('/settings/workspace/macros')}
      onDuplicate={() => {}}
      onDelete={() => router.push('/settings/workspace/macros')}
      onBack={() => router.push('/settings/workspace/macros')}
    />
  )
}
