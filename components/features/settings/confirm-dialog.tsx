'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  variant?: 'danger' | 'default'
  loading?: boolean
  /** If provided, the user must type this string before confirming */
  typeToConfirm?: string
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  variant = 'default',
  loading = false,
  typeToConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const canConfirm = typeToConfirm ? typed === typeToConfirm : true

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {typeToConfirm && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">
              Type{' '}
              <strong className="text-foreground font-semibold">{typeToConfirm}</strong>
              {' '}to confirm:
            </p>
            <Input
              type="text"
              value={typed}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTyped(e.target.value)}
              placeholder={typeToConfirm}
              autoFocus
            />
          </div>
        )}

        <DialogFooter showCloseButton={!loading}>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? 'Loading…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
