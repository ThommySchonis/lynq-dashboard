'use client'

import { useState } from 'react'
import { ChevronDown, AlertTriangle, Coffee, Pencil } from 'lucide-react'
import { fmtDate, fmtTime, fmtDur, durSec, moodById } from '@/lib/time-tracking-constants'
import type { Session, TeamMember } from '@/types/time-tracking'
import { SessionEditModal, type EditPatch } from './session-edit-modal'
import { StatusPill } from './status-pill'
import { useEditSession } from '@/hooks/time-tracking/use-time-tracking-mutations'
import { useAuthStore } from '@/stores/auth'

// Shared grid template for the sessions table — used by both the header row
// (in SessionsCard) and every data row here so columns stay aligned.
// Member · Date · Clock in/out · Duration · Status · Report (fill) · actions.
export const SESSIONS_GRID =
  'grid grid-cols-[190px_84px_138px_88px_104px_minmax(0,1fr)_auto] items-center'

// Thresholds for the visual flags shown in admin/owner views only.
// No auto-clock-out — these are UI hints, never actions.
const LONG_SESSION_THRESHOLD_S = 12 * 3600  // 12h elapsed active time
const LONG_BREAK_THRESHOLD_S   =  2 * 3600  //  2h paused

interface LongFlags {
  longSession: boolean
  longBreak:   boolean
}

function computeLongFlags(s: Session): LongFlags {
  let longSession = false
  if (!s.clocked_out_at) {
    const elapsed = Math.round((Date.now() - new Date(s.clocked_in_at).getTime()) / 1000)
    const active  = elapsed - (s.paused_seconds || 0)
    longSession = active > LONG_SESSION_THRESHOLD_S
  }

  let longBreak = false
  if (s.status === 'paused' && s.paused_at) {
    const breakElapsed = Math.round((Date.now() - new Date(s.paused_at).getTime()) / 1000)
    longBreak = breakElapsed > LONG_BREAK_THRESHOLD_S
  }

  return { longSession, longBreak }
}

interface AdminLogRowProps {
  session: Session
  /** When true, render an Edit pencil button and enable the edit modal. */
  canEdit?: boolean
  /** Optional members map for resolving last_edit_by → display name. */
  membersById?: Record<string, TeamMember>
}

export function AdminLogRow({ session: s, canEdit = false, membersById }: AdminLogRowProps) {
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const [isExpanded, setIsExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const editMutation = useEditSession()

  const hasStructured = !!(s.what_went_well || s.needs_attention)
  const hasLegacy = !hasStructured && !!s.eod_report
  const wasEdited = !!s.last_edit_at
  const canExpand = hasStructured || hasLegacy || wasEdited
  const { longSession, longBreak } = computeLongFlags(s)
  const mood = moodById(s.mood)

  // Resolve editor name from the members map (if provided). Falls back to
  // a truncated UUID when we don't have it (e.g. Lynq cross-workspace
  // edits from a member who's been removed since).
  const editorName = s.last_edit_by && membersById
    ? membersById[s.last_edit_by]?.name ?? `${s.last_edit_by.slice(0, 8)}…`
    : null

  function handleEditSubmit(patch: EditPatch) {
    setEditError(null)
    editMutation.mutate({ sessionId: s.id, patch }, {
      onSuccess: () => setEditOpen(false),
      onError:   (err) => setEditError(err instanceof Error ? err.message : 'Could not save'),
    })
  }

  const summaryText = hasStructured
    ? s.what_went_well || '—'
    : hasLegacy
      ? s.eod_report
      : null

  return (
    <>
      <div
        className={`${SESSIONS_GRID} border-b border-border px-[22px] py-3.5 transition-colors last:border-b-0 hover:bg-muted/40 ${
          canExpand ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={canExpand ? () => setIsExpanded((v) => !v) : undefined}
      >
        {/* Member */}
        <div className="flex items-center gap-[9px] pr-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-foreground-4 text-[11px] font-semibold text-background">
            {s.member_name?.charAt(0).toUpperCase() || '?'}
          </div>
          <span className="truncate text-sm font-semibold text-foreground">{s.member_name}</span>
          {mood && (
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${mood.dot}`}
              title={`Shift felt: ${mood.label}`}
            />
          )}
        </div>

        {/* Date */}
        <div className="whitespace-nowrap text-sm text-foreground-3">{fmtDate(s.clocked_in_at)}</div>

        {/* Clock in / out */}
        <div className="text-sm tabular-nums text-foreground-3">
          {fmtTime(s.clocked_in_at)} → {s.clocked_out_at ? fmtTime(s.clocked_out_at) : '—'}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums text-foreground">{fmtDur(durSec(s))}</span>
          {longSession && (
            <span
              className="inline-flex shrink-0 items-center rounded-full border border-destructive/15 bg-destructive-soft px-1.5 py-0 text-[10px] font-semibold text-destructive"
              title="Long session — possibly forgotten"
            >
              <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.25} />
            </span>
          )}
          {longBreak && (
            <span
              className="inline-flex shrink-0 items-center rounded-full border border-warning/20 bg-warning-soft px-1.5 py-0 text-[10px] font-semibold text-warning"
              title="Long break"
            >
              <Coffee className="h-2.5 w-2.5" strokeWidth={2.25} />
            </span>
          )}
        </div>

        {/* Status */}
        <div>
          <StatusPill session={s} />
        </div>

        {/* End-of-day report */}
        <div className="line-clamp-1 pr-3 text-sm text-foreground-3">
          {summaryText || <span className="italic text-foreground-4">No report</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 text-foreground-4">
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
              title={isSuspended ? 'Workspace is suspended' : 'Edit session'}
              disabled={isSuspended}
              className="rounded p-1 text-foreground-4 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil className="h-3 w-3" strokeWidth={2} />
            </button>
          )}
          {canExpand && (
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
          )}
        </div>
      </div>

      {isExpanded && canExpand && (
        <div className="border-b border-border bg-muted/40 px-[22px] py-3.5">
          {mood && (
            <div className={(hasStructured || hasLegacy) ? 'mb-3' : ''}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground-4">Mood</div>
              <div className="mt-1 flex items-center gap-2 text-[12.5px] leading-relaxed text-foreground">
                <span className={`h-2 w-2 shrink-0 rounded-full ${mood.dot}`} />
                {mood.label}
              </div>
            </div>
          )}
          {hasStructured ? (
            <div className="space-y-3">
              <DetailBlock label="What went well"  text={s.what_went_well} />
              <DetailBlock label="Needs attention" text={s.needs_attention} />
            </div>
          ) : hasLegacy ? (
            <DetailBlock label="Report" text={s.eod_report} />
          ) : null}
          {wasEdited && s.last_edit_at && (
            <div className={`text-[11.5px] italic text-foreground-3 ${(hasStructured || hasLegacy) ? 'mt-3 border-t border-border pt-3' : ''}`}>
              Edited{editorName ? ` by ${editorName}` : ''} on{' '}
              {new Date(s.last_edit_at).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}
        </div>
      )}

      {editOpen && (
        <SessionEditModal
          session={s}
          submitting={editMutation.isPending}
          errorMsg={editError}
          onSubmit={handleEditSubmit}
          onCancel={() => { setEditOpen(false); setEditError(null) }}
        />
      )}
    </>
  )
}

interface DetailBlockProps {
  label: string
  text:  string | null
}

function DetailBlock({ label, text }: DetailBlockProps) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-foreground-4">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
        {text || <span className="italic text-foreground-4">—</span>}
      </div>
    </div>
  )
}
