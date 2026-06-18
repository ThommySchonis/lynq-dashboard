'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmailAccounts } from '@/hooks/settings'
import { isAccountSyncing } from '@/lib/email-sync'

const SYNC_MESSAGE =
  'Syncing your inbox — importing your emails can take a few minutes. New messages will appear as they arrive.'

/**
 * Presentational "still syncing" notice.
 *  - `inline`  → bordered info box, used per-account in settings.
 *  - `banner`  → fixed full-width bar, used at the top of the inbox.
 */
export function SyncNotice({
  variant = 'inline',
  className,
}: {
  variant?: 'inline' | 'banner'
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2.5 text-sm',
        variant === 'inline'
          ? 'rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-foreground-2'
          : 'fixed top-0 right-0 left-0 z-50 border-b border-info/20 bg-info-soft px-4 py-2.5 text-foreground-2 shadow-sm',
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin flex-shrink-0 text-info" />
      <span>{SYNC_MESSAGE}</span>
    </div>
  )
}

/**
 * Inbox-mounted wrapper: shows a single banner notice whenever ANY connected
 * account is still performing its initial sync. Reuses the same
 * `useEmailAccounts()` query as settings, so no extra fetch.
 */
export function InboxSyncNotice() {
  const { data: accounts } = useEmailAccounts()
  const syncing = (accounts ?? []).some(isAccountSyncing)
  if (!syncing) return null
  return <SyncNotice variant="banner" />
}
