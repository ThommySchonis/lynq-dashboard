'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '@/components/features/settings/settings-section'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { TransferOwnershipDialog } from './transfer-ownership-dialog'
import {
  usePendingTransfer,
  useCancelTransfer,
} from '@/hooks/settings/use-ownership-transfer'
import { useMembers } from '@/hooks/settings/use-settings-data'
import { useAuthStore } from '@/stores/auth'

interface DangerZoneSectionProps {
  role: string | null
  currentUserId?: string
  onDelete?: () => void
}

export function DangerZoneSection({
  role,
  currentUserId,
  onDelete,
}: DangerZoneSectionProps) {
  const [transferOpen, setTransferOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: pendingTransfer } = usePendingTransfer()
  const cancelTransfer = useCancelTransfer()
  const { data: members } = useMembers()

  const isSuspended = useAuthStore((s) => s.isSuspended)
  const isOwner = role === 'owner'
  const hasPendingTransfer =
    !!pendingTransfer && pendingTransfer.from_user_id === currentUserId

  const targetMember = hasPendingTransfer
    ? (members?.find((m) => m.user_id === pendingTransfer.to_user_id) as
        { display_name?: string; email?: string } | undefined)
    : null
  const targetMemberName = targetMember?.display_name ?? targetMember?.email ?? 'a member'

  function handleDeleteConfirm() {
    setDeleteOpen(false)
    onDelete?.()
  }

  const transferExpiresAt = pendingTransfer
    ? new Date(pendingTransfer.expires_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <SettingsSection title="Danger zone">
      <TransferOwnershipDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete workspace"
        description="This will permanently delete the workspace and all associated data. This action cannot be undone."
        confirmLabel="Delete workspace"
        typeToConfirm="DELETE"
        onConfirm={handleDeleteConfirm}
        variant="danger"
      />

      <div className="border border-destructive/25 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-destructive/[0.12] bg-destructive/[0.02]">
          <h3 className="text-lg font-medium text-destructive mb-1">Danger zone</h3>
          <p className="text-sm text-muted-foreground">
            These actions are irreversible. Please proceed with caution.
          </p>
        </div>

        <div className="px-6 py-[18px] flex items-center justify-between gap-6 border-b border-destructive/[0.08]">
          <div>
            <p className="text-sm font-medium text-foreground mb-0.5">Transfer ownership</p>
            <p className="text-sm text-muted-foreground">
              {hasPendingTransfer
                ? `Pending transfer to ${targetMemberName}. Expires ${transferExpiresAt}.`
                : 'Transfer this workspace to another member'}
            </p>
          </div>
          {hasPendingTransfer ? (
            <Button
              variant="outline"
              type="button"
              onClick={() => cancelTransfer.mutate()}
              disabled={isSuspended || cancelTransfer.isPending}
              className="shrink-0"
            >
              {cancelTransfer.isPending ? 'Cancelling…' : 'Cancel transfer'}
            </Button>
          ) : (
            <Button
              variant="outline"
              type="button"
              disabled={isSuspended || !isOwner}
              onClick={() => setTransferOpen(true)}
              className="shrink-0"
            >
              Transfer…
            </Button>
          )}
        </div>

        <div className="px-6 py-[18px] flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-destructive mb-0.5">Delete workspace</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete this workspace and all data
            </p>
          </div>
          <Button
            variant="destructive"
            type="button"
            disabled={isSuspended || !isOwner}
            onClick={() => setDeleteOpen(true)}
            className="shrink-0"
          >
            Delete workspace…
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
