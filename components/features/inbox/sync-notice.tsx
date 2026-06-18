'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const SYNC_MESSAGE =
  'Syncing your inbox — importing your emails can take a few minutes. New messages will appear as they arrive.'

/**
 * Presentational "still syncing" notice: an info-styled box with a spinner.
 * Used per-account on the email settings page and in the empty inbox thread
 * list while a freshly connected account is still importing.
 */
export function SyncNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm text-foreground-2',
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin flex-shrink-0 text-info" />
      <span>{SYNC_MESSAGE}</span>
    </div>
  )
}
