'use client'

import { useState } from 'react'
import { BookOpen, MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { useAuthStore } from '@/stores/auth'
import { useResolvedDrafts, usePromoteDraftToLesson, usePromoteDraftToExample } from '@/hooks/ai'
import { FEEDBACK_CATEGORY_LABELS, type ResolvedDraft, type FeedbackCategory } from '@/types/ai-drafts'
import { relativeTime } from '@/lib/macros'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  approved:    { label: 'Approved',    color: 'text-green-600 dark:text-green-400' },
  edited:      { label: 'Edited',      color: 'text-blue-600 dark:text-blue-400' },
  declined:    { label: 'Declined',    color: 'text-red-600 dark:text-red-400' },
  auto_sent:   { label: 'Auto-sent',   color: 'text-amber-600 dark:text-amber-400' },
  regenerated: { label: 'Regenerated', color: 'text-muted-foreground' },
}

function DraftCard({
  draft,
  canEdit,
  storeId,
}: {
  draft: ResolvedDraft
  canEdit: boolean
  storeId: string
}) {
  const [showPromote, setShowPromote] = useState<'lesson' | 'example' | null>(null)
  const [promoteText, setPromoteText] = useState('')
  const promoteLessonMut = usePromoteDraftToLesson(storeId)
  const promoteExampleMut = usePromoteDraftToExample(storeId)

  const statusMeta = STATUS_LABELS[draft.status] ?? { label: draft.status, color: 'text-muted-foreground' }
  const when = relativeTime(draft.resolved_at)
  const alreadyPromoted = !!draft.promoted_to_lesson_id || !!draft.promoted_to_example_id

  async function handlePromote() {
    const text = promoteText.trim()
    if (!text) return
    try {
      if (showPromote === 'lesson') {
        await promoteLessonMut.mutateAsync({ draftId: draft.id, lessonText: text })
        toast.success('Promoted to lesson')
      } else {
        await promoteExampleMut.mutateAsync({ draftId: draft.id, exampleText: text })
        toast.success('Promoted to example')
      }
      setShowPromote(null)
      setPromoteText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Promotion failed')
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className={`font-semibold ${statusMeta.color}`}>{statusMeta.label}</span>
            {when && <span className="text-muted-foreground">{when}</span>}
          </div>
          {draft.conversation_subject && (
            <p className="text-xs text-muted-foreground truncate">{draft.conversation_subject}</p>
          )}
        </div>
        {alreadyPromoted && (
          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
            Promoted
          </span>
        )}
      </div>

      <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-2">
        {draft.suggested_text}
      </p>

      {draft.edited_text && (
        <div className="mb-2 pl-3 border-l-2 border-blue-300 dark:border-blue-700">
          <p className="text-xs text-muted-foreground mb-0.5">Edited version:</p>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {draft.edited_text}
          </p>
        </div>
      )}

      {draft.feedback_category && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <span className="font-medium">
            {FEEDBACK_CATEGORY_LABELS[draft.feedback_category as FeedbackCategory] ?? draft.feedback_category}
          </span>
          {draft.feedback_comment && <span>— {draft.feedback_comment}</span>}
        </div>
      )}

      {canEdit && !alreadyPromoted && (
        <>
          {!showPromote ? (
            <div className="flex gap-1.5 mt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowPromote('lesson'); setPromoteText(draft.feedback_comment || draft.suggested_text) }}>
                <BookOpen className="size-3.5 mr-1" />
                Promote to lesson
              </Button>
              {draft.status !== 'declined' && draft.status !== 'regenerated' && (
                <Button variant="outline" size="sm" onClick={() => { setShowPromote('example'); setPromoteText(draft.edited_text || draft.suggested_text) }}>
                  <MessageSquarePlus className="size-3.5 mr-1" />
                  Promote to example
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs font-medium text-foreground">
                {showPromote === 'lesson' ? 'Lesson text' : 'Example text'}
              </p>
              <Textarea
                value={promoteText}
                onChange={(e) => setPromoteText(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowPromote(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handlePromote()}
                  disabled={!promoteText.trim() || promoteLessonMut.isPending || promoteExampleMut.isPending}
                >
                  {(promoteLessonMut.isPending || promoteExampleMut.isPending) ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface FeedbackHistoryProps {
  storeId: string
}

export function FeedbackHistory({ storeId }: FeedbackHistoryProps) {
  const role = useAuthStore((s) => s.role)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const canEdit = !isSuspended && (role === 'owner' || role === 'admin')

  const { data: drafts, isLoading } = useResolvedDrafts(storeId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <SettingsSection
      title="Feedback history"
      description="Resolved suggestions with agent feedback. Promote useful signals to lessons or examples."
    >
      {(!drafts || drafts.length === 0) ? (
        <SettingsCard>
          <p className="text-sm text-muted-foreground text-center py-6">
            No resolved suggestions yet. Feedback will appear here as agents approve, edit, or decline Emma&rsquo;s replies.
          </p>
        </SettingsCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {drafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} canEdit={canEdit} storeId={storeId} />
          ))}
        </div>
      )}
    </SettingsSection>
  )
}
