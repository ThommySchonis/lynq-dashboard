'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Pencil,
  Sparkles,
  RefreshCw,
  MessageCircleDashed,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { useEmmaActivity } from '@/hooks/ai/use-emma-activity'
import {
  type DraftStatus,
  type EmmaActivityEvent,
  FEEDBACK_CATEGORY_LABELS,
} from '@/types/ai-drafts'
import type { DateRange } from '@/types/analytics'
import { timeAgo, fmtDate } from '@/lib/date-utils'

// ── Status metadata (label, icon, color tokens) ─────────────

interface StatusMeta {
  label: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  /** Tailwind classes for the pill background + text */
  pillClass: string
}

const STATUS_META: Record<DraftStatus, StatusMeta> = {
  pending: {
    label: 'Suggested',
    Icon: MessageCircleDashed,
    pillClass: 'bg-blue-500/10 text-blue-600',
  },
  approved: {
    label: 'Approved & sent',
    Icon: CheckCircle2,
    pillClass: 'bg-emerald-500/10 text-emerald-600',
  },
  edited: {
    label: 'Edited & sent',
    Icon: Pencil,
    pillClass: 'bg-emerald-500/10 text-emerald-600',
  },
  auto_sent: {
    label: 'Auto-sent by Emma',
    Icon: Sparkles,
    pillClass: 'bg-purple-500/10 text-purple-600',
  },
  declined: {
    label: 'Declined',
    Icon: XCircle,
    pillClass: 'bg-rose-500/10 text-rose-600',
  },
  regenerated: {
    label: 'Regenerated',
    Icon: RefreshCw,
    pillClass: 'bg-gray-500/10 text-gray-600',
  },
}

const ALL_STATUSES: DraftStatus[] = [
  'pending', 'approved', 'edited', 'declined', 'auto_sent', 'regenerated',
]

// ── FilterChips ──────────────────────────────────────────────

interface FilterChipsProps {
  value: DraftStatus[]
  onChange: (next: DraftStatus[]) => void
}

function FilterChips({ value, onChange }: FilterChipsProps) {
  const allActive = value.length === 0
  const toggle = (s: DraftStatus) => {
    if (value.includes(s)) onChange(value.filter((x) => x !== s))
    else onChange([...value, s])
  }
  return (
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter Emma activity by status">
      <button
        type="button"
        aria-pressed={allActive}
        onClick={() => onChange([])}
        className={
          'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
          (allActive
            ? 'bg-foreground text-background'
            : 'bg-muted text-foreground-2 hover:bg-muted/80')
        }
      >
        All
      </button>
      {ALL_STATUSES.map((s) => {
        const active = value.includes(s)
        const meta = STATUS_META[s]
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(s)}
            className={
              'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
              (active
                ? 'bg-foreground text-background'
                : 'bg-muted text-foreground-2 hover:bg-muted/80')
            }
          >
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Timestamp helpers ───────────────────────────────────────

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function formatActivityTime(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime()
  if (ageMs < ONE_DAY_MS) return timeAgo(iso)
  return fmtDate(iso)
}

// ── ActivityCard ────────────────────────────────────────────

interface ActivityCardProps {
  event: EmmaActivityEvent
}

function ActivityCard({ event }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false)
  const meta = STATUS_META[event.status]

  // ~8 lines @ ~80 chars
  const TRUNCATE_LEN = 640
  const longSuggested = event.suggested_text.length > TRUNCATE_LEN
  const longEdited = (event.edited_text?.length ?? 0) > TRUNCATE_LEN
  const showToggle = longSuggested || longEdited

  return (
    <article
      role="article"
      aria-label={`${meta.label} suggestion for ${event.customer_email ?? 'a customer'}, ${formatActivityTime(event.event_at)}`}
      className="rounded-lg border border-black/[0.07] bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
            meta.pillClass
          }
        >
          <meta.Icon size={12} />
          {meta.label}
        </span>
        <time
          dateTime={event.event_at}
          title={new Date(event.event_at).toISOString()}
          className="text-xs text-foreground-4"
        >
          {formatActivityTime(event.event_at)}
        </time>
      </div>

      <div className="mb-3 text-sm">
        <span className="font-medium text-foreground">{event.customer_email ?? 'Unknown sender'}</span>
        {event.conversation_subject && (
          <span className="text-foreground-3"> · {event.conversation_subject}</span>
        )}
      </div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-4">
        Emma suggested
      </div>
      <div
        className={
          'mb-3 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-foreground-2 ' +
          (longSuggested && !expanded ? 'line-clamp-8' : '')
        }
      >
        {event.suggested_text}
      </div>

      {event.edited_text && (
        <>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-4">
            Sent (edited by agent)
          </div>
          <div
            className={
              'mb-3 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-foreground-2 ' +
              (longEdited && !expanded ? 'line-clamp-8' : '')
            }
          >
            {event.edited_text}
          </div>
        </>
      )}

      {event.feedback_category && (
        <>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-4">
            Decline reason
          </div>
          <div className="text-sm text-rose-600">
            {FEEDBACK_CATEGORY_LABELS[event.feedback_category]}
            {event.feedback_comment && (
              <span className="text-foreground-3"> — &ldquo;{event.feedback_comment}&rdquo;</span>
            )}
          </div>
        </>
      )}

      {showToggle && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </article>
  )
}

// ── State sub-components ────────────────────────────────────

function SkeletonRows({ count }: { count: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="rounded-lg border border-black/[0.07] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="mb-3 h-4 w-2/3" />
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="h-16 w-full rounded-md" />
        </li>
      ))}
    </ul>
  )
}

function FeedEmptyState({ filtered }: { filtered: boolean }) {
  const title = filtered
    ? 'No matching activity in this period'
    : 'No Emma activity in this period'
  const description = filtered
    ? 'Try a different status or widen the date range.'
    : 'Try widening the date range above.'
  return (
    <EmptyState icon={Sparkles} title={title} description={description} />
  )
}

function FeedErrorState({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-700">
        <AlertCircle size={16} />
        Couldn&apos;t load Emma activity
      </div>
      <p className="mb-3 text-xs text-foreground-3">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

// ── EmmaActivityFeed (exported) ─────────────────────────────

export interface EmmaActivityFeedProps {
  range: DateRange
}

export function EmmaActivityFeed({ range }: EmmaActivityFeedProps) {
  const [statuses, setStatuses] = useState<DraftStatus[]>([])
  const { events, hasMore, isLoading, isFetchingMore, error, fetchMore, refetch } =
    useEmmaActivity({ range, statuses })

  return (
    <section className="mt-6">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-foreground">Recent Emma activity</h3>
        <p className="text-xs text-foreground-3">
          Suggestions Emma created and how your team responded.
        </p>
      </header>

      <div className="mb-4">
        <FilterChips value={statuses} onChange={setStatuses} />
      </div>

      {error ? (
        <FeedErrorState onRetry={refetch} message={error.message} />
      ) : isLoading ? (
        <SkeletonRows count={4} />
      ) : events.length === 0 ? (
        <FeedEmptyState filtered={statuses.length > 0} />
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <ActivityCard event={e} />
            </li>
          ))}
        </ul>
      )}

      {hasMore && !error && events.length > 0 && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={fetchMore}
            disabled={isFetchingMore}
          >
            {isFetchingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </section>
  )
}
