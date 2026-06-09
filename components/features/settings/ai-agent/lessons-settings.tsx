'use client'

import { useState, useMemo } from 'react'
import { Bot } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { EmptyState } from '@/components/shared/empty-state'
import { FeedbackHistory } from './feedback-history'
import { useAuthStore } from '@/stores/auth'
import {
  useAiLessons,
  useAddAiLesson,
  useDisableAiLesson,
  useAiStoreSelection,
} from '@/hooks/ai'
import type { AiLessonRow } from '@/hooks/ai'
import { relativeTime } from '@/lib/macros'
import { SCENARIOS } from './scenarios-section'

// Same cap as the server-side LIMIT used by the Emma prompt loader
// (lib/services/ai-onboarding.ts → getEnabledLessons). Surfaced here so
// the "N of 50 active" counter is honest about what the model actually sees.
const LESSON_PROMPT_CAP = 50

// "All scenarios" sentinel for the scenario dropdown. Cannot use empty
// string because base-ui's Select treats '' as null/unset.
const ALL_SCENARIOS_VALUE = '__all__'

function scenarioLabel(key: string | null): string {
  if (!key) return 'All scenarios'
  return SCENARIOS.find((s) => s.key === key)?.title ?? key
}

function LessonCard({
  lesson,
  canEdit,
  isDisabling,
  onDisable,
}: {
  lesson: AiLessonRow
  canEdit: boolean
  isDisabling: boolean
  onDisable: () => void
}) {
  const when = relativeTime(lesson.created_at)
  return (
    <div className="flex items-start justify-between gap-4 border border-border rounded-lg bg-card p-4">
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
          {lesson.lesson_text}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-md border border-border bg-secondary px-1.5 py-0.5 text-foreground-2">
            {scenarioLabel(lesson.applies_to_scenario)}
          </span>
          {when && <span>Added {when}</span>}
        </div>
      </div>
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDisable}
          disabled={isDisabling}
          className="flex-shrink-0"
        >
          {isDisabling ? 'Disabling…' : 'Disable'}
        </Button>
      )}
    </div>
  )
}

