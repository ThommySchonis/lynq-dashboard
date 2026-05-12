'use client'

import { CreditCard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ChangePaymentMethodModalProps {
  open:        boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Stub modal for adding/changing payment methods. Shows a "Coming soon"
 * message until Whop integration lands — the real version will mount
 * a Whop Elements iframe or tokenization SDK here.
 */
export function ChangePaymentMethodModal({ open, onOpenChange }: ChangePaymentMethodModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change payment method</DialogTitle>
          <DialogDescription>
            Update the card or SEPA mandate on file for this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-foreground/5">
            <CreditCard size={22} strokeWidth={1.75} className="text-foreground/60" />
          </div>
          <p className="text-sm font-medium">Coming soon</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Payment-method management activates as soon as the Whop integration is wired up.
            Existing trial workspaces continue without interruption.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
