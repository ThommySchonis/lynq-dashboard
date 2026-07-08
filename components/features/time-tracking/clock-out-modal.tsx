'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { fmtTime, fmtDur, MOODS } from '@/lib/time-tracking-constants'
import { Button } from '@/components/ui/button'
import { useEodImpact } from '@/hooks/time-tracking/use-eod-impact'
import { useEodReport } from '@/hooks/time-tracking/use-eod-report'
import type { Session, EodReport, EodImpact } from '@/types/time-tracking'

interface ClockOutModalProps {
  session: Session
  elapsedSec: number
  pausedSeconds: number
  onConfirm: (report: EodReport) => void
  onCancel: () => void
  submitting: boolean
}

// Impact tiles — labels are the display config; values come from
// useEodImpact() (real per-agent, per-day counts).
const IMPACT_TILES: { key: keyof EodImpact; label: string }[] = [
  { key: 'tickets_resolved',    label: 'Tickets resolved' },
  { key: 'messages_sent',       label: 'Messages sent' },
  { key: 'emma_drafts_handled', label: 'Emma drafts' },
]

export function ClockOutModal({
  session,
  elapsedSec,
  pausedSeconds,
  onConfirm,
  onCancel,
  submitting,
}: ClockOutModalProps) {
  // Portal mount-guard (SSR-safe access to document.body).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, []) // eslint-disable-line react-hooks/set-state-in-effect

  const [report, setReport] = useState('')
  const [mood, setMood] = useState('great')
  const [discardOpen, setDiscardOpen] = useState(false)

  const { data: impact, isLoading: impactLoading, isError: impactError } = useEodImpact(session.id)
  const { generate, generating } = useEodReport()

  const canSubmit = report.trim().length > 0 && !submitting
  const isDirty = report.trim().length > 0

  // Out time is derived from clock-in + tracked + paused (≈ now) so the
  // summary needs no impure Date.now() at render.
  const outAt = new Date(
    new Date(session.clocked_in_at).getTime() + (elapsedSec + pausedSeconds) * 1000
  ).toISOString()

  async function handleAiReply() {
    if (!impact) return
    const text = await generate({
      metrics:       impact,
      hoursTracked:  fmtDur(elapsedSec),
      breakDuration: fmtDur(pausedSeconds),
      shiftWindow:   `${fmtTime(session.clocked_in_at)} – ${fmtTime(outAt)}`,
    })
    if (text) setReport(text)
    else toast.error('Emma could not generate a report. Please try again.')
  }

  function handleConfirm() {
    if (!canSubmit) return
    onConfirm({ emailsAnswered: null, whatWentWell: report.trim(), needsAttention: null, mood })
  }

  // Empty form → cancel immediately. Dirty → confirm before discarding.
  function handleCancelClick() {
    if (submitting) return
    if (isDirty) setDiscardOpen(true)
    else onCancel()
  }

  if (!mounted) return null

  // Portaled to document.body so `position: fixed` anchors to the viewport,
  // not a transformed ancestor (e.g. animate-fade-up's translateY).
  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/15 p-4 sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-[500px] flex-col gap-5 overflow-y-auto rounded-[20px] bg-popover px-7 pt-[26px] pb-6 shadow-[0px_20px_48px_rgba(28,15,54,0.35)]">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold leading-[26px] text-foreground">End of day report</h2>
            <div className="text-sm text-foreground-3">Review your shift, then clock out</div>
          </div>
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={submitting}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground-3 transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Today's shift */}
        <div className="flex items-center justify-between rounded-[14px] bg-foreground/[0.04] px-[18px] py-4">
          <div className="flex flex-col gap-[3px]">
            <div className="text-sm text-foreground-3">Today&apos;s shift</div>
            <div className="text-sm tabular-nums text-foreground-3">
              {fmtTime(session.clocked_in_at)} → {fmtTime(outAt)}
              {pausedSeconds > 0 && <>{'  ·  '}{fmtDur(pausedSeconds)} break</>}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-lg font-semibold leading-[26px] tabular-nums text-foreground">{fmtDur(elapsedSec)}</div>
            <div className="text-sm font-semibold text-foreground-3">total tracked</div>
          </div>
        </div>

        {/* Today's impact (real) */}
        <div className="flex flex-col gap-2.5">
          <div className="text-[12px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-3">
            Today&apos;s impact
          </div>
          <div className="grid grid-cols-3 gap-3">
            {IMPACT_TILES.map((tile) => (
              <div key={tile.key} className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3.5">
                <div className="text-lg font-semibold leading-[26px] text-foreground tabular-nums">
                  {impactLoading ? (
                    <span className="inline-block h-[26px] w-8 animate-pulse rounded bg-muted align-middle" />
                  ) : impactError || !impact ? (
                    '—'
                  ) : (
                    impact[tile.key]
                  )}
                </div>
                <div className="text-sm font-semibold text-foreground-3">{tile.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mood (local only) */}
        <div className="flex flex-col gap-2.5">
          <div className="text-[12px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-3">
            How did the shift feel?
          </div>
          <div className="flex items-center gap-2.5">
            {MOODS.map((m) => {
              const selected = mood === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(m.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                    selected ? 'border-primary text-foreground' : 'border-border text-foreground-3 hover:text-foreground'
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Report */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">End-of-day report</div>
            <button
              type="button"
              onClick={() => void handleAiReply()}
              disabled={generating || impactLoading || !impact}
              className="flex h-[34px] items-center gap-2 rounded-lg border border-accent-border bg-accent-soft pl-3.5 pr-4 text-sm font-semibold text-primary transition-opacity disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" strokeWidth={2} />
                  AI Reply
                </>
              )}
            </button>
          </div>
          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Cleared the refund backlog — 42 tickets resolved, 3 escalations to ops. Flagged 2 suspected fraud orders and updated 4 macros…"
            className="min-h-[96px] w-full resize-y rounded-xl border border-accent-border bg-secondary px-4 py-3.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-foreground-4 focus:border-primary"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <Button variant="outline" onClick={handleCancelClick} disabled={submitting} className="h-11 rounded-lg px-4 text-sm font-semibold">
            Cancel
          </Button>
          <div className="flex items-center gap-2.5">
            <Button onClick={handleConfirm} disabled={!canSubmit} className="h-11 gap-2 rounded-lg px-5 text-sm font-semibold">
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Clocking out…
                </>
              ) : (
                'Submit & clock out'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Inline discard-confirm overlay (stacks above the modal). */}
      {discardOpen && (
        <div className="fixed inset-0 z-[201] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-[400px] rounded-xl border border-border bg-popover p-6">
            <h3 className="text-base font-semibold text-foreground">Discard your end-of-day report?</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground-3">
              Your work for today won&apos;t be saved. You can still clock out later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDiscardOpen(false)} className="h-9 rounded-lg px-4 text-sm font-medium">
                Keep editing
              </Button>
              <Button
                variant="destructive"
                onClick={() => { setDiscardOpen(false); onCancel() }}
                className="h-9 rounded-lg px-4 text-sm font-semibold"
              >
                Discard report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
