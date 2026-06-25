'use client'

import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-[440px] gap-0 overflow-hidden rounded-[18px] border-0 p-0 ring-0 shadow-[0_24px_60px_-14px_rgba(15,13,31,0.24)] sm:max-w-[440px]"
        >
          {/* Body */}
          <div className="flex flex-col gap-[18px] px-6 py-[22px]">
            <DialogHeader className="gap-[7px]">
              <div className="flex min-h-8 items-center justify-between gap-2">
                <DialogTitle className="text-[18px] font-bold leading-tight text-foreground">
                  Transfer workspace ownership
                </DialogTitle>
                <DialogClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-2.5 size-11 shrink-0"
                    />
                  }
                >
                  <X className="size-5" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
              <DialogDescription className="text-sm text-muted-foreground">
                Choose a member to transfer ownership to, and select the role you
                will assume after the transfer.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-member" className="text-sm font-semibold text-foreground">
                New owner
              </Label>
              <Select
                value={selectedMemberId}
                onValueChange={(v) => v && setSelectedMemberId(v)}
              >
                <SelectTrigger
                  id="transfer-member"
                  className="w-full rounded-[10px] border-border bg-card px-3.5 py-[11px] data-[size=default]:h-auto"
                >
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-role" className="text-sm font-semibold text-foreground">
                Your new role
              </Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => v && setSelectedRole(v)}
              >
                <SelectTrigger
                  id="transfer-role"
                  className="w-full rounded-[10px] border-border bg-card px-3.5 py-[11px] data-[size=default]:h-auto"
                >
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

          {/* Footer */}
          <div className="flex justify-end border-t border-border bg-muted/40 px-6 py-4">
            <Button
              disabled={!selectedMemberId}
              onClick={handleNext}
              className="h-11 gap-1.5 rounded-[10px] px-5 font-semibold"
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          </div>
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
