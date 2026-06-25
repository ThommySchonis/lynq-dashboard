'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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
  const isImpersonating = useAuthStore((s) => s.isImpersonating)
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
      <div className="bg-destructive/[0.04] border-[1.5px] border-destructive/30 rounded-2xl px-[22px] py-2.5 flex items-center justify-between gap-6">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle size={18} strokeWidth={2} className="text-destructive mt-px shrink-0" />
          <div className="flex flex-col gap-[3px]">
            <h3 className="text-sm font-semibold text-destructive leading-snug">Danger zone</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Permanently delete your account and all associated data.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={handleDeleteClick}
          disabled={isImpersonating}
          title={isImpersonating ? 'Not available during impersonation' : undefined}
          className="shrink-0"
        >
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
