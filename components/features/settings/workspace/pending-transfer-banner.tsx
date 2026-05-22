'use client'

import { useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import {
  useAcceptTransfer,
  useDeclineTransfer,
} from '@/hooks/settings/use-ownership-transfer'
import type { OwnershipTransfer } from '@/hooks/settings/use-ownership-transfer'

interface PendingTransferBannerProps {
  transfer: OwnershipTransfer | null
  currentUserId: string
}

export function PendingTransferBanner({
  transfer,
  currentUserId,
}: PendingTransferBannerProps) {
  const [acceptOpen, setAcceptOpen] = useState(false)

  const acceptTransfer = useAcceptTransfer()
  const declineTransfer = useDeclineTransfer()

  if (!transfer || transfer.to_user_id !== currentUserId) return null

  const expiresAt = new Date(transfer.expires_at).toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric', year: 'numeric' }
  )

  function handleAcceptConfirm() {
    acceptTransfer.mutate(undefined, {
      onSuccess: () => setAcceptOpen(false),
    })
  }

  function handleDecline() {
    declineTransfer.mutate()
  }

  return (
    <>
      <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
          <ArrowRightLeft className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Ownership transfer request
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            The workspace owner wants to transfer ownership to you. This request
            expires on {expiresAt}.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => setAcceptOpen(true)}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecline}
              disabled={declineTransfer.isPending}
            >
              {declineTransfer.isPending ? 'Declining…' : 'Decline'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        title="Accept ownership transfer"
        description="You are about to become the owner of this workspace. This action cannot be undone."
        confirmLabel="Accept ownership"
        typeToConfirm="ACCEPT"
        onConfirm={handleAcceptConfirm}
        loading={acceptTransfer.isPending}
        variant="danger"
      />
    </>
  )
}
