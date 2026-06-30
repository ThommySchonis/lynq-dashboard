'use client'

import { useState } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { fmtDate, fmtTime, fmtDur, durSec } from '@/lib/time-tracking-constants'
import type { Session } from '@/types/time-tracking'
import { StatusPill } from './status-pill'

// Shared grid template for the personal work log (no Member / actions columns).
// Date · Clock in/out · Duration · Status · Report (fill) · chevron.
const LOG_GRID = 'grid grid-cols-[100px_150px_90px_110px_minmax(0,1fr)_auto] items-center'

const COLUMNS = ['Date', 'Clock in / out', 'Duration', 'Status', 'End-of-day report', '']

interface WorkLogProps {
  sessions: Session[]
}

export function WorkLog({ sessions }: WorkLogProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card animate-fade-up">
      <div className="px-[22px] pt-5 pb-[18px]">
        <div className="text-base font-semibold text-foreground">Work Log</div>
        <div className="mt-[3px] text-sm text-foreground-3">Your sessions with end-of-day reports</div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 border-t border-border px-[22px] py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <Clock className="h-[26px] w-[26px] text-foreground-4" strokeWidth={1.5} />
          </div>
          <div className="text-base font-semibold text-foreground">No sessions yet</div>
          <div className="max-w-xs text-sm text-foreground-3">Clock in to start tracking your time.</div>
        </div>
      ) : (
        <>
          <div className={`${LOG_GRID} border-t border-border px-[22px] py-3`}>
            {COLUMNS.map((h, i) => (
              <div key={h || i} className="text-sm text-foreground-3">{h}</div>
            ))}
          </div>
          {sessions.map((s) => (
            <WorkLogRow
              key={s.id}
              session={s}
              isExpanded={expanded.has(s.id)}
              onToggle={() => toggle(s.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}

interface WorkLogRowProps {
  session:    Session
  isExpanded: boolean
  onToggle:   () => void
}

function WorkLogRow({ session: s, isExpanded, onToggle }: WorkLogRowProps) {
  const hasStructured = s.what_went_well || s.needs_attention || s.emails_answered != null
  const hasLegacy = !hasStructured && !!s.eod_report
  const canExpand = hasStructured || hasLegacy
  const summaryText = hasStructured
    ? s.what_went_well || '—'
    : hasLegacy
      ? s.eod_report
      : null

  return (
    <>
      <div
        className={`${LOG_GRID} border-b border-border px-[22px] py-3.5 transition-colors last:border-b-0 hover:bg-muted/40 ${
          canExpand ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={canExpand ? onToggle : undefined}
      >
        <div className="whitespace-nowrap text-sm text-foreground-3">{fmtDate(s.clocked_in_at)}</div>
        <div className="text-sm tabular-nums text-foreground-3">
          {fmtTime(s.clocked_in_at)} → {s.clocked_out_at ? fmtTime(s.clocked_out_at) : '—'}
        </div>
        <div className="text-sm font-semibold tabular-nums text-foreground">{fmtDur(durSec(s))}</div>
        <div><StatusPill session={s} /></div>
        <div className="line-clamp-1 pr-3 text-sm text-foreground-3">
          {summaryText || <span className="italic text-foreground-4">No report</span>}
        </div>
        <div className="flex items-center justify-end text-foreground-4">
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
          {hasStructured ? (
            <div className="space-y-3">
              <DetailBlock label="What went well" text={s.what_went_well} />
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
      <div className="text-[10px] font-bold uppercase tracking-wider text-foreground-4">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
        {text || <span className="italic text-foreground-4">—</span>}
      </div>
    </div>
  )
}
