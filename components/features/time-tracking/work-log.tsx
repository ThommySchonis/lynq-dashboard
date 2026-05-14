'use client'

import { useState } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { fmtDate, fmtTime, fmtDur, durSec } from '@/lib/time-tracking-constants'
import type { Session } from '@/types/time-tracking'

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
    <div className="overflow-hidden rounded-[10px] border border-black/7 bg-white opacity-0 animate-fade-up delay-150">
      <div className="border-b border-black/6 px-4.5 py-3.5">
        <div className="text-[13px] font-semibold text-foreground">Work Log</div>
        <div className="mt-0.5 text-xs text-gray-500">Your sessions with end-of-day reports</div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-12 px-4.5">
          <Clock className="h-8 w-8 text-gray-300" strokeWidth={1.5} />
          <div className="text-sm font-medium text-foreground">No sessions yet</div>
          <div className="text-[13px] text-gray-500">Clock in to start tracking your time</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[130px_140px_70px_60px_1fr_24px] gap-3 border-b border-black/5 px-4.5 py-2.5">
            {['Date', 'Time', 'Hours', 'Emails', 'Summary', ''].map((h) => (
              <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {h}
              </div>
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
        className={`grid grid-cols-[130px_140px_70px_60px_1fr_24px] gap-3 border-b border-black/5 px-4.5 py-2.5 transition-colors last:border-b-0 hover:bg-background ${
          canExpand ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={canExpand ? onToggle : undefined}
      >
        <div className="text-xs font-medium text-foreground">{fmtDate(s.clocked_in_at)}</div>
        <div className="text-xs text-gray-500 tabular-nums">
          {fmtTime(s.clocked_in_at)} &ndash;{' '}
          {s.clocked_out_at ? fmtTime(s.clocked_out_at) : <span className="text-emerald-600">Active</span>}
        </div>
        <div className="text-[13px] font-semibold text-foreground tabular-nums">{fmtDur(durSec(s))}</div>
        <div className="text-[13px] text-foreground tabular-nums">
          {s.emails_answered != null ? s.emails_answered : <span className="text-gray-300">—</span>}
        </div>
        <div className="line-clamp-1 text-xs leading-relaxed text-gray-500">
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
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
        {text || <span className="italic text-gray-300">—</span>}
      </div>
    </div>
  )
}
