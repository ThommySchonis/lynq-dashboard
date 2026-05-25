'use client'

import { useState } from 'react'
import { Mail, Loader2, Copy, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useInviteMember } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { ROLES, ROLE_LABELS, ROLE_DESCS } from '@/lib/settings-constants'
import type { MemberRole } from '@/types/settings'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim())
}

interface InviteResult {
  invite?: { email: string }
  inviteLink?: string
  emailStatus?: string
  emailError?: string
}

interface InviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteModal({ open, onOpenChange }: InviteModalProps) {
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const inviteMember = useInviteMember()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('agent')
  const [emailBlurred, setEmailBlurred] = useState(false)
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  function resetForm() {
    setEmail('')
    setRole('agent')
    setEmailBlurred(false)
    setInviteResult(null)
    setLinkCopied(false)
  }

  function handleClose() {
    resetForm()
    onOpenChange(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setEmailBlurred(true)
      return
    }

    inviteMember.mutate(
      { email: trimmed, role },
      {
        onSuccess: (data) => {
          setInviteResult(data as InviteResult)
        },
      },
    )
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // silently fail
    }
  }

  const trimmedEmail = email.trim()
  const emailValid = isValidEmail(trimmedEmail)
  const showEmailError = emailBlurred && trimmedEmail.length > 0 && !emailValid
  const roleValid = ROLES.includes(role)
  const canSend = !isSuspended && emailValid && roleValid && !inviteMember.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        {!inviteResult ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite a new user</DialogTitle>
              <DialogDescription>
                They will receive an email with a link to join.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={(e: React.FormEvent) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="invite-email" className="text-sm font-medium">
                  Email address
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  onBlur={() => setEmailBlurred(true)}
                  autoFocus
                  aria-invalid={showEmailError || undefined}
                  className={showEmailError ? 'border-destructive focus-visible:ring-destructive/20' : ''}
                />
                {showEmailError && (
                  <p className="text-xs text-destructive">
                    Please enter a valid email address.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-lg border-2 p-2.5 text-left transition-colors ${
                        role === r
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <div className="text-xs font-semibold">{ROLE_LABELS[r]}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {ROLE_DESCS[r]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSend}>
                  {inviteMember.isPending ? (
                    <>
                      <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail size={14} strokeWidth={1.75} />
                      Send invite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite created</DialogTitle>
              <DialogDescription>
                {inviteResult.emailStatus === 'sent'
                  ? `Email sent to ${inviteResult.invite?.email ?? email}.`
                  : inviteResult.emailStatus === 'not_configured'
                    ? 'Email service not configured \u2014 copy the link below to share manually.'
                    : inviteResult.emailStatus === 'failed'
                      ? `Email failed: ${inviteResult.emailError}. Use the link below instead.`
                      : 'Share the link below with the user.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {inviteResult.inviteLink ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Invite link</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={inviteResult.inviteLink}
                        readOnly
                        onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
                        className="flex-1 font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyToClipboard(inviteResult.inviteLink!)}
                      >
                        {linkCopied ? (
                          <>
                            <Check size={14} strokeWidth={2} />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={14} strokeWidth={1.75} />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Link expires in 7 days.
                  </p>
                </>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  <span>
                    Could not generate an invite link &mdash; set{' '}
                    <code className="text-xs">NEXT_PUBLIC_SITE_URL</code> in
                    Vercel environment variables.
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Invite another
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
