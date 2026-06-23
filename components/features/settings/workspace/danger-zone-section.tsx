'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsRow } from '@/components/features/settings/settings-panel'
import { TransferOwnershipDialog } from './transfer-ownership-dialog'
import { DeleteWorkspaceDialog } from './delete-workspace-dialog'
import {
  usePendingTransfer,
  useCancelTransfer,
} from '@/hooks/settings/use-ownership-transfer'
import { useMembers, useWorkspace } from '@/hooks/settings/use-settings-data'
import { useAuthStore } from '@/stores/auth'
import { useDeleteWorkspace } from '@/hooks/settings/use-workspace-mutations'

interface DangerZoneSectionProps {
  role: string | null
  currentUserId?: string
}

export function DangerZoneSection({
  role,
  currentUserId,
}: DangerZoneSectionProps) {
  const [transferOpen, setTransferOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: pendingTransfer } = usePendingTransfer()
  const cancelTransfer = useCancelTransfer()
  const { data: members } = useMembers()
  const { data: ws } = useWorkspace()
  const deleteWorkspace = useDeleteWorkspace()

  const workspaceName = (ws as { name?: string } | undefined)?.name ?? ''

  const isSuspended = useAuthStore((s) => s.isSuspended)
  const isImpersonating = useAuthStore((s) => s.isImpersonating)
  const isOwner = role === 'owner'
  const hasPendingTransfer =
    !!pendingTransfer && pendingTransfer.from_user_id === currentUserId

  const targetMember = hasPendingTransfer
    ? (members?.find((m) => m.user_id === pendingTransfer.to_user_id) as
        { display_name?: string; email?: string } | undefined)
    : null
  const targetMemberName = targetMember?.display_name ?? targetMember?.email ?? 'a member'

  const transferExpiresAt = pendingTransfer
    ? new Date(pendingTransfer.expires_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="bg-destructive/[0.04] border-[1.5px] border-destructive/30 rounded-2xl px-[22px] pb-2 divide-y divide-border">
      <TransferOwnershipDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />

      <DeleteWorkspaceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workspaceName={workspaceName}
        onConfirm={() => {
          deleteWorkspace.mutate(undefined, {
            onSuccess: () => setDeleteOpen(false),
          })
        }}
        loading={deleteWorkspace.isPending}
      />

      <div className="flex items-start gap-2.5 pt-5 pb-3.5">
        <AlertTriangle size={18} strokeWidth={2} className="text-destructive mt-px shrink-0" />
        <div>
          <h3 className="text-base font-bold text-destructive leading-snug">Danger zone</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            These actions are irreversible. Please proceed with caution.
          </p>
        </div>
      </div>

      <SettingsRow
        label="Transfer ownership"
        hint={
          hasPendingTransfer
            ? `Pending transfer to ${targetMemberName}. Expires ${transferExpiresAt}.`
            : 'Transfer this workspace to another member.'
        }
      >
        {hasPendingTransfer ? (
          <Button
            variant="outline"
            type="button"
            onClick={() => cancelTransfer.mutate()}
            disabled={isSuspended || isImpersonating || cancelTransfer.isPending}
            title={isImpersonating ? 'Not available during impersonation' : undefined}
          >
            {cancelTransfer.isPending ? 'Cancelling…' : 'Cancel transfer'}
          </Button>
        ) : (
          <Button
            variant="outline"
            type="button"
            disabled={isSuspended || isImpersonating || !isOwner}
            title={isImpersonating ? 'Not available during impersonation' : undefined}
            onClick={() => setTransferOpen(true)}
          >
            Transfer…
          </Button>
        )}
      </SettingsRow>

      <div className="flex items-center justify-between gap-6 py-[15px]">
        <div className="flex flex-col gap-[3px] min-w-0">
          <p className="text-sm font-semibold text-destructive">Delete workspace</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Permanently delete this workspace and all of its data.
          </p>
        </div>
        <Button
          variant="destructive"
          type="button"
          disabled={isSuspended || isImpersonating || !isOwner}
          title={isImpersonating ? 'Not available during impersonation' : undefined}
          onClick={() => setDeleteOpen(true)}
          className="shrink-0"
        >
          Delete workspace…
        </Button>
      </div>
    </div>
  )
}