export function LessonsSettings() {
  const role = useAuthStore((s) => s.role)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const canEdit = !isSuspended && (role === 'owner' || role === 'admin')

  // ── Store selection (persisted in ?store=) ──
  const { storeId, setStore, stores, storesLoading } = useAiStoreSelection()

  // ── Server data for the selected store ──
  const { data: lessons, isLoading: lessonsLoading } = useAiLessons(storeId)
  const addLesson = useAddAiLesson(storeId)
  const disableLesson = useDisableAiLesson(storeId)

  // ── Add-lesson form state (local; explicit save) ──
  const [draftText, setDraftText] = useState('')
  const [draftScenario, setDraftScenario] = useState<string>(ALL_SCENARIOS_VALUE)
  const trimmedDraft = draftText.trim()
  const canSubmit = canEdit && trimmedDraft.length > 0 && !addLesson.isPending

  async function handleAdd() {
    if (!canSubmit) return
    await addLesson.mutateAsync({
      lesson_text:         trimmedDraft,
      applies_to_scenario: draftScenario === ALL_SCENARIOS_VALUE ? null : draftScenario,
    })
    setDraftText('')
    setDraftScenario(ALL_SCENARIOS_VALUE)
  }

  const activeCount = useMemo(() => (lessons ?? []).length, [lessons])

  // ── Loading skeleton (stores still loading) ──
  if (storesLoading) {
    return (
      <div className="max-w-3xl mx-auto px-12 py-12 space-y-10">
        <div className="space-y-2 pb-6 border-b border-border">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    )
  }

  const showSections = !!storeId && !lessonsLoading

  return (
    <div className="max-w-3xl mx-auto px-12 py-12">
      {/* Header */}
      <div className="pb-6 mb-8 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 flex-wrap">
          <span>Settings</span>
          <span>/</span>
          <span>AI agent</span>
          <span>/</span>
          <span>Lessons</span>
        </div>
        <h1 className="text-[28px] font-semibold text-foreground leading-tight mb-1">Lessons</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Teach Emma specific corrections that the onboarding doesn&rsquo;t
          cover. Lessons apply to one scenario or all.
        </p>
      </div>

      {!stores || stores.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No stores yet"
          description="Connect a store first to teach its AI agent. Stores can be added under Settings → Stores."
        />
      ) : (
        <>
          {/* Store selector */}
          <div className="mb-8 flex flex-col gap-1.5 max-w-xs">
            <Label htmlFor="ai-lessons-store-select" className="text-sm font-medium text-foreground">
              Store
            </Label>
            <Select value={storeId} onValueChange={(v) => v && setStore(v)}>
              <SelectTrigger id="ai-lessons-store-select" className="w-full">
                <SelectValue placeholder="Select a store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="lessons">
            <TabsList variant="line" className="mb-6">
              <TabsTrigger value="lessons">Lessons</TabsTrigger>
              <TabsTrigger value="feedback">Feedback history</TabsTrigger>
            </TabsList>

            <TabsContent value="lessons">
              {!showSections ? (
                <div className="flex flex-col gap-10">
                  <Skeleton className="h-40 w-full rounded-xl" />
                  <Skeleton className="h-52 w-full rounded-xl" />
                </div>
              ) : (
                <div className="flex flex-col gap-10">
                  {/* Recent learnings */}
                  <SettingsSection
                    title="Recent learnings"
                    description="Active lessons Emma uses when drafting replies for this store."
                    actions={
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {activeCount} of {LESSON_PROMPT_CAP} active
                      </span>
                    }
                  >
                    {(!lessons || lessons.length === 0) ? (
                      <SettingsCard>
                        <p className="text-sm text-muted-foreground text-center py-6">
                          No lessons yet. Add Emma&rsquo;s first lesson below.
                        </p>
                      </SettingsCard>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {lessons.map((lesson) => (
                          <LessonCard
                            key={lesson.id}
                            lesson={lesson}
                            canEdit={canEdit}
                            isDisabling={
                              disableLesson.isPending && disableLesson.variables === lesson.id
                            }
                            onDisable={() => disableLesson.mutate(lesson.id)}
                          />
                        ))}
                      </div>
                    )}
                  </SettingsSection>

                  {/* Add a new lesson */}
                  <SettingsSection
                    title="Add a lesson"
                    description="Saved lessons are injected into Emma's prompt right after the scenarios section."
                  >
                    <SettingsCard
                      footer={
                        canEdit ? (
                          <Button onClick={() => void handleAdd()} disabled={!canSubmit}>
                            {addLesson.isPending ? 'Adding…' : 'Add lesson'}
                          </Button>
                        ) : undefined
                      }
                    >
                      <div className="flex flex-col gap-5">
                        <SettingsField label="Lesson" htmlFor="ai-lesson-text">
                          <Textarea
                            id="ai-lesson-text"
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            placeholder="What should Emma learn for this store?"
                            disabled={!canEdit}
                            rows={4}
                          />
                        </SettingsField>

                        <SettingsField
                          label="Applies to"
                          htmlFor="ai-lesson-scenario"
                          hint={'Pick a scenario, or leave on "All scenarios" so the lesson applies everywhere.'}
                        >
                          <Select
                            value={draftScenario}
                            onValueChange={(v) => v && setDraftScenario(v)}
                          >
                            <SelectTrigger id="ai-lesson-scenario" className="w-full max-w-xs">
                              <SelectValue placeholder="All scenarios" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL_SCENARIOS_VALUE}>All scenarios</SelectItem>
                              {SCENARIOS.map((s) => (
                                <SelectItem key={s.key} value={s.key}>
                                  {s.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </SettingsField>
                      </div>
                    </SettingsCard>
                  </SettingsSection>
                </div>
              )}
            </TabsContent>

            <TabsContent value="feedback">
              {storeId && <FeedbackHistory storeId={storeId} />}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
