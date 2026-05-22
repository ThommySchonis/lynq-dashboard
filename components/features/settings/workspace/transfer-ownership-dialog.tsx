'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { useMembers } from '@/hooks/settings/use-settings-data'
import { useInitiateTransfer } from '@/hooks/settings/use-ownership-transfer'

interface TransferOwnershipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'observer', label: 'Observer' },
] as const

export function TransferOwnershipDialog({
  open,
  onOpenChange,
}: TransferOwnershipDialogProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('admin')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: members } = useMembers()
  const initiateTransfer = useInitiateTransfer()

  const nonOwnerMembers = members?.filter((m) => m.role !== 'owner') ?? []
  const selectedMember = nonOwnerMembers.find(
    (m) => m.user_id === selectedMemberId
  )

  function handleNext() {
    if (!selectedMemberId) return
    setConfirmOpen(true)
  }

  function handleConfirm() {
    initiateTransfer.mutate(
      { toUserId: selectedMemberId, newRoleForOldOwner: selectedRole },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          onOpenChange(false)
          resetState()
        },
      }
    )
  }

  function resetState() {
    setSelectedMemberId('')
    setSelectedRole('admin')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer workspace ownership</DialogTitle>
            <DialogDescription>
              Choose a member to transfer ownership to, and select the role you
              will assume after the transfer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transfer-member">New owner</Label>
              <Select
                value={selectedMemberId}
                onValueChange={(v) => v && setSelectedMemberId(v)}
              >
                <SelectTrigger id="transfer-member" className="w-full">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {nonOwnerMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name ?? m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transfer-role">Your new role</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => v && setSelectedRole(v)}
              >
                <SelectTrigger id="transfer-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="default"
              disabled={!selectedMemberId}
              onClick={handleNext}
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm ownership transfer"
        description={`You are about to transfer ownership to ${selectedMember?.display_name ?? selectedMember?.email ?? 'this member'}. You will become ${selectedRole}. The transfer requires their acceptance within 7 days. You can cancel it before they respond.`}
        confirmLabel="Transfer ownership"
        typeToConfirm="TRANSFER"
        onConfirm={handleConfirm}
        loading={initiateTransfer.isPending}
        variant="danger"
      />
    </>
  )
}
