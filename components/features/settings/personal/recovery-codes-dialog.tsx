'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { copyText, downloadCodes } from './mfa-utils'

interface RecoveryCodesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RecoveryCodesDialog({ open, onOpenChange }: RecoveryCodesDialogProps) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const [codes, setCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    loadCodes()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCodes() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/recovery-codes', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = (await res.json()) as { recovery_codes?: string[] }
      setCodes(json.recovery_codes ?? [])
    } catch {
      setCodes([])
    }
    setLoading(false)
  }

  async function handleRegenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/recovery-codes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = (await res.json()) as { recovery_codes?: string[] }
      setCodes(json.recovery_codes ?? [])
      toast.success('New recovery codes generated')
    } catch {
      toast.error('Failed to regenerate codes')
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recovery codes</DialogTitle>
          <DialogDescription>Each code can only be used once.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-[34px] rounded-md" />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recovery codes generated yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {codes.map((c, i) => (
                <div
                  key={i}
                  className="bg-muted border border-border rounded-md px-2.5 py-1.5 font-mono text-sm font-semibold text-foreground tracking-wide"
                >
                  {c}
                </div>
              ))}
            </div>
            <div className="flex gap-2.5">
              <Button variant="outline" className="flex-1" onClick={() => copyText(codes.join('\n'))}>
                <Copy className="size-3.5" /> Copy all
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => downloadCodes(codes)}>
                <Download className="size-3.5" /> Download
              </Button>
            </div>
          </>
        )}

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2.5">
            Generate a new set of codes -- your old ones will stop working immediately.
          </p>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRegenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate new codes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
