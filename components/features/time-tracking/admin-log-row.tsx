'use client'

import { useState } from 'react'
import { ChevronDown, AlertTriangle, Coffee } from 'lucide-react'
import { fmtDate, fmtTime, fmtDur, durSec } from '@/lib/time-tracking-constants'
import type { Session } from '@/types/time-tracking'

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
}

export function AdminLogRow({ session: s }: AdminLogRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasStructured = !!(s.what_went_well || s.needs_attention || s.emails_answered != null)
  const hasLegacy = !hasStructured && !!s.eod_report
  const canExpand = hasStructured || hasLegacy
  const { longSession, longBreak } = computeLongFlags(s)
  const summaryText = hasStructured
    ? s.what_went_well || '—'
    : hasLegacy
      ? s.eod_report
      : null

  return (
    <>
      <div
        className={`grid grid-cols-[130px_110px_60px_60px_70px_50px_1fr_24px] items-start gap-3 border-b border-black/5 px-4.5 py-2.5 transition-colors last:border-b-0 hover:bg-background ${
          canExpand ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={canExpand ? () => setIsExpanded((v) => !v) : undefined}
      >
        <div className="truncate text-[12.5px] font-semibold text-foreground">{s.member_name}</div>
        <div className="text-[12.5px] text-gray-500">{fmtDate(s.clocked_in_at)}</div>
        <div className="text-[12.5px] text-gray-500 tabular-nums">{fmtTime(s.clocked_in_at)}</div>
        <div className={`text-[12.5px] tabular-nums ${s.clocked_out_at ? 'text-gray-500' : 'text-emerald-600'}`}>
          {s.clocked_out_at ? fmtTime(s.clocked_out_at) : 'Active'}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmtDur(durSec(s))}</span>
          {longSession && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-red-600/15 bg-red-50 px-1.5 py-0 text-[10px] font-semibold text-red-600"
              title="Long session — possibly forgotten"
            >
              <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.25} />
            </span>
          )}
          {longBreak && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/20 bg-amber-50 px-1.5 py-0 text-[10px] font-semibold text-amber-700"
              title="Long break"
            >
              <Coffee className="h-2.5 w-2.5" strokeWidth={2.25} />
            </span>
          )}
        </div>
        <div className="text-[12.5px] text-foreground tabular-nums">
          {s.emails_answered != null ? s.emails_answered : <span className="text-gray-300">—</span>}
        </div>
        <div className="line-clamp-1 text-[12.5px] leading-relaxed text-gray-500">
          {summaryText || <span className="italic text-gray-300">No report</span>}
        </div>
        <div className="flex items-center justify-end text-gray-400">
          {canExpand && (
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
          )}
        </div>
      </div>

      {isExpanded && canExpand && (
        <div className="border-b border-black/5 bg-gray-50/60 px-4.5 py-3.5">
          {hasStructured ? (
            <div className="space-y-3">
              <DetailBlock label="What went well"  text={s.what_went_well} />
              <DetailBlock label="Needs attention" text={s.needs_attention} />
            </div>
          ) : (
            <DetailBlock label="Report" text={s.eod_report} />
          )}
        </div>
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
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
        {text || <span className="italic text-gray-300">—</span>}
      </div>
    </div>
  )
}
