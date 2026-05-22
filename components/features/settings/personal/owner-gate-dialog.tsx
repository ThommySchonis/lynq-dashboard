'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface OwnerGateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceName: string
  onDeleteWorkspace: () => void
}

export function OwnerGateDialog({
  open,
  onOpenChange,
  workspaceName,
  onDeleteWorkspace,
}: OwnerGateDialogProps) {
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You own a workspace</DialogTitle>
          <DialogDescription>
            You are the owner of <strong>{workspaceName}</strong>. Before deleting
            your account, you must either transfer ownership to another member or
            delete the workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button
            variant="default"
            onClick={() => {
              onOpenChange(false)
              router.push('/settings/workspace/general')
            }}
          >
            Transfer ownership
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false)
              onDeleteWorkspace()
            }}
          >
            Delete workspace
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
