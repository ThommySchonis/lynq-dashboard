'use client'

import { use, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MacroForm } from '@/components/features/settings/macros/macro-form'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'

export default function EditMacroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const breadcrumb = useMemo(() => ['Settings', 'Macros', 'Edit macro'], [])

  return (
    <>
      <SettingsPageHeader
        title="Edit macro"
        backHref="/settings/workspace/macros"
        breadcrumb={breadcrumb}
      />
      <MacroForm
        macro={{ id }}
        onSave={() => router.push('/settings/workspace/macros')}
        onCancel={() => router.push('/settings/workspace/macros')}
        onDelete={() => router.push('/settings/workspace/macros')}
      />
    </>
  )
}
