'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { fmtDate } from '@/lib/time-tracking-constants'
import type { Session } from '@/types/time-tracking'

interface SessionEditModalProps {
  session: Session
  submitting: boolean
  errorMsg:   string | null
  onSubmit:   (patch: EditPatch) => void
  onCancel:   () => void
}

export interface EditPatch {
  clocked_in_at?:  string
  clocked_out_at?: string | null
  what_went_well?:  string | null
  needs_attention?: string | null
  reason:          string
}

// Convert ISO → 'YYYY-MM-DDTHH:mm' for datetime-local. Local timezone.
function toDtLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

// 'YYYY-MM-DDTHH:mm' (local) → ISO string. Empty string → null.
function fromDtLocal(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function SessionEditModal({
  session,
  submitting,
  errorMsg,
  onSubmit,
  onCancel,
}: SessionEditModalProps) {
  const [clockIn, setClockIn]       = useState<string>(toDtLocal(session.clocked_in_at))
  const [clockOut, setClockOut]     = useState<string>(toDtLocal(session.clocked_out_at))
  const [wentWell, setWentWell]     = useState<string>(session.what_went_well ?? '')
  const [needsAttn, setNeedsAttn]   = useState<string>(session.needs_attention ?? '')
  const [reason, setReason]         = useState<string>('')

  // Portal mount-guard. Without this, SSR would crash on document.body access.
  // The mounted flag flips on first client-side render; before that we return
  // null so the SSR pass and the first client render agree (no hydration mismatch).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, []) // eslint-disable-line react-hooks/set-state-in-effect

  const reasonValid = reason.trim().length >= 3

  const canSubmit = reasonValid && !submitting

  function handleSave() {
    if (!canSubmit) return

    const newClockIn  = fromDtLocal(clockIn)
    const newClockOut = clockOut.trim() ? fromDtLocal(clockOut) : null

    const patch: EditPatch = { reason: reason.trim() }
    if (newClockIn && newClockIn !== session.clocked_in_at) patch.clocked_in_at = newClockIn
    if (newClockOut !== session.clocked_out_at) patch.clocked_out_at = newClockOut
    if (wentWell !== (session.what_went_well ?? '')) patch.what_went_well = wentWell.trim() || null
    if (needsAttn !== (session.needs_attention ?? '')) patch.needs_attention = needsAttn.trim() || null

    onSubmit(patch)
  }

  if (!mounted) return null

  // Portaled to document.body. Without this the modal's `position: fixed`
  // would be anchored to the nearest ancestor with a non-`none` transform
  // (e.g. the Sessions card with `animate-fade-up forwards`) instead of
  // the viewport — see PR notes for v1 regression.
  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      {/* Modal box: flex column, capped at 85vh so the modal never
          outgrows the viewport. Header + footer are flex-shrink-0;
          the body in the middle scrolls. */}
      <div className="flex w-full max-w-[560px] max-h-[85vh] flex-col overflow-hidden rounded-xl border border-black/9 bg-white">
        {/* Header — sticky at top */}
        <div className="flex-shrink-0 px-7 pt-6 pb-5 border-b border-gray-200/60">
          <h2 className="text-base font-semibold text-foreground">Edit session</h2>
          <div className="mt-1 text-xs text-gray-500">
            {session.member_name || 'Session'} &middot; {fmtDate(session.clocked_in_at)}
          </div>
        </div>

        {/* Body — scrolls when content exceeds available height */}
        <div className="flex-1 overflow-y-auto px-7 py-5 [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-600/15 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-600">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldBlock label="Clock-in">
                <input
                  type="datetime-local"
                  value={clockIn}
                  onChange={(e) => setClockIn(e.target.value)}
                  className="w-full rounded-lg border border-black/8 bg-gray-100 px-3 py-2 text-[13px] text-foreground outline-none transition-colors focus:border-black/20"
                />
              </FieldBlock>
              <FieldBlock label="Clock-out">
                <input
                  type="datetime-local"
                  value={clockOut}
                  onChange={(e) => setClockOut(e.target.value)}
                  placeholder="Leave empty for active"
                  className="w-full rounded-lg border border-black/8 bg-gray-100 px-3 py-2 text-[13px] text-foreground outline-none transition-colors focus:border-black/20"
                />
              </FieldBlock>
            </div>

            <FieldBlock label="What went well">
              <textarea
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
                className="w-full min-h-[72px] resize-y rounded-lg border border-black/8 bg-gray-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-black/20"
              />
            </FieldBlock>

            <FieldBlock label="Needs attention">
              <textarea
                value={needsAttn}
                onChange={(e) => setNeedsAttn(e.target.value)}
                className="w-full min-h-[72px] resize-y rounded-lg border border-black/8 bg-gray-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-black/20"
              />
            </FieldBlock>

            <FieldBlock label="Reason for edit" required hint="Logged with the audit row. Min. 3 characters.">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Corrected clock-out time after agent forgot to clock out…"
                className="w-full min-h-[64px] resize-y rounded-lg border border-black/8 bg-gray-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-gray-400 outline-none transition-colors focus:border-black/20"
                autoFocus
              />
            </FieldBlock>
          </div>
        </div>

        {/* Footer — sticky at bottom, always visible regardless of scroll position */}
        <div className="flex-shrink-0 flex justify-end gap-2 border-t border-gray-200/60 bg-white px-7 py-4">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="h-9 rounded-[7px] border border-black/9 bg-gray-100 px-4.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSubmit}
            className="flex h-9 items-center gap-2 rounded-[7px] border-none bg-foreground px-5 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-foreground/30"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

interface FieldBlockProps {
  label:     string
  required?: boolean
  hint?:     string
  children:  React.ReactNode
}

function FieldBlock({ label, required, hint, children }: FieldBlockProps) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {hint && <p className="mt-1 mb-2 text-[11.5px] leading-snug text-gray-400">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </div>
  )
}
