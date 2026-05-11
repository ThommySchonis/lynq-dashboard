'use client'

import { useRouter } from 'next/navigation'
import { MacroEditor } from '@/components/features/inbox/macro-editor'

export default function NewMacroPage() {
  const router = useRouter()

  return (
    <MacroEditor
      macro={null}
      onSave={() => router.push('/settings/workspace/macros')}
      onDuplicate={() => {}}
      onDelete={() => {}}
      onBack={() => router.push('/settings/workspace/macros')}
    />
  )
}
