'use client'

import { useState, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface DeleteWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceName: string
  onConfirm: () => void
  loading?: boolean
}

// What the user permanently loses — shown in the red warning box (Figma node 1310-66086).
const DELETION_ITEMS = [
  'All conversations & customer history',
  'Connected stores, integrations & shipment tracking',
  'Team members and their access',
  'Macros, tags and AI agent training',
]

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspaceName,
  onConfirm,
  loading = false,
}: DeleteWorkspaceDialogProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) setTyped('') // eslint-disable-line react-hooks/set-state-in-effect
  }, [open])

  const canDelete = workspaceName.length > 0 && typed.trim() === workspaceName.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-[500px] gap-0 overflow-hidden rounded-2xl border border-border p-0 ring-0 shadow-[0_24px_64px_-12px_rgba(28,15,54,0.3)] sm:max-w-[500px]"
      >
        <div className="pt-[26px] pb-[22px]">
          <div className="flex flex-col items-center gap-4 px-10 py-7">
            {/* Heading */}
            <div className="flex flex-col items-center gap-[7px]">
              <Trash2 className="size-6 text-destructive" strokeWidth={2} />
              <DialogTitle className="text-center text-xl font-bold leading-tight text-foreground">
                Delete this workspace?
              </DialogTitle>
              <DialogDescription className="max-w-[440px] text-center text-sm text-muted-foreground">
                Deleting {workspaceName || 'this workspace'} is permanent and immediate.
                Everyone loses access right away and the data can&rsquo;t be recovered.
              </DialogDescription>
            </div>

            {/* What gets deleted */}
            <div className="flex w-full flex-col gap-[9px] rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-3.5">
              {DELETION_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <X className="size-[15px] shrink-0 text-destructive" strokeWidth={2.5} />
                  <span className="text-sm font-medium text-foreground-2">{item}</span>
                </div>
              ))}
            </div>

            {/* Type-to-confirm */}
            <div className="relative w-full">
              <Input
                value={typed}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTyped(e.target.value)}
                placeholder={workspaceName}
                autoFocus
                disabled={loading}
                className="h-auto rounded-[10px] border-[1.4px] border-destructive/50 bg-card px-3.5 py-[11px] pr-10 text-sm focus-visible:border-destructive focus-visible:ring-destructive/20"
              />
              <Trash2 className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-foreground-4" />
            </div>

            {/* Actions */}
            <div className="flex w-full gap-2.5">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="h-auto flex-1 rounded-[10px] px-4 py-[11px] font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={!canDelete || loading}
                className="h-auto flex-1 gap-2 rounded-[10px] bg-destructive px-4 py-[11px] font-semibold text-white hover:bg-destructive-hover"
              >
                <Trash2 className="size-4" />
                {loading ? 'Deleting…' : 'Delete workspace'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
