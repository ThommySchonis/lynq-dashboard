'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { fmtTime, fmtDur } from '@/lib/time-tracking-constants'
import type { Session, EodReport } from '@/types/time-tracking'

interface ClockOutModalProps {
  session: Session
  elapsedSec: number
  pausedSeconds: number
  onConfirm: (report: EodReport) => void
  onCancel: () => void
  submitting: boolean
}

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

  const [emailsAnswered, setEmailsAnswered] = useState<string>('')
  const [whatWentWell, setWhatWentWell] = useState('')
  const [needsAttention, setNeedsAttention] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)

  const emailsNumber = emailsAnswered === '' ? null : Number(emailsAnswered)
  const emailsValid =
    emailsNumber !== null && Number.isInteger(emailsNumber) && emailsNumber >= 0
  const wentValid = whatWentWell.trim().length > 0
  const attentionValid = needsAttention.trim().length > 0
  const canSubmit = emailsValid && wentValid && attentionValid && !submitting

  // "Dirty" = the user has typed anything. emailsAnswered > 0 OR any
  // textarea non-empty. We don't gate on validity — even a partial entry
  // (e.g. "5" + empty fields) is worth confirming before discarding.
  const isDirty =
    (emailsAnswered !== '' && Number(emailsAnswered) > 0) ||
    whatWentWell.trim().length > 0 ||
    needsAttention.trim().length > 0

  function handleConfirm() {
    if (!canSubmit || emailsNumber === null) return
    onConfirm({
      emailsAnswered: emailsNumber,
      whatWentWell:   whatWentWell.trim(),
      needsAttention: needsAttention.trim(),
    })
  }

  // Cancel handler that protects against accidental data loss.
  // Empty form → cancel immediately. Dirty form → open confirm dialog.
  function handleCancelClick() {
    if (submitting) return
    if (isDirty) {
      setDiscardOpen(true)
    } else {
      onCancel()
    }
  }

  if (!mounted) return null

  // Portaled to document.body. Without this the modal's `position: fixed`
  // would be anchored to the nearest ancestor with a non-`none` transform
  // (e.g. animate-fade-up's permanent translateY(0)) instead of the
  // viewport — see PR notes for v1 regression.
  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      {/* Modal box: flex column, capped at 85vh so it never outgrows the
          viewport. Header + footer flex-shrink-0, body scrolls. */}
      <div className="flex w-full max-w-[520px] max-h-[85vh] flex-col overflow-hidden rounded-xl border border-black/9 bg-white">
        {/* Header — sticky */}
        <div className="flex-shrink-0 px-7 pt-6 pb-5 border-b border-gray-200/60">
          <h2 className="text-base font-semibold text-foreground">End of Day Report</h2>
          <div className="mt-1 text-xs text-gray-500">
            Clock-in: {fmtTime(session.clocked_in_at)} &middot; Active: {fmtDur(elapsedSec)}
            {pausedSeconds > 0 && <> &middot; Paused: {fmtDur(pausedSeconds)}</>}
          </div>
        </div>

        {/* Body — scrolls */}
        <div className="flex-1 overflow-y-auto px-7 py-5 [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
          <div className="space-y-5">
            <FieldBlock
              label="Emails answered"
              required
              hint="Total customer emails you sent today."
            >
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={emailsAnswered}
                onChange={(e) => setEmailsAnswered(e.target.value)}
                placeholder="0"
                className="w-32 rounded-lg border border-black/8 bg-gray-100 px-3 py-2 text-[13px] text-foreground placeholder:text-gray-400 outline-none transition-colors focus:border-black/20 tabular-nums"
                autoFocus
              />
            </FieldBlock>

            <FieldBlock
              label="What went well"
              required
              hint="Wins, blockers cleared, customers you helped — anything that moved forward."
            >
              <textarea
                value={whatWentWell}
                onChange={(e) => setWhatWentWell(e.target.value)}
                placeholder="Closed three tier-2 escalations from yesterday, shipped the refund-policy macro update…"
                className="w-full min-h-[88px] resize-y rounded-lg border border-black/8 bg-gray-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-gray-400 outline-none transition-colors focus:border-black/20"
              />
            </FieldBlock>

            <FieldBlock
              label="Needs attention"
              required
              hint="Open issues, customers waiting on you tomorrow, decisions you need."
            >
              <textarea
                value={needsAttention}
                onChange={(e) => setNeedsAttention(e.target.value)}
                placeholder="Order #4821 still pending carrier response. Need a call on the EU VAT change before Friday."
                className="w-full min-h-[88px] resize-y rounded-lg border border-black/8 bg-gray-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-gray-400 outline-none transition-colors focus:border-black/20"
              />
            </FieldBlock>
          </div>
        </div>

        {/* Footer — sticky */}
        <div className="flex-shrink-0 flex justify-end gap-2 border-t border-gray-200/60 bg-white px-7 py-4">
          <button
            onClick={handleCancelClick}
            disabled={submitting}
            className="h-9 rounded-[7px] border border-black/9 bg-gray-100 px-4.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="flex h-9 items-center gap-2 rounded-[7px] border-none px-5 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed"
            style={{ background: canSubmit ? '#0F0F10' : 'rgba(0,0,0,0.12)' }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Clocking out…
              </>
            ) : (
              'Clock out'
            )}
          </button>
        </div>
      </div>

      {/* Inline discard-confirm overlay. Stacks at z-[201] so it sits above
          the parent modal (z-[200]). The whole tree is portaled to body so
          both layers anchor to the viewport, not a transformed ancestor. */}
      {discardOpen && (
        <div className="fixed inset-0 z-[201] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="w-full max-w-[400px] rounded-xl border border-black/9 bg-white p-6">
            <h3 className="text-base font-semibold text-foreground">
              Discard your end-of-day report?
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
              Your work for today won&apos;t be saved. You can still clock out later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDiscardOpen(false)}
                className="h-9 rounded-[7px] border border-black/9 bg-white px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-gray-50"
              >
                Keep editing
              </button>
              <button
                onClick={() => {
                  setDiscardOpen(false)
                  onCancel()
                }}
                className="h-9 rounded-[7px] border border-red-600/15 bg-red-50 px-4 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                Discard report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}

interface FieldBlockProps {
  label:    string
  required: boolean
  hint:     string
  children: React.ReactNode
}

function FieldBlock({ label, required, hint, children }: FieldBlockProps) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <p className="mt-1 mb-2 text-[11.5px] leading-snug text-gray-400">{hint}</p>
      {children}
    </div>
  )
}
