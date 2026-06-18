import type { EmailAccount } from '@/types/settings'

/**
 * How long after connecting we keep showing the "syncing" notice when
 * `last_sync_at` is still null. Guards the empty-mailbox case: a first sync
 * that returns zero threads never sets `last_sync_at`
 * (lib/conversationEngine.ts:151), so without this cap the notice could
 * linger forever.
 */
export const SYNC_NOTICE_WINDOW_MS = 30 * 60 * 1000 // 30 minutes

type SyncableAccount = Pick<EmailAccount, 'provider' | 'last_sync_at' | 'connected_at'>

/**
 * True when an account is still performing its initial inbox import:
 *  - not a forwarding account (those are webhook-driven, never set last_sync_at)
 *  - last_sync_at is still null (no sync has landed threads yet)
 *  - connected within the fallback window (avoids lingering forever)
 */
export function isAccountSyncing(account: SyncableAccount): boolean {
  if (account.provider === 'forwarding') return false
  if (account.last_sync_at != null) return false
  if (account.connected_at == null) return false
  const connectedMs = new Date(account.connected_at).getTime()
  if (Number.isNaN(connectedMs)) return false
  return Date.now() - connectedMs < SYNC_NOTICE_WINDOW_MS
}
