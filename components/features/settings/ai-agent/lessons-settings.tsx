'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, Plus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { FeedbackHistory } from './feedback-history'
import { AiStoreSelect } from './ai-store-select'
import { AddLessonDialog } from './add-lesson-dialog'
import { useAuthStore } from '@/stores/auth'
import { useAiLessons, useDisableAiLesson, useAiStoreSelection } from '@/hooks/ai'
import type { AiLessonRow } from '@/hooks/ai'
import { relativeTime } from '@/lib/macros'
import { SCENARIOS } from './scenarios-section'

// Same cap as the server-side LIMIT used by the Emma prompt loader
// (lib/services/ai-onboarding.ts → getEnabledLessons). Surfaced here so
// the "N of 50 active" counter is honest about what the model actually sees.
const LESSON_PROMPT_CAP = 50

const HEADER_TITLE = 'Lessons'
const HEADER_DESC =
  "Teach Emma specific corrections that the onboarding doesn't cover. Lessons apply to one scenario or all."

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
    <div className="flex items-start justify-between gap-4 rounded-lg border border-settings-border bg-card p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="whitespace-pre-wrap break-words text-sm text-foreground-2">
          {lesson.lesson_text}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-md border border-settings-border bg-secondary px-1.5 py-0.5 text-foreground-2">
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
  const disableLesson = useDisableAiLesson(storeId)

  const [addOpen, setAddOpen] = useState(false)

  const activeCount = useMemo(() => (lessons ?? []).length, [lessons])

  // Add-lesson button lives in the page header (Figma head bar). Memoized so
  // SettingsPageHeader doesn't re-set the header context every render.
  const headerActions = useMemo(
    () =>
      canEdit && storeId ? (
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add lesson
        </Button>
      ) : undefined,
    [canEdit, storeId],
  )

  // ── Loading skeleton (stores still loading) ──
  if (storesLoading) {
    return (
      <div className="mx-auto max-w-[920px] px-6 py-10">
        <SettingsPageHeader title={HEADER_TITLE} description={HEADER_DESC} />
        <div className="flex flex-col gap-10">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  const showList = !!storeId && !lessonsLoading

  return (
    <div className="mx-auto max-w-[920px] px-6 py-10">
      <SettingsPageHeader title={HEADER_TITLE} description={HEADER_DESC} actions={headerActions} />

      {!stores || stores.length === 0 ? (
        <div className="flex items-center justify-center pt-6">
          <div className="w-[440px] max-w-full rounded-2xl border border-settings-border bg-card px-10 py-7">
            <SettingsEmptyState
              Icon={Bot}
              title="No stores yet"
              description="Connect a store first to configure its AI agent. Stores can be added under Settings → Stores."
              action={
                <Button render={<Link href="/settings/workspace/stores" />}>Connect store</Button>
              }
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <AiStoreSelect stores={stores} storeId={storeId} onChange={setStore} />
          </div>

          <Tabs defaultValue="lessons">
            <TabsList variant="line" className="mb-6">
              <TabsTrigger value="lessons">Lessons</TabsTrigger>
              <TabsTrigger value="feedback">Feedback history</TabsTrigger>
            </TabsList>

            <TabsContent value="lessons">
              {!showList ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-end">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {activeCount} of {LESSON_PROMPT_CAP} active
                    </span>
                  </div>

                  {!lessons || lessons.length === 0 ? (
                    <div className="rounded-lg border border-settings-border bg-card p-6">
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No lessons yet. Add Emma&rsquo;s first lesson.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
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
                </div>
              )}
            </TabsContent>

            <TabsContent value="feedback">{storeId && <FeedbackHistory storeId={storeId} />}</TabsContent>
          </Tabs>

          {storeId && <AddLessonDialog storeId={storeId} open={addOpen} onOpenChange={setAddOpen} />}
        </>
      )}
    </div>
  )
}
