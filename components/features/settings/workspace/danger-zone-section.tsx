'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '@/components/features/settings/settings-section'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'

interface DangerZoneSectionProps {
  role: string | null
  onTransfer?: () => void
  onDelete?: () => void
}

export function DangerZoneSection({ role, onTransfer, onDelete }: DangerZoneSectionProps) {
  const [transferOpen, setTransferOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isOwner = role === 'owner'

  function handleTransferConfirm() {
    setTransferOpen(false)
    onTransfer?.()
  }

  function handleDeleteConfirm() {
    setDeleteOpen(false)
    onDelete?.()
  }

  return (
    <SettingsSection title="Danger zone">
      <ConfirmDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title="Transfer workspace ownership"
        description="Are you sure you want to transfer ownership of this workspace? This action cannot be undone."
        confirmLabel="Transfer ownership"
        typeToConfirm="TRANSFER"
        onConfirm={handleTransferConfirm}
        variant="danger"
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
              Transfer this workspace to another member
            </p>
          </div>
          <Button
            variant="outline"
            type="button"
            disabled={!isOwner}
            onClick={() => setTransferOpen(true)}
            className="shrink-0"
          >
            Transfer…
          </Button>
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
            disabled={!isOwner}
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
