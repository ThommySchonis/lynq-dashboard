'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { apiUrl } from '@/lib/api-client'
import {
  Shield,
  ShieldCheck,
  ChevronDown,
  Lock,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { useUnenrollMfa } from '@/hooks/settings'
import { MfaWizardDialog } from './mfa-wizard-dialog'
import { RecoveryCodesDialog } from './recovery-codes-dialog'

/** Local factor shape matching Supabase auth mfa.listFactors() response. */
interface SupabaseFactor {
  id: string
  factor_type: 'totp'
  friendly_name?: string | null
  status: 'verified' | 'unverified'
  created_at: string
}

export function MfaSection() {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const unenrollMfa = useUnenrollMfa()

  const [factors, setFactors] = useState<SupabaseFactor[]>([])
  const [loadingFactors, setLoadingFactors] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [rcOpen, setRcOpen] = useState(false)

  const loadFactors = useCallback(async () => {
    setLoadingFactors(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (!error && data) {
      setFactors((data.totp ?? []) as unknown as SupabaseFactor[])
    }
    setLoadingFactors(false)
  }, [])

  useEffect(() => {
    void loadFactors() // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadFactors])

  const verifiedFactor = factors.find((f) => f.status === 'verified')
  const twoFaEnabled = Boolean(verifiedFactor)

  async function handleDisable() {
    if (!verifiedFactor) return

    try {
      await unenrollMfa.mutateAsync({ factorId: verifiedFactor.id })

      // Clear recovery codes
      await fetch(apiUrl('auth/recovery-codes'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clear: true }),
      })
    } catch {
      // Error handled by mutation's onError
      return
    }

    await loadFactors()
    setDisableOpen(false)
  }

  return (
    <SettingsSection
      title="Two-factor authentication"
      description="Add an extra layer of security to your account using an authenticator app."
    >
      <SettingsCard>
        {loadingFactors ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-[10px]" />
            <div className="flex-1">
              <Skeleton className="w-20 h-3.5 mb-1.5" />
              <Skeleton className="w-36 h-3" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-5">
            <div className="flex items-center gap-3.5">
              <div
                className={`size-10 rounded-[10px] flex items-center justify-center shrink-0 border ${
                  twoFaEnabled
                    ? 'bg-green-500/10 border-green-500/25'
                    : 'bg-muted border-border'
                }`}
              >
                {twoFaEnabled ? (
                  <ShieldCheck className="size-5 text-green-600" strokeWidth={1.75} />
                ) : (
                  <Shield className="size-5 text-muted-foreground" strokeWidth={1.75} />
                )}
              </div>
              <div>
                <p
                  className={`text-sm font-medium ${
                    twoFaEnabled ? 'text-green-700' : 'text-muted-foreground'
                  }`}
                >
                  {twoFaEnabled ? 'Enabled' : 'Not enabled'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {twoFaEnabled ? 'Authenticator app' : 'No second factor configured'}
                </p>
              </div>
            </div>

            {!twoFaEnabled ? (
              <Button onClick={() => setWizardOpen(true)} disabled={isSuspended}>Enable 2FA</Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline">Manage <ChevronDown className="size-3.5" /></Button>}
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setRcOpen(true)}>
                    <Lock className="size-4" />
                    View recovery codes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDisableOpen(true)}
                  >
                    <X className="size-4" />
                    Disable 2FA
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </SettingsCard>

      <MfaWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={() => void loadFactors()}
      />

      <RecoveryCodesDialog open={rcOpen} onOpenChange={setRcOpen} />

      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable two-factor authentication"
        description="This will reduce your account security. You won't need a code when signing in."
        confirmLabel="Disable 2FA"
        typeToConfirm="DISABLE"
        onConfirm={() => void handleDisable()}
        variant="danger"
        loading={unenrollMfa.isPending}
      />
    </SettingsSection>
  )
}
