import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Keep a mailbox's conversations on the same store as the mailbox.
 *
 * `email_conversations.store_id` is snapshotted from `email_accounts.store_id`
 * at ingestion time (see `lib/conversationEngine.ts`). When a mailbox is
 * (re)linked to a store the account's `store_id` changes, but its existing
 * conversations keep the stale value — and the inbox filters conversations by
 * `store_id`, so they would appear under the wrong store. Call this right after
 * a connect/link upsert to re-stamp the account's conversations (cascade on
 * link). A one-time backfill for pre-existing rows lives in migration
 * `20260710140010_resync-conversation-store-id-from-account`.
 */
export async function syncConversationsToAccountStore(
  workspaceId: string,
  emailAccountId: string,
  storeId: string | null,
): Promise<void> {
  await supabaseAdmin
    .from('email_conversations')
    .update({ store_id: storeId })
    .eq('workspace_id', workspaceId)
    .eq('email_account_id', emailAccountId)
}
