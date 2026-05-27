'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { useAuthStore } from '@/stores/auth'
import type { EmailAccount, EmailProvider } from '@/types/settings'
import type { UseMutationResult } from '@tanstack/react-query'

const PROVIDER_LABELS: Record<EmailProvider, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  custom: 'Custom email',
  forwarding: 'Email Forwarding',
}

function ProviderIcon({ provider }: { provider: EmailProvider }) {
  if (provider === 'gmail') {
    return (
      <Image
        src="/icons/gmail.svg"
        alt="Gmail"
        width={20}
        height={16}
        className="flex-shrink-0"
      />
    )
  }
  if (provider === 'outlook') {
    return (
      <Image
        src="/icons/outlook.svg"
        alt="Outlook"
        width={20}
        height={20}
        className="flex-shrink-0"
      />
    )
  }
  return <Mail className="size-5 text-muted-foreground flex-shrink-0" />
}

interface EmailAccountRowProps {
  account: EmailAccount
  disconnectMutation: UseMutationResult<void, Error, string>
}

export function EmailAccountRow({ account, disconnectMutation }: EmailAccountRowProps) {
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const displayName = account.email || PROVIDER_LABELS[account.provider]

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="flex size-8 items-center justify-center flex-shrink-0">
          <ProviderIcon provider={account.provider} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {displayName}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {PROVIDER_LABELS[account.provider]}
          </div>
        </div>
        <StatusBadge status={account.status ?? 'active'} />
        <Button
          variant="destructive"
          size="sm"
          className="flex-shrink-0"
          disabled={isSuspended || disconnectMutation.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Disconnect
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect email account"
        description={`Are you sure you want to disconnect ${displayName}? You will stop receiving emails from this account.`}
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnectMutation.isPending}
        onConfirm={() => {
          disconnectMutation.mutate(account.id, {
            onSuccess: () => setConfirmOpen(false),
          })
        }}
      />
    </>
  )
}
