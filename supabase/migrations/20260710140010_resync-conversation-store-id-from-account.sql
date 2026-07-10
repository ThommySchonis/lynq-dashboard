-- Re-sync email_conversations.store_id from its owning email account.
--
-- A conversation's store_id is a snapshot copied from email_accounts.store_id
-- at creation time (see lib/conversationEngine.ts). When a mailbox is later
-- (re)linked to a different store, the account's store_id changes but its
-- existing conversations keep the stale value. In multi-store workspaces this
-- makes the inbox show a mailbox's conversations under the wrong store (and an
-- empty list under the correct one), because the conversation list is filtered
-- by email_conversations.store_id while the mailbox switcher is filtered by
-- email_accounts.store_id.
--
-- The intended invariant is: a conversation belongs to the same store as its
-- mailbox. This backfill restores that invariant for all existing rows.
-- Going forward, the connect/link flows keep the two in sync (cascade on link).

update email_conversations ec
set store_id = ea.store_id
from email_accounts ea
where ec.email_account_id = ea.id
  and ec.workspace_id = ea.workspace_id
  and ec.store_id is distinct from ea.store_id;
