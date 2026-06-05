'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { useAiExamples, useAddAiExample, useDeleteAiExample } from '@/hooks/ai'
import type { AiExampleRow } from '@/hooks/ai'
import { relativeTime } from '@/lib/macros'

interface ExampleCardProps {
  example: AiExampleRow
  canEdit: boolean
  isDeleting: boolean
  onDelete: () => void
}

function ExampleCard({ example, canEdit, isDeleting, onDelete }: ExampleCardProps) {
  const when = relativeTime(example.created_at)
  return (
    <div className="flex items-start justify-between gap-4 border border-border rounded-lg bg-card p-4">
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
          {example.example_text}
        </p>
        {when && (
          <span className="text-xs text-muted-foreground">Added {when}</span>
        )}
      </div>
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="flex-shrink-0"
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </Button>
      )}
    </div>
  )
}

interface ExamplesSectionProps {
  storeId: string
  canEdit: boolean
}

export function ExamplesSection({ storeId, canEdit }: ExamplesSectionProps) {
  const { data: examples } = useAiExamples(storeId)
  const addExample = useAddAiExample(storeId)
  const deleteExample = useDeleteAiExample(storeId)

  const [draft, setDraft] = useState('')
  const trimmedDraft = draft.trim()
  const canSubmit = canEdit && trimmedDraft.length > 0 && !addExample.isPending

  async function handleAdd() {
    if (!canSubmit) return
    await addExample.mutateAsync({ example_text: trimmedDraft })
    setDraft('')
  }

  const count = examples?.length ?? 0

  return (
    <SettingsSection
      title="Example replies"
      description="Sample replies that show Emma the desired voice and structure for this store. Add as many as you like; the 10 newest are used."
      actions={
        <span className="text-xs text-muted-foreground tabular-nums">
          {count} example{count === 1 ? '' : 's'}
        </span>
      }
    >
      {count === 0 ? (
        <SettingsCard>
          <p className="text-sm text-muted-foreground text-center py-6">
            No examples yet. Add one below.
          </p>
        </SettingsCard>
      ) : (
        <div className="flex flex-col gap-2.5 mb-6">
          {(examples ?? []).map((ex) => (
            <ExampleCard
              key={ex.id}
              example={ex}
              canEdit={canEdit}
              isDeleting={deleteExample.isPending && deleteExample.variables === ex.id}
              onDelete={() => deleteExample.mutate(ex.id)}
            />
          ))}
        </div>
      )}

      <SettingsCard
        footer={
          canEdit ? (
            <Button onClick={() => void handleAdd()} disabled={!canSubmit}>
              {addExample.isPending ? 'Adding…' : 'Add example'}
            </Button>
          ) : undefined
        }
      >
        <SettingsField label="Example reply" htmlFor="ai-example-text">
          <Textarea
            id="ai-example-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a sample reply that reflects how Emma should sound and structure her response…"
            disabled={!canEdit}
            rows={6}
          />
        </SettingsField>
      </SettingsCard>
    </SettingsSection>
  )
}
