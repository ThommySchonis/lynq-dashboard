'use client'

import { useMemo, useState } from 'react'
import { Bot, Plus, Flag, Globe, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FeedbackHistory } from './feedback-history'
import { AiAgentSettingsShell } from './ai-agent-settings-shell'
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

/** Scenario pill — flag for a specific scenario, globe for "All scenarios". */
function ScenarioBadge({ scenario }: { scenario: string | null }) {
  const Icon = scenario ? Flag : Globe
  return (
    <span className="inline-flex items-center gap-[7px] rounded-full bg-input py-1 pr-[11px] pl-[9px] text-xs font-semibold text-foreground-3">
      <Icon className="size-[13px]" strokeWidth={2} />
      {scenarioLabel(scenario)}
    </span>
  )
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
    <div className="flex flex-col gap-3 rounded-[14px] border border-settings-border bg-card p-[18px]">
      <div className="flex items-center justify-between gap-3">
        <ScenarioBadge scenario={lesson.applies_to_scenario} />
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft py-1 pr-2.5 pl-[9px] text-xs font-semibold text-success-strong">
            <span className="size-1.5 rounded-full bg-success" />
            Active
          </span>
          {canEdit && (
            <Button
              variant="outline"
              onClick={onDisable}
              disabled={isDisabling}
              className="h-auto rounded-lg border-settings-border px-3 py-[7px] text-xs font-semibold text-foreground-2"
            >
              {isDisabling ? 'Disabling…' : 'Disable'}
            </Button>
          )}
        </div>
      </div>

      <p className="whitespace-pre-wrap break-words text-sm text-foreground-2">
        {lesson.lesson_text}
      </p>

      {when && <p className="text-xs text-foreground-4">Added {when}</p>}
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
  const [query, setQuery] = useState('')

  const activeCount = (lessons ?? []).length

  // Client-side search over lesson text + scenario label.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = lessons ?? []
    if (!q) return list
    return list.filter(
      (l) =>
        l.lesson_text.toLowerCase().includes(q) ||
        scenarioLabel(l.applies_to_scenario).toLowerCase().includes(q),
    )
  }, [lessons, query])

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

  const showList = !!storeId && !lessonsLoading

  return (
    <AiAgentSettingsShell
      title={HEADER_TITLE}
      description={HEADER_DESC}
      emptyIcon={Bot}
      headerActions={headerActions}
      storesLoading={storesLoading}
      stores={stores}
      storeId={storeId}
      onStoreChange={setStore}
    >
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
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-[260px]">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-foreground-4" />
                  <Input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search lessons…"
                    className="h-[38px] rounded-[10px] border-settings-border bg-card pr-3 pl-9 text-sm placeholder:text-foreground-4"
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {activeCount} of {LESSON_PROMPT_CAP} active
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-[14px] border border-settings-border bg-card p-6">
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {activeCount === 0 ? (
                      <>No lessons yet. Add Emma&rsquo;s first lesson.</>
                    ) : (
                      <>No lessons match &ldquo;{query.trim()}&rdquo;.</>
                    )}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filtered.map((lesson) => (
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

        <TabsContent value="feedback">
          {storeId && <FeedbackHistory storeId={storeId} />}
        </TabsContent>
      </Tabs>

      {storeId && <AddLessonDialog storeId={storeId} open={addOpen} onOpenChange={setAddOpen} />}
    </AiAgentSettingsShell>
  )
}
