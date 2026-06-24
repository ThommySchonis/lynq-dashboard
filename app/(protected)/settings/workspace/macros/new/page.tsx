'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MacroForm } from '@/components/features/settings/macros/macro-form'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'

export default function NewMacroPage() {
  const router = useRouter()
  const breadcrumb = useMemo(() => ['Settings', 'Macros', 'Create macro'], [])

  return (
    <>
      <SettingsPageHeader
        title="Create macro"
        backHref="/settings/workspace/macros"
        breadcrumb={breadcrumb}
      />
      <MacroForm
        macro={null}
        onSave={() => router.push('/settings/workspace/macros')}
        onCancel={() => router.push('/settings/workspace/macros')}
      />
    </>
  )
}
