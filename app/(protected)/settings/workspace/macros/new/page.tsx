'use client'

import { useRouter } from 'next/navigation'
import { MacroForm } from '@/components/features/settings/macros/macro-form'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { useCreateMacro } from '@/hooks/macros'

const BREADCRUMB = ['Settings', 'Macros', 'Create macro']

export default function NewMacroPage() {
  const router = useRouter()
  const createMacro = useCreateMacro()
  const back = () => router.push('/settings/workspace/macros')

  return (
    <>
      <SettingsPageHeader
        title="Create macro"
        backHref="/settings/workspace/macros"
        breadcrumb={BREADCRUMB}
      />
      <MacroForm
        macro={null}
        onSave={(m) =>
          createMacro.mutate(
            {
              name: m.name ?? '',
              body: m.body ?? '',
              language: m.language ?? 'en',
              tags: m.tags ?? [],
            },
            { onSuccess: back },
          )
        }
        onCancel={back}
      />
    </>
  )
}
