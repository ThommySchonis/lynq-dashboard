'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SettingsField } from '@/components/features/settings/settings-field'
import { toast } from 'sonner'
import { copyText, downloadCodes } from './mfa-utils'
import { parseJson } from '@/lib/utils/typed-json'

type WizardStep = 'idle' | 'enrolling' | 'verifying' | 'complete'

interface MfaErrorResponse {
  error?: string
}

interface RecoveryCodesResponse {
  recovery_codes?: string[]
  error?: string
}

interface MfaWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function MfaWizardDialog({ open, onOpenChange, onComplete }: MfaWizardDialogProps) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  const [step, setStep] = useState<WizardStep>('idle')
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false)
  const [enrollBusy, setEnrollBusy] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)

  const stepIndex = step === 'enrolling' ? 1 : step === 'verifying' ? 2 : step === 'complete' ? 3 : 0

  useEffect(() => {
    if (!open) return
    void startEnrollment()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function startEnrollment() {
    setStep('enrolling')
    setVerifyCode('')
    setVerifyError('')
    setRecoveryCodes([])
    setRecoveryConfirmed(false)
    setEnrollBusy(true)

    const { data: live, error: listErr } = await supabase.auth.mfa.listFactors()
    if (listErr) {
      toast.error(listErr.message || 'Could not read 2FA factors')
      setEnrollBusy(false)
      onOpenChange(false)
      return
    }

    const allFactors = live?.all ?? []
    const verified = allFactors.find((f) => f.status === 'verified')
    const unverified = allFactors.filter((f) => f.status === 'unverified')

    if (verified) {
      toast.error('2FA is already enabled on this account')
      setEnrollBusy(false)
      onOpenChange(false)
      return
    }

    // Cleanup orphan unverified factors
    let needsServerCleanup = false
    for (const f of unverified) {
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: f.id })
      if (unenrollErr) needsServerCleanup = true
    }

    if (needsServerCleanup) {
      try {
        const res = await fetch('/api/auth/mfa/cleanup', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as MfaErrorResponse
          toast.error(json.error || 'Could not clean up orphaned 2FA factors')
          setEnrollBusy(false)
          onOpenChange(false)
          return
        }
      } catch {
        toast.error('Could not clean up orphaned 2FA factors')
        setEnrollBusy(false)
        onOpenChange(false)
        return
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator',
    })
    setEnrollBusy(false)

    if (error || !data) {
      toast.error(error?.message || 'Could not start 2FA enrollment')
      onOpenChange(false)
      return
    }

    setFactorId(data.id)
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
  }

  async function handleVerify() {
    if (verifyCode.length !== 6) {
      setVerifyError('Enter a 6-digit code')
      return
    }
    setVerifyBusy(true)
    setVerifyError('')

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: verifyCode,
    })
    if (error) {
      setVerifyBusy(false)
      setVerifyError('Invalid code, try again')
      return
    }

    try {
      const res = await fetch('/api/auth/recovery-codes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await parseJson<RecoveryCodesResponse>(res)
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to generate recovery codes')
        setVerifyBusy(false)
        return
      }
      setRecoveryCodes(json.recovery_codes ?? [])
    } catch {
      toast.error('Failed to generate recovery codes')
      setVerifyBusy(false)
      return
    }

    setVerifyBusy(false)
    setStep('complete')
  }

  function handleDone() {
    onOpenChange(false)
    onComplete()
    toast.success('Two-factor authentication enabled')
  }

  const canClose = step !== 'complete'

  return (
    <Dialog open={open} onOpenChange={canClose ? onOpenChange : undefined}>
      <DialogContent showCloseButton={canClose}>
        <DialogHeader>
          <DialogTitle>
            {step === 'enrolling' && 'Set up two-factor authentication'}
            {step === 'verifying' && 'Verify your authenticator'}
            {step === 'complete' && 'Save your recovery codes'}
          </DialogTitle>
          <DialogDescription>
            {step === 'enrolling' && 'Scan the QR code with your authenticator app'}
            {step === 'verifying' && 'Enter the 6-digit code from your authenticator app'}
            {step === 'complete' && 'Store these somewhere safe -- each code works once'}
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`size-2 rounded-full transition-colors ${
                s === stepIndex
                  ? 'bg-primary'
                  : s < stepIndex
                    ? 'bg-green-400'
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1 -- QR code */}
        {step === 'enrolling' && (
          <div className="flex flex-col items-center gap-5">
            {enrollBusy ? (
              <Skeleton className="size-[180px] rounded-xl" />
            ) : (
              <>
                <div className="size-[180px] border border-border rounded-xl overflow-hidden flex items-center justify-center bg-white">
                  {qrCode && (
                    qrCode.startsWith('data:') || qrCode.startsWith('http')
                      ? <img src={qrCode} alt="2FA QR Code" width={160} height={160} />
                      : <div dangerouslySetInnerHTML={{ __html: qrCode }} className="size-[160px] flex items-center justify-center" />
                  )}
                </div>
                <div className="w-full">
                  <p className="text-xs text-muted-foreground mb-1.5 text-center">
                    Can&apos;t scan? Enter this code manually:
                  </p>
                  <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
                    <span className="flex-1 font-mono text-xs break-all text-foreground tracking-wide">
                      {secret}
                    </span>
                    <Button variant="ghost" size="icon-xs" onClick={() => copyText(secret)}>
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <Button className="w-full" onClick={() => setStep('verifying')}>
                  Continue
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step 2 -- Verify code */}
        {step === 'verifying' && (
          <div className="flex flex-col gap-5">
            <SettingsField label="Verification code" error={verifyError}>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                className="text-center text-xl tracking-[0.3em] font-mono"
                autoFocus
                aria-invalid={!!verifyError}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') void handleVerify() }}
              />
            </SettingsField>
            <Button
              className="w-full"
              onClick={() => void handleVerify()}
              disabled={verifyCode.length !== 6 || verifyBusy}
            >
              {verifyBusy ? 'Verifying...' : 'Verify code'}
            </Button>
          </div>
        )}

        {/* Step 3 -- Recovery codes */}
        {step === 'complete' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-orange-300/30 bg-orange-500/5 px-4 py-3 text-[13px] text-orange-800 leading-relaxed">
              Save these codes somewhere safe. Each code can only be used once.
              Use them if you lose access to your authenticator app.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {recoveryCodes.map((code, i) => (
                <div
                  key={i}
                  className="bg-muted border border-border rounded-md px-2.5 py-1.5 font-mono text-sm font-semibold text-foreground tracking-wide"
                >
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-2.5">
              <Button variant="outline" className="flex-1" onClick={() => copyText(recoveryCodes.join('\n'))}>
                <Copy className="size-3.5" /> Copy all
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadCodes(recoveryCodes)}>
                <Download className="size-3.5" /> Download .txt
              </Button>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <Checkbox
                checked={recoveryConfirmed}
                onCheckedChange={(checked) => setRecoveryConfirmed(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground leading-snug">
                I&apos;ve saved my recovery codes in a safe place
              </span>
            </label>
            <Button className="w-full" onClick={handleDone} disabled={!recoveryConfirmed}>
              Done -- 2FA is enabled
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
