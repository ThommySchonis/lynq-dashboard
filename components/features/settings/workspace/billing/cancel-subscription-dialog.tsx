'use client'

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CancelSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: CancelSubscriptionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!loading} className="w-full max-w-[460px]">
        <div className="flex flex-col gap-2">
          <DialogTitle className="text-xl font-bold leading-tight text-foreground">
            Cancel subscription?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Are you sure you want to cancel your current subscription? Your paid features
            will be turned off right away.
          </DialogDescription>
        </div>

        <div className="mt-5 flex w-full gap-2.5">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 font-semibold"
          >
            Keep subscription
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 font-semibold"
          >
            {loading ? 'Cancelling…' : 'Cancel subscription'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
