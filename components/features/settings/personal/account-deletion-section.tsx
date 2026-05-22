'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useScheduleAccountDeletion } from '@/hooks/settings/use-account-deletion'
import { useMembers } from '@/hooks/settings/use-settings-data'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { OwnerGateDialog } from '@/components/features/settings/personal/owner-gate-dialog'
import { Button } from '@/components/ui/button'

export function AccountDeletionSection() {
  const role = useAuthStore((s) => s.role)
  const workspace = useAuthStore((s) => s.workspace)
  const userId = useAuthStore((s) => s.user?.id)
  const { data: members } = useMembers()
  const scheduleDeletion = useScheduleAccountDeletion()

  const [ownerGateOpen, setOwnerGateOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isOwner = role === 'owner'
  const otherMembers = (members ?? []).filter((m) => m.user_id !== userId)
  const hasOtherMembers = isOwner && otherMembers.length > 0

  function handleDeleteClick() {
    if (hasOtherMembers) {
      setOwnerGateOpen(true)
    } else {
      setConfirmOpen(true)
    }
  }

  function handleConfirm() {
    scheduleDeletion.mutate(undefined, {
      onSuccess: () => setConfirmOpen(false),
    })
  }

  const deletionItems = isOwner
    ? [
        'Your personal account and profile',
        `Workspace "${workspace?.name ?? ''}" and all its data`,
        'Active subscription (will be cancelled immediately)',
      ]
    : [
        'Your personal account and profile',
        'Your membership in this workspace',
      ]

  return (
    <>
      <div className="rounded-xl border-2 border-destructive/30 p-6">
        <h3 className="text-base font-semibold text-destructive mb-1">Danger Zone</h3>
        <p className="text-sm text-foreground-3 mb-4">
          Permanently delete your account and all associated data.
        </p>
        <Button variant="destructive" onClick={handleDeleteClick}>
          Delete my account
        </Button>
      </div>

      <OwnerGateDialog
        open={ownerGateOpen}
        onOpenChange={setOwnerGateOpen}
        workspaceName={workspace?.name ?? ''}
        onDeleteWorkspace={() => setConfirmOpen(true)}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm account deletion"
        description={`This will permanently delete:\n\n${deletionItems.map((item) => `• ${item}`).join('\n')}\n\nYou have 7 days to cancel. After that, all data will be permanently erased.`}
        confirmLabel="Delete my account"
        onConfirm={handleConfirm}
        variant="danger"
        loading={scheduleDeletion.isPending}
        typeToConfirm="DELETE"
      />
    </>
  )
}
