'use client'

import { useRouter } from 'next/navigation'
import { MacroForm } from '@/components/features/settings/macros/macro-form'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'

const BREADCRUMB = ['Settings', 'Macros', 'Create macro']

export default function NewMacroPage() {
  const router = useRouter()

  return (
    <>
      <SettingsPageHeader
        title="Create macro"
        backHref="/settings/workspace/macros"
        breadcrumb={BREADCRUMB}
      />
      <MacroForm
        macro={null}
        onSave={() => router.push('/settings/workspace/macros')}
        onCancel={() => router.push('/settings/workspace/macros')}
      />
    </>
  )
}
