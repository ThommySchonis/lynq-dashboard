'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { MacroForm } from '@/components/features/settings/macros/macro-form'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { useMacro, useUpdateMacro, useDeleteMacro } from '@/hooks/macros'

const BREADCRUMB = ['Settings', 'Macros', 'Edit macro']

export default function EditMacroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: macro, isLoading, error } = useMacro(id)
  const updateMacro = useUpdateMacro()
  const deleteMacro = useDeleteMacro()
  const back = () => router.push('/settings/workspace/macros')

  return (
    <>
      <SettingsPageHeader
        title="Edit macro"
        backHref="/settings/workspace/macros"
        breadcrumb={BREADCRUMB}
      />
      {isLoading ? (
        <div className="mx-auto w-full max-w-[960px] px-6 py-8 text-sm text-muted-foreground">
          Loading macro…
        </div>
      ) : error || !macro ? (
        <div className="mx-auto w-full max-w-[960px] px-6 py-8 text-sm text-destructive">
          Macro not found.
        </div>
      ) : (
        <MacroForm
          macro={macro}
          onSave={(m) =>
            updateMacro.mutate(
              {
                id,
                name: m.name ?? '',
                body: m.body ?? '',
                language: m.language ?? 'en',
                tags: m.tags ?? [],
              },
              { onSuccess: back },
            )
          }
          onCancel={back}
          onDelete={() => deleteMacro.mutate(id, { onSuccess: back })}
        />
      )}
    </>
  )
}
