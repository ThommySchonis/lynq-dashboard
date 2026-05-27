'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  useConnectForwardingEmail,
  useVerifyForwardingDns,
  useVerifyForwarding,
  useForwardingStatus,
} from '@/hooks/settings/use-forwarding-mutations'
import { useEmailAccounts } from '@/hooks/settings/use-settings-data'
import { useStoreStore } from '@/stores/store'
import { ForwardingEmailStep } from '@/components/features/settings/integrations/forwarding/forwarding-email-step'
import { ForwardingSetupStep } from '@/components/features/settings/integrations/forwarding/forwarding-setup-step'
import { ForwardingActiveStep } from '@/components/features/settings/integrations/forwarding/forwarding-active-step'
import type { ForwardingConnectResponse, DnsRecord } from '@/types/forwarding'

interface ForwardingSetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type WizardStep = 'email' | 'setup' | 'active'

const STEP_TITLES: Record<WizardStep, string> = {
  email: 'Connect email via forwarding',
  setup: 'Set up email forwarding',
  active: 'Email connected',
}

const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  email: 'No credentials needed — just set up forwarding and DNS records.',
  setup: 'Complete these two steps to activate your email.',
  active: 'Your email is now receiving and sending through Lynq.',
}

export function ForwardingSetupWizard({ open, onOpenChange }: ForwardingSetupWizardProps) {
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const [step, setStep] = useState<WizardStep>('email')
  const [email, setEmail] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [connectData, setConnectData] = useState<ForwardingConnectResponse | null>(null)
  const [error, setError] = useState('')

  const { data: existingAccounts } = useEmailAccounts()
  const connectMutation = useConnectForwardingEmail()
  const verifyDnsMutation = useVerifyForwardingDns()
  const verifyForwardingMutation = useVerifyForwarding()
  const { data: status } = useForwardingStatus(step === 'setup' ? accountId : null)

  // Resume wizard for existing pending forwarding account
  useEffect(() => {
    if (!open || accountId) return
    const pending = existingAccounts?.find(
      (a) => a.provider === 'forwarding' && a.status === 'pending'
    )
    if (pending) {
      setAccountId(pending.id)
      setEmail(pending.email)
      setStep('setup')
    }
  }, [open, existingAccounts, accountId])

  // Merge connect response with polling status
  const dnsRecords = (status?.dns_records ?? connectData?.dns_records ?? []) as DnsRecord[]
  const domainVerified = status?.domain_verified ?? connectData?.domain_verified ?? false
  const forwardingVerified = status?.forwarding_verified ?? connectData?.forwarding_verified ?? false
  const forwardingAddress = status?.forwarding_address ?? connectData?.forwarding_address ?? ''

  // Auto-advance to active when both verified
  useEffect(() => {
    if (step === 'setup' && domainVerified && forwardingVerified) {
      setStep('active')
    }
  }, [step, domainVerified, forwardingVerified])

  function handleClose() {
    setStep('email')
    setEmail('')
    setAccountId(null)
    setConnectData(null)
    setError('')
    onOpenChange(false)
  }

  function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }
    setError('')
    connectMutation.mutate(
      { email: email.trim(), store_id: activeStoreId || undefined },
      {
        onSuccess: (data) => {
          setConnectData(data)
          setAccountId(data.account_id)
          setStep('setup')
        },
        onError: (err) => setError(err.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>{STEP_DESCRIPTIONS[step]}</DialogDescription>
        </DialogHeader>

        {step === 'email' && (
          <ForwardingEmailStep
            email={email}
            onEmailChange={setEmail}
            error={error}
            isPending={connectMutation.isPending}
            onSubmit={handleConnect}
          />
        )}

        {step === 'setup' && accountId && (
          <ForwardingSetupStep
            forwardingAddress={forwardingAddress}
            forwardingVerified={forwardingVerified}
            domainVerified={domainVerified}
            dnsRecords={dnsRecords}
            accountId={accountId}
            onVerifyForwarding={() => verifyForwardingMutation.mutate(accountId)}
            onVerifyDns={() => verifyDnsMutation.mutate(accountId)}
            isVerifyingForwarding={verifyForwardingMutation.isPending}
            isVerifyingDns={verifyDnsMutation.isPending}
          />
        )}

        {step === 'active' && (
          <ForwardingActiveStep email={email} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
