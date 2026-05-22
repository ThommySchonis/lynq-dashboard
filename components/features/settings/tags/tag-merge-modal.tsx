'use client'

import { useState } from 'react'
import { GitMerge, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useMergeTags } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { paletteFor } from '@/lib/tags'
import type { Tag } from '@/types/settings'

interface TagMergeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: Tag[]
}

export function TagMergeModal({ open, onOpenChange, tags }: TagMergeModalProps) {
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const [winnerId, setWinnerId] = useState<string>(tags[0]?.id ?? '')
  const mergeTags = useMergeTags()

  const winnerName = tags.find((t) => t.id === winnerId)?.name ?? ''
  const loserCount = tags.length - 1

  function handleOpenChange(next: boolean) {
    if (next) setWinnerId(tags[0]?.id ?? '')
    onOpenChange(next)
  }

  function handleMerge() {
    if (!winnerId) return
    const loser_ids = tags.filter((t) => t.id !== winnerId).map((t) => t.id)
    mergeTags.mutate(
      { winner_id: winnerId, loser_ids },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!mergeTags.isPending}>
        <DialogHeader>
          <DialogTitle>Merge {tags.length} tags</DialogTitle>
          <DialogDescription>
            Choose the tag to keep. The others will be deleted and their associations
            transferred.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">Keep this tag (winner)</label>
          <div className="flex flex-col gap-1">
            {tags.map((t) => {
              const palette = paletteFor(t.color)
              const isWinner = t.id === winnerId
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    isWinner
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-transparent hover:bg-muted'
                  }`}
                  onClick={() => setWinnerId(t.id)}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: palette.dot }}
                  />
                  <span>{t.name}</span>
                  {t.usage_count > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t.usage_count} use{t.usage_count === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <p className="text-sm leading-relaxed">
            All items tagged with the others will receive{' '}
            <strong>&ldquo;{winnerName}&rdquo;</strong> instead. The other{' '}
            {loserCount} tag{loserCount === 1 ? '' : 's'} will be deleted.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mergeTags.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={isSuspended || mergeTags.isPending}>
            {mergeTags.isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge size={14} strokeWidth={1.75} />
                Merge tags
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
