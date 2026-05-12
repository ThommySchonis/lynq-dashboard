'use client'

import { Clock } from 'lucide-react'
import { fmtDate, fmtTime, fmtDur, durSec } from '@/lib/time-tracking-constants'
import type { Session } from '@/types/time-tracking'

interface WorkLogProps {
  sessions: Session[]
}

export function WorkLog({ sessions }: WorkLogProps) {
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
          <div className="grid grid-cols-[130px_140px_70px_1fr] gap-3 border-b border-black/5 px-4.5 py-2.5">
            {['Date', 'Time', 'Hours', 'Report'].map(h => (
              <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</div>
            ))}
          </div>
          {sessions.map(s => (
            <div
              key={s.id}
              className="grid grid-cols-[130px_140px_70px_1fr] gap-3 border-b border-black/5 px-4.5 py-2.5 transition-colors last:border-b-0 hover:bg-background"
            >
              <div className="text-xs font-medium text-foreground">{fmtDate(s.clocked_in_at)}</div>
              <div className="text-xs text-gray-500 tabular-nums">
                {fmtTime(s.clocked_in_at)} &ndash; {s.clocked_out_at ? fmtTime(s.clocked_out_at) : <span className="text-emerald-600">Active</span>}
              </div>
              <div className="text-[13px] font-semibold text-foreground tabular-nums">{fmtDur(durSec(s))}</div>
              <div className="line-clamp-2 text-xs leading-relaxed text-gray-500">
                {s.eod_report || <span className="italic text-gray-300">No report</span>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
