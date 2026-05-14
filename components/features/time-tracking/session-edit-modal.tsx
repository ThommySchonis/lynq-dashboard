'use client'

import { useState } from 'react'
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
  emails_answered?: number | null
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
  const [emails, setEmails]         = useState<string>(session.emails_answered != null ? String(session.emails_answered) : '')
  const [wentWell, setWentWell]     = useState<string>(session.what_went_well ?? '')
  const [needsAttn, setNeedsAttn]   = useState<string>(session.needs_attention ?? '')
  const [reason, setReason]         = useState<string>('')

  const reasonValid = reason.trim().length >= 3
  const emailsParsed = emails === '' ? null : Number(emails)
  const emailsValid =
    emailsParsed === null || (Number.isInteger(emailsParsed) && emailsParsed >= 0)

  const canSubmit = reasonValid && emailsValid && !submitting

  function handleSave() {
    if (!canSubmit) return

    const newClockIn  = fromDtLocal(clockIn)
    const newClockOut = clockOut.trim() ? fromDtLocal(clockOut) : null

    const patch: EditPatch = { reason: reason.trim() }
    if (newClockIn && newClockIn !== session.clocked_in_at) patch.clocked_in_at = newClockIn
    if (newClockOut !== session.clocked_out_at) patch.clocked_out_at = newClockOut
    if (emailsParsed !== session.emails_answered) patch.emails_answered = emailsParsed
    if (wentWell !== (session.what_went_well ?? '')) patch.what_went_well = wentWell.trim() || null
    if (needsAttn !== (session.needs_attention ?? '')) patch.needs_attention = needsAttn.trim() || null

    onSubmit(patch)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-[560px] rounded-xl border border-black/9 bg-white p-7">
        <h2 className="text-base font-semibold text-foreground">Edit session</h2>
        <div className="mt-1 text-xs text-gray-500">
          {session.member_name || 'Session'} &middot; {fmtDate(session.clocked_in_at)}
        </div>

        <div className="my-5 h-px bg-black/6" />

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

          <FieldBlock label="Emails answered">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="0"
              className="w-32 rounded-lg border border-black/8 bg-gray-100 px-3 py-2 text-[13px] text-foreground placeholder:text-gray-400 outline-none transition-colors focus:border-black/20 tabular-nums"
            />
          </FieldBlock>

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

        <div className="mt-6 flex justify-end gap-2">
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
