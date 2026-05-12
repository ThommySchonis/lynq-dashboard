'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fmtTime, fmtDur } from '@/lib/time-tracking-constants'
import type { Session } from '@/types/time-tracking'

interface ClockOutModalProps {
  session: Session
  elapsedSec: number
  pausedSeconds: number
  onConfirm: (report: string) => void
  onCancel: () => void
  submitting: boolean
}

export function ClockOutModal({ session, elapsedSec, pausedSeconds, onConfirm, onCancel, submitting }: ClockOutModalProps) {
  const [report, setReport] = useState('')

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-[500px] rounded-xl border border-black/9 bg-white p-7">
        <h2 className="text-base font-bold text-foreground mb-1">End of Day Report</h2>
        <div className="text-xs text-gray-500 mb-4.5">
          Clock-in: {fmtTime(session.clocked_in_at)} &middot; Active: {fmtDur(elapsedSec)}
          {pausedSeconds > 0 && <> &middot; Paused: {fmtDur(pausedSeconds)}</>}
        </div>

        <div className="h-px bg-black/6 mb-4" />

        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          What did you work on today? <span className="text-red-500">*</span>
        </label>
        <textarea
          className="w-full min-h-[120px] resize-y rounded-lg border border-black/8 bg-gray-100 px-3.5 py-3 text-[13px] leading-relaxed text-foreground placeholder:text-gray-400 outline-none transition-colors focus:border-black/20"
          value={report}
          onChange={e => setReport(e.target.value)}
          placeholder="Describe your tasks, client work, what you completed or progressed on..."
          autoFocus
        />

        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="h-9 rounded-[7px] border border-black/9 bg-gray-100 px-4.5 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(report)}
            disabled={submitting || !report.trim()}
            className="flex h-9 items-center gap-2 rounded-[7px] border-none px-5 text-[13px] font-semibold text-white transition-all disabled:cursor-not-allowed"
            style={{ background: report.trim() ? '#0F0F10' : 'rgba(0,0,0,0.12)' }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Clocking out...
              </>
            ) : (
              'Clock Out \u2192'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
