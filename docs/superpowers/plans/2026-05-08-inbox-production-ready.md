# Inbox Production-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the inbox fully functional for a single Shopify store with Gmail, Outlook, and custom IMAP/SMTP email providers, unified behind a single conversation engine.

**Architecture:** Provider adapters (Gmail, Outlook, Custom) implement a common interface. A conversation engine normalizes all email into `email_conversations` + `email_messages`. The UI talks only to unified `/api/inbox/*` routes. Status automation, Shopify customer linking, and internal notes are handled by the engine.

**Tech Stack:** Next.js 16 (app router), React 19, Supabase (PostgreSQL + Auth), Gmail API (REST), Microsoft Graph API, ImapFlow, Nodemailer, AES-256-GCM encryption

**Spec:** `docs/superpowers/specs/2026-05-08-inbox-production-ready-design.md`

**Critical codebase conventions (apply everywhere):**
- **Named imports for supabaseAdmin:** Always `import { supabaseAdmin } from '...'` (NOT default import)
- **No `.js` extensions in imports:** Use `import { x } from '../encryption'` (not `../encryption.js`)
- **`email_accounts.status` values:** `active`, `disconnected`, `error` (migration drops old CHECK constraint)
- **`workspace_id` scoping:** All queries filtered by `workspace_id` from `getAuthContext(request).workspaceId`
- **OAuth callbacks have no Bearer token:** Get `workspace_id` from OAuth state parameter, not `getAuthContext`
- **Packages `imapflow` and `nodemailer` are already in package.json** — no install needed

---

## File Structure

### New files to create:

```
lib/
  providers/
    types.js                    # Shared types: NormalizedMessage, ProviderAdapter interface (JSDoc)
    gmail.js                    # Gmail adapter: fetchThreads, fetchThread, sendReply, sendNew, refreshToken
    outlook.js                  # Outlook adapter: fetchThreads, fetchThread, sendReply, sendNew, refreshToken
    custom.js                   # Custom IMAP/SMTP adapter: fetchThreads, fetchThread, sendReply, sendNew
    index.js                    # getAdapter(provider) factory
  conversationEngine.js         # Sync, status automation, Shopify linking, processInboundMessage

app/api/inbox/
  conversations/
    route.js                    # GET list, POST (not used, but reserved)
  conversations/[id]/
    route.js                    # GET detail, PATCH status/read
  conversations/[id]/reply/
    route.js                    # POST send reply
  conversations/[id]/notes/
    route.js                    # GET list, POST add note
  conversations/[id]/link-customer/
    route.js                    # POST link Shopify customer
  compose/
    route.js                    # POST send new email
  sync/
    route.js                    # POST trigger sync
  counts/
    route.js                    # GET folder counts
  accounts/
    route.js                    # GET list connected accounts
  accounts/[id]/
    route.js                    # DELETE disconnect account

supabase/migrations/
  20260508_inbox_production.sql  # Schema updates + conversation_notes table
  20260508_migrate_legacy_tokens.sql  # Data migration from gmail_tokens/outlook_tokens/custom_email_tokens

app/api/inbox/
  shopify-customer/
    route.js                    # GET search Shopify customers for linking
```

### Existing files to modify:

```
app/api/auth/gmail/route.js             # Fix OAuth flow to write to email_accounts
app/api/auth/gmail/callback/route.js    # Fix callback to write to email_accounts with workspace_id
app/api/auth/outlook/route.js           # Fix OAuth flow
app/api/auth/outlook/callback/route.js  # Fix callback to write to email_accounts
app/api/auth/custom-email/connect/route.js  # Fix to write to email_accounts
app/api/webhooks/email/inbound/route.js # Refactor to call conversationEngine.processInboundMessage
app/settings/integrations/email/page.js # Wire up real OAuth buttons
app/inbox/page.js                       # Refactor to use /api/inbox/* routes
```

---

## Task 1: Database Schema Updates

**Files:**
- Create: `supabase/migrations/20260508_inbox_production.sql`

This migration updates `email_accounts` with missing columns, creates `conversation_notes`, and adds indexes. Run against local Supabase or apply via dashboard.

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260508_inbox_production.sql

-- 0. Fix email_accounts status CHECK constraint (old: pending/connected/error → new: active/disconnected/error)
ALTER TABLE email_accounts DROP CONSTRAINT IF EXISTS email_accounts_status_check;
ALTER TABLE email_accounts ADD CONSTRAINT email_accounts_status_check CHECK (status IN ('active', 'disconnected', 'error', 'pending', 'connected'));
-- Keep old values valid during migration, new code uses active/disconnected/error

-- 1. Update email_accounts: add columns for unified token storage
ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS encrypted_password text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS imap_host text,
  ADD COLUMN IF NOT EXISTS imap_port integer,
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_address text;

-- 2. Add missing columns to email_conversations
ALTER TABLE email_conversations
  ADD COLUMN IF NOT EXISTS email_account_id uuid REFERENCES email_accounts(id),
  ADD COLUMN IF NOT EXISTS snippet text,
  ADD COLUMN IF NOT EXISTS provider_thread_id text,
  ADD COLUMN IF NOT EXISTS shopify_customer_id text,
  ADD COLUMN IF NOT EXISTS message_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_unread boolean DEFAULT true;

-- 3. Add missing columns to email_messages
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS to_email text,
  ADD COLUMN IF NOT EXISTS to_name text,
  ADD COLUMN IF NOT EXISTS cc jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS bcc jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subject text;

-- 4. Create conversation_notes table
CREATE TABLE IF NOT EXISTS conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES email_conversations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. RLS for conversation_notes
ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_notes_select_workspace_members"
  ON conversation_notes FOR SELECT
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

CREATE POLICY "conversation_notes_insert_workspace_members"
  ON conversation_notes FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()));

-- 6. Unique constraint for email_accounts upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_workspace_provider_email
  ON email_accounts(workspace_id, provider, email_address);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_email_conversations_workspace_status
  ON email_conversations(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_email_conversations_workspace_last_message
  ON email_conversations(workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_conversations_customer_email
  ON email_conversations(customer_email);
CREATE INDEX IF NOT EXISTS idx_email_conversations_provider_thread
  ON email_conversations(provider_thread_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_provider_message_id
  ON email_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
-- Note: This is a partial unique index. Use INSERT...ON CONFLICT DO NOTHING instead of upsert for dedup.
CREATE INDEX IF NOT EXISTS idx_email_messages_conversation_created
  ON email_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_notes_conversation
  ON conversation_notes(conversation_id, created_at);
```

- [ ] **Step 2: Apply migration**

Run via Supabase dashboard SQL editor or:
```bash
# If using Supabase CLI:
npx supabase db push
# Or apply manually via dashboard
```

- [ ] **Step 3: Verify tables**

Check in Supabase dashboard that:
- `email_accounts` has new columns (`access_token`, `refresh_token`, `encrypted_password`, `username`, `expires_at`, `imap_host`, `imap_port`, `smtp_host`, `smtp_port`, `is_default`, `last_sync_at`, `email_address`)
- `email_conversations` has new columns (`email_account_id`, `snippet`, `provider_thread_id`, `shopify_customer_id`, `message_count`, `is_unread`)
- `email_messages` has new columns (`provider_message_id`, `to_email`, `to_name`, `cc`, `bcc`, `subject`)
- `conversation_notes` table exists with RLS enabled
- All indexes created


---

## Task 1B: Migrate Legacy Token Data

**Files:**
- Create: `supabase/migrations/20260508_migrate_legacy_tokens.sql`

Migrate existing credentials from `gmail_tokens`, `outlook_tokens`, and `custom_email_tokens` into the unified `email_accounts` table. Run AFTER Task 1.

- [ ] **Step 1: Write data migration SQL**

```sql
-- supabase/migrations/20260508_migrate_legacy_tokens.sql

-- Migrate gmail_tokens → email_accounts
-- Note: gmail_tokens uses user_id, we need workspace_id from workspace_members
INSERT INTO email_accounts (workspace_id, provider, email_address, display_name, access_token, refresh_token, expires_at, status)
SELECT
  wm.workspace_id,
  'gmail',
  gt.gmail_address,
  COALESCE(gt.gmail_address, gt.email),
  gt.access_token,
  gt.refresh_token,
  gt.expires_at,
  'active'
FROM gmail_tokens gt
JOIN workspace_members wm ON wm.user_id = gt.user_id
WHERE gt.access_token IS NOT NULL
ON CONFLICT (workspace_id, provider, email_address) DO NOTHING;

-- Migrate outlook_tokens → email_accounts
INSERT INTO email_accounts (workspace_id, provider, email_address, display_name, access_token, refresh_token, expires_at, status)
SELECT
  wm.workspace_id,
  'outlook',
  COALESCE(ot.outlook_address, ot.email),
  COALESCE(ot.outlook_address, ot.email),
  ot.access_token,
  ot.refresh_token,
  ot.expires_at,
  'active'
FROM outlook_tokens ot
JOIN workspace_members wm ON wm.user_id = ot.user_id
WHERE ot.access_token IS NOT NULL
ON CONFLICT (workspace_id, provider, email_address) DO NOTHING;

-- Migrate custom_email_tokens → email_accounts
INSERT INTO email_accounts (workspace_id, provider, email_address, display_name, encrypted_password, username, imap_host, imap_port, smtp_host, smtp_port, status)
SELECT
  wm.workspace_id,
  'custom',
  ct.email,
  ct.email,
  ct.encrypted_password,
  ct.email,
  ct.imap_host,
  ct.imap_port,
  ct.smtp_host,
  ct.smtp_port,
  'active'
FROM custom_email_tokens ct
JOIN workspace_members wm ON wm.user_id = ct.user_id
WHERE ct.encrypted_password IS NOT NULL
ON CONFLICT (workspace_id, provider, email_address) DO NOTHING;

-- Set first account per workspace as default
UPDATE email_accounts ea
SET is_default = true
WHERE ea.id = (
  SELECT id FROM email_accounts
  WHERE workspace_id = ea.workspace_id
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM email_accounts
  WHERE workspace_id = ea.workspace_id AND is_default = true
);
```

- [ ] **Step 2: Apply migration**

Run via Supabase dashboard SQL editor.

- [ ] **Step 3: Verify migration**

Check that `email_accounts` now has rows for all previously connected Gmail/Outlook/Custom accounts. Verify tokens are intact.


---

## Task 2: Provider Adapter Types & Factory

**Files:**
- Create: `lib/providers/types.js`
- Create: `lib/providers/index.js`

Define the shared interface and factory function that all adapters conform to.

- [ ] **Step 1: Create types file with JSDoc interface**

```javascript
// lib/providers/types.js

/**
 * @typedef {Object} NormalizedMessage
 * @property {string} providerMessageId - Provider-specific unique ID
 * @property {string} messageId - RFC 2822 Message-ID header
 * @property {{email: string, name: string}} from
 * @property {{email: string, name: string}[]} to
 * @property {{email: string, name: string}[]} cc
 * @property {string} subject
 * @property {string} bodyHtml
 * @property {string} bodyText
 * @property {string} date - ISO timestamp
 * @property {boolean} isOutbound
 */

/**
 * @typedef {Object} FetchThreadsResult
 * @property {Object[]} threads - Array of { providerThreadId, messages: NormalizedMessage[], subject, snippet, lastMessageAt }
 * @property {string|null} nextPageToken
 */

/**
 * @typedef {Object} SendResult
 * @property {string} providerMessageId
 * @property {string} messageId - RFC 2822 Message-ID
 */

/**
 * Provider adapter interface (implemented by gmail.js, outlook.js, custom.js)
 *
 * All adapters must implement:
 *   fetchThreads(account, { since, pageToken, limit }) → FetchThreadsResult
 *   fetchThread(account, providerThreadId) → { messages: NormalizedMessage[] }
 *   sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }) → SendResult
 *   sendNew(account, { to, cc, bcc, subject, bodyHtml, bodyText }) → SendResult
 *   refreshTokenIfNeeded(account) → account (updated if refreshed)
 */

export const PROVIDERS = {
  GMAIL: 'gmail',
  OUTLOOK: 'outlook',
  CUSTOM: 'custom',
}
```

- [ ] **Step 2: Create adapter factory**

```javascript
// lib/providers/index.js

import { PROVIDERS } from './types'
import * as gmailAdapter from './gmail'
import * as outlookAdapter from './outlook'
import * as customAdapter from './custom'

const adapters = {
  [PROVIDERS.GMAIL]: gmailAdapter,
  [PROVIDERS.OUTLOOK]: outlookAdapter,
  [PROVIDERS.CUSTOM]: customAdapter,
}

export function getAdapter(provider) {
  const adapter = adapters[provider]
  if (!adapter) throw new Error(`Unknown provider: ${provider}`)
  return adapter
}
```


---

## Task 3: Gmail Provider Adapter

**Files:**
- Create: `lib/providers/gmail.js`
- Reference: `lib/encryption.js` (for token decryption)
- Reference: `app/api/gmail/threads/route.js` (existing Gmail API calls to reuse patterns)
- Reference: `app/api/gmail/send/route.js` (existing send pattern)

The existing Gmail routes already contain working Gmail API calls. Extract and adapt that logic into the adapter interface.

- [ ] **Step 1: Read existing Gmail route implementations**

Read these files to understand the current Gmail API interaction:
- `app/api/gmail/threads/route.js`
- `app/api/gmail/thread/[id]/route.js`
- `app/api/gmail/send/route.js`
- `app/api/auth/gmail/callback/route.js` (token refresh pattern)

- [ ] **Step 2: Implement Gmail adapter**

Create `lib/providers/gmail.js` implementing:

```javascript
// lib/providers/gmail.js
import { decrypt, encrypt } from '../encryption'
import { supabaseAdmin } from '../supabaseAdmin'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

async function getAccessToken(account) {
  // Decrypt stored token
  const accessToken = decrypt(account.access_token)
  const refreshToken = decrypt(account.refresh_token)

  // Check if expired (with 5 min buffer)
  if (account.expires_at && new Date(account.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    // Refresh the token
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Gmail token refresh failed: ${data.error}`)

    // Update stored token
    await supabaseAdmin
      .from('email_accounts')
      .update({
        access_token: encrypt(data.access_token),
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      })
      .eq('id', account.id)

    return data.access_token
  }

  return accessToken
}

function parseGmailMessage(msg, accountEmail) {
  const headers = msg.payload?.headers || []
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  const from = parseEmailAddress(getHeader('From'))
  const to = parseEmailAddresses(getHeader('To'))
  const cc = parseEmailAddresses(getHeader('Cc'))
  const subject = getHeader('Subject')
  const messageId = getHeader('Message-ID') || getHeader('Message-Id')
  const date = getHeader('Date')

  // Extract body
  let bodyHtml = ''
  let bodyText = ''
  function extractParts(part) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml = Buffer.from(part.body.data, 'base64url').toString('utf8')
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText = Buffer.from(part.body.data, 'base64url').toString('utf8')
    }
    if (part.parts) part.parts.forEach(extractParts)
  }
  extractParts(msg.payload)

  const isOutbound = from.email.toLowerCase() === accountEmail.toLowerCase()

  return {
    providerMessageId: msg.id,
    messageId,
    from,
    to,
    cc,
    subject,
    bodyHtml,
    bodyText,
    date: date ? new Date(date).toISOString() : new Date(parseInt(msg.internalDate)).toISOString(),
    isOutbound,
  }
}

function parseEmailAddress(str) {
  if (!str) return { email: '', name: '' }
  const match = str.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2].trim() }
  return { email: str.trim(), name: '' }
}

function parseEmailAddresses(str) {
  if (!str) return []
  return str.split(',').map(s => parseEmailAddress(s.trim())).filter(a => a.email)
}

export async function refreshTokenIfNeeded(account) {
  await getAccessToken(account) // Side effect: refreshes if needed
  // Re-fetch account to get updated token
  const { data } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('id', account.id)
    .single()
  return data
}

export async function fetchThreads(account, { since, pageToken, limit = 20 } = {}) {
  const token = await getAccessToken(account)

  let query = `maxResults=${limit}`
  if (pageToken) query += `&pageToken=${pageToken}`
  if (since) {
    const epoch = Math.floor(new Date(since).getTime() / 1000)
    query += `&q=after:${epoch}`
  }

  const res = await fetch(`${GMAIL_API}/threads?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Gmail fetchThreads failed: ${res.status}`)
  const data = await res.json()

  if (!data.threads?.length) return { threads: [], nextPageToken: null }

  // Fetch each thread's messages
  const threads = await Promise.all(
    data.threads.map(async (t) => {
      const threadRes = await fetch(`${GMAIL_API}/threads/${t.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!threadRes.ok) return null
      const threadData = await threadRes.json()

      const messages = threadData.messages.map(m => parseGmailMessage(m, account.email_address))
      const lastMsg = messages[messages.length - 1]

      return {
        providerThreadId: t.id,
        messages,
        subject: messages[0]?.subject || '(no subject)',
        snippet: threadData.snippet || '',
        lastMessageAt: lastMsg?.date || new Date().toISOString(),
      }
    })
  )

  return {
    threads: threads.filter(Boolean),
    nextPageToken: data.nextPageToken || null,
  }
}

export async function fetchThread(account, providerThreadId) {
  const token = await getAccessToken(account)

  const res = await fetch(`${GMAIL_API}/threads/${providerThreadId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Gmail fetchThread failed: ${res.status}`)
  const data = await res.json()

  return {
    messages: data.messages.map(m => parseGmailMessage(m, account.email_address)),
  }
}

export async function sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }) {
  const token = await getAccessToken(account)

  const boundary = `boundary_${Date.now()}`
  const toHeader = to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ')
  const ccHeader = cc?.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ') || ''

  let rawEmail = [
    `From: ${account.display_name || account.email_address} <${account.email_address}>`,
    `To: ${toHeader}`,
    ccHeader ? `Cc: ${ccHeader}` : null,
    `Subject: ${subject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${references || inReplyTo}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText || '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    bodyHtml,
    `--${boundary}--`,
  ].filter(line => line !== null).join('\r\n')

  const encodedEmail = Buffer.from(rawEmail).toString('base64url')

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedEmail }),
  })
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status}`)
  const data = await res.json()

  return {
    providerMessageId: data.id,
    messageId: data.id, // Gmail doesn't return Message-ID header directly
  }
}

export async function sendNew(account, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  // Same as sendReply but without In-Reply-To/References headers
  return sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo: '', references: '' })
}
```

- [ ] **Step 3: Verify the adapter loads without errors**

```bash
ls lib/providers/gmail.js && echo "Gmail adapter created"
```

Expected: file exists


---

## Task 4: Outlook Provider Adapter

**Files:**
- Create: `lib/providers/outlook.js`
- Reference: `app/api/outlook/threads/route.js` (existing Outlook API patterns)
- Reference: `app/api/auth/outlook/callback/route.js` (token refresh)

- [ ] **Step 1: Read existing Outlook route implementations**

Read these files:
- `app/api/outlook/threads/route.js`
- `app/api/outlook/thread/[id]/route.js`
- `app/api/outlook/send/route.js`
- `app/api/auth/outlook/callback/route.js`

- [ ] **Step 2: Implement Outlook adapter**

Create `lib/providers/outlook.js`:

```javascript
// lib/providers/outlook.js
import { decrypt, encrypt } from '../encryption'
import { supabaseAdmin } from '../supabaseAdmin'

const GRAPH_API = 'https://graph.microsoft.com/v1.0/me'

async function getAccessToken(account) {
  const accessToken = decrypt(account.access_token)
  const refreshToken = decrypt(account.refresh_token)

  if (account.expires_at && new Date(account.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'Mail.ReadWrite Mail.Send offline_access',
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Outlook token refresh failed: ${data.error}`)

    await supabaseAdmin
      .from('email_accounts')
      .update({
        access_token: encrypt(data.access_token),
        refresh_token: data.refresh_token ? encrypt(data.refresh_token) : account.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      })
      .eq('id', account.id)

    return data.access_token
  }

  return accessToken
}

function parseOutlookMessage(msg, accountEmail) {
  const from = {
    email: msg.from?.emailAddress?.address || '',
    name: msg.from?.emailAddress?.name || '',
  }
  const to = (msg.toRecipients || []).map(r => ({
    email: r.emailAddress?.address || '',
    name: r.emailAddress?.name || '',
  }))
  const cc = (msg.ccRecipients || []).map(r => ({
    email: r.emailAddress?.address || '',
    name: r.emailAddress?.name || '',
  }))

  const isOutbound = from.email.toLowerCase() === accountEmail.toLowerCase()

  return {
    providerMessageId: msg.id,
    messageId: msg.internetMessageId || msg.id,
    from,
    to,
    cc,
    subject: msg.subject || '(no subject)',
    bodyHtml: msg.body?.contentType === 'html' ? msg.body.content : '',
    bodyText: msg.body?.contentType === 'text' ? msg.body.content : '',
    date: msg.receivedDateTime || msg.sentDateTime || new Date().toISOString(),
    isOutbound,
  }
}

export async function refreshTokenIfNeeded(account) {
  await getAccessToken(account)
  const { data } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('id', account.id)
    .single()
  return data
}

export async function fetchThreads(account, { since, pageToken, limit = 20 } = {}) {
  const token = await getAccessToken(account)

  let url = `${GRAPH_API}/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId,internetMessageId,body,isRead`
  if (since) {
    url += `&$filter=receivedDateTime ge ${new Date(since).toISOString()}`
  }
  if (pageToken) {
    url = pageToken // Outlook uses full URL as next link
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Outlook fetchThreads failed: ${res.status}`)
  const data = await res.json()

  // Group messages by conversationId into threads
  const threadMap = new Map()
  for (const msg of (data.value || [])) {
    const cid = msg.conversationId || msg.id
    if (!threadMap.has(cid)) {
      threadMap.set(cid, [])
    }
    threadMap.get(cid).push(parseOutlookMessage(msg, account.email_address))
  }

  const threads = Array.from(threadMap.entries()).map(([cid, messages]) => {
    messages.sort((a, b) => new Date(a.date) - new Date(b.date))
    const lastMsg = messages[messages.length - 1]
    return {
      providerThreadId: cid,
      messages,
      subject: messages[0]?.subject || '(no subject)',
      snippet: data.value?.find(m => m.conversationId === cid)?.bodyPreview || '',
      lastMessageAt: lastMsg?.date || new Date().toISOString(),
    }
  })

  return {
    threads,
    nextPageToken: data['@odata.nextLink'] || null,
  }
}

export async function fetchThread(account, providerThreadId) {
  const token = await getAccessToken(account)

  const url = `${GRAPH_API}/messages?$filter=conversationId eq '${providerThreadId}'&$orderby=receivedDateTime asc&$select=id,subject,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,internetMessageId`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Outlook fetchThread failed: ${res.status}`)
  const data = await res.json()

  return {
    messages: (data.value || []).map(m => parseOutlookMessage(m, account.email_address)),
  }
}

export async function sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }) {
  const token = await getAccessToken(account)

  const message = {
    subject,
    body: { contentType: 'html', content: bodyHtml },
    toRecipients: to.map(a => ({ emailAddress: { address: a.email, name: a.name } })),
    ccRecipients: (cc || []).map(a => ({ emailAddress: { address: a.email, name: a.name } })),
    bccRecipients: (bcc || []).map(a => ({ emailAddress: { address: a.email, name: a.name } })),
  }

  const res = await fetch(`${GRAPH_API}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Outlook send failed: ${res.status} ${err}`)
  }

  return {
    providerMessageId: `outlook_sent_${Date.now()}`,
    messageId: `<outlook_${Date.now()}@graph.microsoft.com>`,
  }
}

export async function sendNew(account, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  return sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText })
}
```

- [ ] **Step 3: Verify the adapter loads**

```bash
ls lib/providers/outlook.js && echo "Outlook adapter created"
```

Expected: file exists


---

## Task 5: Custom Email (IMAP/SMTP) Provider Adapter

**Files:**
- Create: `lib/providers/custom.js`
- Reference: `app/api/custom-email/threads/route.js` (existing IMAP patterns)
- Reference: `app/api/custom-email/send/route.js` (existing SMTP patterns)

- [ ] **Step 1: Read existing custom email implementations**

Read:
- `app/api/custom-email/threads/route.js`
- `app/api/custom-email/thread/[id]/route.js`
- `app/api/custom-email/send/route.js`

- [ ] **Step 2: Implement Custom email adapter**

Create `lib/providers/custom.js`:

```javascript
// lib/providers/custom.js
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { decrypt } from '../encryption'

function getImapConfig(account) {
  return {
    host: account.imap_host,
    port: account.imap_port || 993,
    secure: true,
    auth: {
      user: account.username || account.email_address,
      pass: decrypt(account.encrypted_password),
    },
    logger: false,
  }
}

function getSmtpConfig(account) {
  return {
    host: account.smtp_host,
    port: account.smtp_port || 465,
    secure: account.smtp_port === 465 || !account.smtp_port,
    auth: {
      user: account.username || account.email_address,
      pass: decrypt(account.encrypted_password),
    },
  }
}

function parseImapAddress(addr) {
  if (!addr || !addr.length) return []
  return addr.map(a => ({
    email: a.address || '',
    name: a.name || '',
  }))
}

function parseImapMessage(msg, accountEmail) {
  const envelope = msg.envelope
  const from = envelope.from?.[0] ? { email: envelope.from[0].address || '', name: envelope.from[0].name || '' } : { email: '', name: '' }
  const to = parseImapAddress(envelope.to)
  const cc = parseImapAddress(envelope.cc)
  const isOutbound = from.email.toLowerCase() === accountEmail.toLowerCase()

  // Body parsing
  let bodyHtml = ''
  let bodyText = ''
  if (msg.bodyStructure) {
    // Will be populated by FETCH with source
  }
  if (typeof msg.source === 'string' || Buffer.isBuffer(msg.source)) {
    const source = msg.source.toString()
    // Simple extraction - proper MIME parsing for production
    const htmlMatch = source.match(/Content-Type: text\/html[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\.\r\n|$)/i)
    if (htmlMatch) bodyHtml = htmlMatch[1]
    const textMatch = source.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\.\r\n|$)/i)
    if (textMatch) bodyText = textMatch[1]
  }

  return {
    providerMessageId: `imap_${msg.uid}`,
    messageId: envelope.messageId || `imap_${msg.uid}`,
    from,
    to,
    cc,
    subject: envelope.subject || '(no subject)',
    bodyHtml,
    bodyText,
    date: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
    isOutbound,
  }
}

export async function refreshTokenIfNeeded(account) {
  // No token refresh for custom IMAP/SMTP
  return account
}

export async function fetchThreads(account, { since, pageToken, limit = 200 } = {}) {
  const client = new ImapFlow(getImapConfig(account))

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      // Search for messages, limited by date or count
      let searchCriteria = {}
      if (since) {
        searchCriteria.since = new Date(since)
      } else {
        // Default: last 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        searchCriteria.since = thirtyDaysAgo
      }

      const messages = []
      let count = 0
      for await (const msg of client.fetch(searchCriteria, {
        envelope: true,
        uid: true,
      })) {
        messages.push(msg)
        count++
        if (count >= limit) break
      }

      // Group by In-Reply-To / References into threads
      const threadMap = new Map()
      for (const msg of messages) {
        const env = msg.envelope
        const inReplyTo = env.inReplyTo
        let threadId = env.messageId || `imap_${msg.uid}`

        // Try to find parent thread
        if (inReplyTo) {
          for (const [tid, thread] of threadMap) {
            if (thread.messageIds.has(inReplyTo)) {
              threadId = tid
              break
            }
          }
        }

        if (!threadMap.has(threadId)) {
          threadMap.set(threadId, { messages: [], messageIds: new Set() })
        }
        threadMap.get(threadId).messages.push(parseImapMessage(msg, account.email_address))
        threadMap.get(threadId).messageIds.add(env.messageId)
      }

      const threads = Array.from(threadMap.entries()).map(([tid, { messages: msgs }]) => {
        msgs.sort((a, b) => new Date(a.date) - new Date(b.date))
        const lastMsg = msgs[msgs.length - 1]
        return {
          providerThreadId: tid,
          messages: msgs,
          subject: msgs[0]?.subject || '(no subject)',
          snippet: msgs[msgs.length - 1]?.bodyText?.substring(0, 100) || '',
          lastMessageAt: lastMsg?.date || new Date().toISOString(),
        }
      })

      threads.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))

      return { threads, nextPageToken: null }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

export async function fetchThread(account, providerThreadId) {
  const client = new ImapFlow(getImapConfig(account))

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      // Fetch the specific message and related messages
      const messages = []
      for await (const msg of client.fetch(
        { header: { 'message-id': [providerThreadId] } },
        { envelope: true, source: true, uid: true }
      )) {
        messages.push(parseImapMessage(msg, account.email_address))
      }

      // Also fetch replies (messages referencing this thread)
      for await (const msg of client.fetch(
        { header: { 'in-reply-to': [providerThreadId] } },
        { envelope: true, source: true, uid: true }
      )) {
        messages.push(parseImapMessage(msg, account.email_address))
      }

      messages.sort((a, b) => new Date(a.date) - new Date(b.date))
      return { messages }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

export async function sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }) {
  const transporter = nodemailer.createTransport(getSmtpConfig(account))

  const info = await transporter.sendMail({
    from: account.display_name
      ? `"${account.display_name}" <${account.email_address}>`
      : account.email_address,
    to: to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', '),
    cc: cc?.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ') || undefined,
    bcc: bcc?.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ') || undefined,
    subject,
    text: bodyText || '',
    html: bodyHtml,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
  })

  return {
    providerMessageId: info.messageId?.replace(/[<>]/g, '') || `smtp_${Date.now()}`,
    messageId: info.messageId || `<smtp_${Date.now()}@${account.smtp_host}>`,
  }
}

export async function sendNew(account, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  return sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText })
}
```

- [ ] **Step 3: Verify the adapter loads**

```bash
ls lib/providers/custom.js && echo "Custom adapter created"
```

Expected: file exists


---

## Task 6: Conversation Engine

**Files:**
- Create: `lib/conversationEngine.js`
- Reference: `lib/emailUsage.js` (limit checking)
- Reference: `lib/supabaseAdmin.js` (database access)

This is the central logic layer. It handles sync, status automation, Shopify linking, and inbound message processing.

- [ ] **Step 1: Read existing conversation/reply routes for patterns**

Read:
- `app/api/email/conversations/route.js`
- `app/api/email/conversations/[id]/reply/route.js`
- `app/api/webhooks/email/inbound/route.js`
- `lib/emailUsage.js`

- [ ] **Step 2: Implement conversation engine**

Create `lib/conversationEngine.js`:

```javascript
// lib/conversationEngine.js
import { supabaseAdmin } from './supabaseAdmin'
import { getAdapter } from './providers'
import { checkEmailLimit, incrementEmailCount } from './emailUsage'

/**
 * Sync all connected email accounts for a workspace.
 * Fetches new threads/messages from each provider and stores them.
 */
export async function syncAllAccounts(workspaceId) {
  const { data: accounts } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  if (!accounts?.length) return { synced: 0 }

  const results = []
  for (const account of accounts) {
    try {
      const result = await syncAccount(account, workspaceId)
      results.push({ accountId: account.id, ...result })
    } catch (err) {
      console.error(`Sync failed for account ${account.id}:`, err.message)
      results.push({ accountId: account.id, error: err.message })
    }
  }

  return { synced: results.length, results }
}

/**
 * Sync a single email account.
 */
async function syncAccount(account, workspaceId) {
  const adapter = getAdapter(account.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const { threads } = await adapter.fetchThreads(refreshedAccount, {
    since: account.last_sync_at || undefined,
  })

  let newConversations = 0
  let updatedConversations = 0

  for (const thread of threads) {
    const existing = await findConversationByThreadId(workspaceId, thread.providerThreadId)

    if (existing) {
      await updateConversationWithNewMessages(existing, thread, workspaceId)
      updatedConversations++
    } else {
      await createConversation(thread, account, workspaceId)
      newConversations++
    }
  }

  // Update last_sync_at
  await supabaseAdmin
    .from('email_accounts')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', account.id)

  return { newConversations, updatedConversations }
}

async function findConversationByThreadId(workspaceId, providerThreadId) {
  const { data } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider_thread_id', providerThreadId)
    .maybeSingle()
  return data
}

async function createConversation(thread, account, workspaceId) {
  // Find the first inbound message to get customer info
  const inboundMsg = thread.messages.find(m => !m.isOutbound) || thread.messages[0]
  const customerEmail = inboundMsg?.isOutbound ? inboundMsg.to[0]?.email : inboundMsg?.from?.email
  const customerName = inboundMsg?.isOutbound ? inboundMsg.to[0]?.name : inboundMsg?.from?.name

  // Auto-match Shopify customer
  const shopifyCustomerId = await matchShopifyCustomer(workspaceId, customerEmail)

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .insert({
      workspace_id: workspaceId,
      email_account_id: account.id,
      subject: thread.subject,
      snippet: thread.snippet,
      customer_email: customerEmail || '',
      customer_name: customerName || '',
      status: 'open',
      provider_thread_id: thread.providerThreadId,
      shopify_customer_id: shopifyCustomerId,
      last_message_at: thread.lastMessageAt,
      message_count: thread.messages.length,
      is_unread: true,
    })
    .select()
    .single()

  // Insert all messages
  if (conversation) {
    await insertMessages(conversation.id, workspaceId, thread.messages)
  }

  return conversation
}

async function updateConversationWithNewMessages(conversation, thread, workspaceId) {
  // Find messages not yet in the database (dedup by provider_message_id)
  const { data: existingMessages } = await supabaseAdmin
    .from('email_messages')
    .select('provider_message_id')
    .eq('conversation_id', conversation.id)

  const existingIds = new Set((existingMessages || []).map(m => m.provider_message_id))
  const newMessages = thread.messages.filter(m => !existingIds.has(m.providerMessageId))

  if (newMessages.length === 0) return

  await insertMessages(conversation.id, workspaceId, newMessages)

  // Check if any new inbound message should reopen the conversation
  const hasNewInbound = newMessages.some(m => !m.isOutbound)
  const updates = {
    last_message_at: thread.lastMessageAt,
    snippet: thread.snippet,
    message_count: conversation.message_count + newMessages.length,
  }

  if (hasNewInbound && ['resolved', 'closed', 'pending'].includes(conversation.status)) {
    updates.status = 'open'
    updates.is_unread = true
  }

  await supabaseAdmin
    .from('email_conversations')
    .update(updates)
    .eq('id', conversation.id)
}

async function insertMessages(conversationId, workspaceId, messages) {
  const rows = messages.map(m => ({
    conversation_id: conversationId,
    workspace_id: workspaceId,
    provider_message_id: m.providerMessageId,
    message_id: m.messageId,
    from_email: m.from.email,
    from_name: m.from.name,
    to_email: m.to[0]?.email || '',
    to_name: m.to[0]?.name || '',
    cc: m.cc || [],
    bcc: [],
    subject: m.subject,
    body_html: m.bodyHtml,
    body_text: m.bodyText,
    is_outbound: m.isOutbound,
    created_at: m.date,
  }))

  // Insert with dedup — skip rows that already exist (partial unique index on provider_message_id)
  for (const row of rows) {
    await supabaseAdmin
      .from('email_messages')
      .insert(row)
      .then(({ error }) => {
        // Ignore unique constraint violations (duplicate messages)
        if (error && !error.message.includes('duplicate key')) throw error
      })
  }
}

/**
 * Process an inbound message from the Resend webhook.
 * Same normalization + status logic as sync path.
 */
export async function processInboundMessage(account, normalizedMessage) {
  const workspaceId = account.workspace_id

  // Try to find existing conversation by in-reply-to or subject+customer
  let conversation = null

  if (normalizedMessage.messageId) {
    // Look for a conversation with a message that has this as its messageId
    const { data: relatedMsg } = await supabaseAdmin
      .from('email_messages')
      .select('conversation_id')
      .eq('message_id', normalizedMessage.messageId)
      .maybeSingle()

    if (relatedMsg) {
      const { data } = await supabaseAdmin
        .from('email_conversations')
        .select('*')
        .eq('id', relatedMsg.conversation_id)
        .single()
      conversation = data
    }
  }

  if (!conversation) {
    // Try matching by customer email + similar subject
    const { data } = await supabaseAdmin
      .from('email_conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('customer_email', normalizedMessage.from.email)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Only match if subjects are similar (same thread)
    if (data && data.subject && normalizedMessage.subject?.includes(data.subject.replace(/^Re:\s*/i, ''))) {
      conversation = data
    }
  }

  if (conversation) {
    // Add message to existing conversation, reopen if needed
    await insertMessages(conversation.id, workspaceId, [normalizedMessage])

    const updates = {
      last_message_at: normalizedMessage.date,
      snippet: normalizedMessage.bodyText?.substring(0, 100) || '',
      message_count: (conversation.message_count || 0) + 1,
      is_unread: true,
    }

    if (['resolved', 'closed', 'pending'].includes(conversation.status)) {
      updates.status = 'open'
    }

    await supabaseAdmin
      .from('email_conversations')
      .update(updates)
      .eq('id', conversation.id)
  } else {
    // Create new conversation
    const shopifyCustomerId = await matchShopifyCustomer(workspaceId, normalizedMessage.from.email)

    const { data: newConv } = await supabaseAdmin
      .from('email_conversations')
      .insert({
        workspace_id: workspaceId,
        email_account_id: account.id,
        subject: normalizedMessage.subject || '(no subject)',
        snippet: normalizedMessage.bodyText?.substring(0, 100) || '',
        customer_email: normalizedMessage.from.email,
        customer_name: normalizedMessage.from.name,
        status: 'open',
        provider_thread_id: normalizedMessage.messageId || `inbound_${Date.now()}`,
        shopify_customer_id: shopifyCustomerId,
        last_message_at: normalizedMessage.date,
        message_count: 1,
        is_unread: true,
      })
      .select()
      .single()

    if (newConv) {
      await insertMessages(newConv.id, workspaceId, [normalizedMessage])
    }
  }
}

/**
 * Send a reply to an existing conversation.
 */
export async function sendReply(workspaceId, conversationId, userEmail, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  // Check email limit
  const limitCheck = await checkEmailLimit(userEmail)
  if (!limitCheck.allowed) {
    return {
      error: 'Email limit reached',
      code: 'EMAIL_LIMIT_REACHED',
      used: limitCheck.used,
      limit: limitCheck.limit,
      plan: limitCheck.plan,
    }
  }

  // Get conversation and its email account
  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .select('*, email_accounts(*)')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!conversation) throw new Error('Conversation not found')

  const account = conversation.email_accounts
  if (!account) throw new Error('Email account not found for this conversation')

  // Get the last inbound message for In-Reply-To header
  const { data: lastMsg } = await supabaseAdmin
    .from('email_messages')
    .select('message_id')
    .eq('conversation_id', conversationId)
    .eq('is_outbound', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const adapter = getAdapter(account.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const result = await adapter.sendReply(refreshedAccount, {
    to: to || [{ email: conversation.customer_email, name: conversation.customer_name }],
    cc,
    bcc,
    subject: subject || `Re: ${conversation.subject}`,
    bodyHtml,
    bodyText,
    inReplyTo: lastMsg?.message_id || '',
    references: lastMsg?.message_id || '',
  })

  // Store sent message
  await supabaseAdmin
    .from('email_messages')
    .insert({
      conversation_id: conversationId,
      workspace_id: workspaceId,
      provider_message_id: result.providerMessageId,
      message_id: result.messageId,
      from_email: account.email_address,
      from_name: account.display_name || '',
      to_email: to?.[0]?.email || conversation.customer_email,
      to_name: to?.[0]?.name || conversation.customer_name,
      cc: cc || [],
      bcc: bcc || [],
      subject: subject || `Re: ${conversation.subject}`,
      body_html: bodyHtml,
      body_text: bodyText,
      is_outbound: true,
    })

  // Update conversation status to pending
  await supabaseAdmin
    .from('email_conversations')
    .update({
      status: 'pending',
      last_message_at: new Date().toISOString(),
      message_count: (conversation.message_count || 0) + 1,
    })
    .eq('id', conversationId)

  // Increment usage
  await incrementEmailCount(userEmail)

  return { success: true }
}

/**
 * Send a new email (not a reply).
 */
export async function sendNewEmail(workspaceId, userEmail, accountId, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  const limitCheck = await checkEmailLimit(userEmail)
  if (!limitCheck.allowed) {
    return {
      error: 'Email limit reached',
      code: 'EMAIL_LIMIT_REACHED',
      used: limitCheck.used,
      limit: limitCheck.limit,
      plan: limitCheck.plan,
    }
  }

  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!account) throw new Error('Email account not found')

  const adapter = getAdapter(account.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const result = await adapter.sendNew(refreshedAccount, {
    to, cc, bcc, subject, bodyHtml, bodyText,
  })

  // Auto-match Shopify customer
  const shopifyCustomerId = await matchShopifyCustomer(workspaceId, to[0]?.email)

  // Create conversation
  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .insert({
      workspace_id: workspaceId,
      email_account_id: account.id,
      subject,
      snippet: bodyText?.substring(0, 100) || '',
      customer_email: to[0]?.email || '',
      customer_name: to[0]?.name || '',
      status: 'pending',
      provider_thread_id: result.providerMessageId,
      shopify_customer_id: shopifyCustomerId,
      last_message_at: new Date().toISOString(),
      message_count: 1,
      is_unread: false,
    })
    .select()
    .single()

  if (conversation) {
    await supabaseAdmin
      .from('email_messages')
      .insert({
        conversation_id: conversation.id,
        workspace_id: workspaceId,
        provider_message_id: result.providerMessageId,
        message_id: result.messageId,
        from_email: account.email_address,
        from_name: account.display_name || '',
        to_email: to[0]?.email || '',
        to_name: to[0]?.name || '',
        cc: cc || [],
        bcc: bcc || [],
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        is_outbound: true,
      })
  }

  await incrementEmailCount(userEmail)

  return { success: true, conversationId: conversation?.id }
}

/**
 * Try to match an email address to a Shopify customer.
 */
async function matchShopifyCustomer(workspaceId, email) {
  if (!email) return null

  try {
    // Get the workspace's Shopify credentials from clients table
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('shopify_domain, shopify_api_key')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!client?.shopify_domain || !client?.shopify_api_key) return null

    const res = await fetch(
      `https://${client.shopify_domain}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Shopify-Access-Token': client.shopify_api_key,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) return null
    const data = await res.json()

    if (data.customers?.length > 0) {
      return String(data.customers[0].id)
    }
  } catch (err) {
    console.error('Shopify customer match failed:', err.message)
  }

  return null
}

/**
 * Update conversation status (manual override).
 */
export async function updateConversationStatus(workspaceId, conversationId, status) {
  const validStatuses = ['open', 'pending', 'resolved', 'closed']
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  await supabaseAdmin
    .from('email_conversations')
    .update({ status })
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)

  return { success: true }
}

/**
 * Link a conversation to a Shopify customer.
 */
export async function linkCustomer(workspaceId, conversationId, shopifyCustomerId) {
  await supabaseAdmin
    .from('email_conversations')
    .update({ shopify_customer_id: shopifyCustomerId })
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)

  return { success: true }
}
```

- [ ] **Step 3: Verify the engine loads**

```bash
ls lib/conversationEngine.js && echo "Conversation engine created"
```

Expected: file exists


---

## Task 7: Unified Inbox API Routes

**Files:**
- Create: `app/api/inbox/conversations/route.js`
- Create: `app/api/inbox/conversations/[id]/route.js`
- Create: `app/api/inbox/conversations/[id]/reply/route.js`
- Create: `app/api/inbox/conversations/[id]/notes/route.js`
- Create: `app/api/inbox/conversations/[id]/link-customer/route.js`
- Create: `app/api/inbox/compose/route.js`
- Create: `app/api/inbox/sync/route.js`
- Create: `app/api/inbox/counts/route.js`
- Create: `app/api/inbox/accounts/route.js`
- Create: `app/api/inbox/accounts/[id]/route.js`
- Reference: `lib/auth.js` (getAuthContext)

All routes follow the same pattern: `getAuthContext` → workspace-scoped query → JSON response.

- [ ] **Step 1: Create GET /api/inbox/conversations**

```javascript
// app/api/inbox/conversations/route.js
import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // open, pending, resolved, closed
  const unlinked = searchParams.get('unlinked') === 'true'
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '0')
  const limit = 50

  let query = supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('last_message_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (unlinked) {
    query = query.is('shopify_customer_id', null).neq('status', 'closed')
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`)
  }

  const { data: conversations, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ conversations: conversations || [] })
}
```

- [ ] **Step 2: Create GET/PATCH /api/inbox/conversations/[id]**

```javascript
// app/api/inbox/conversations/[id]/route.js
import { getAuthContext } from '../../../../../lib/auth'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { updateConversationStatus } from '../../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const { data: notes } = await supabaseAdmin
    .from('conversation_notes')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  // Mark as read
  if (conversation.is_unread) {
    await supabaseAdmin
      .from('email_conversations')
      .update({ is_unread: false })
      .eq('id', id)
  }

  return NextResponse.json({
    conversation,
    messages: messages || [],
    notes: notes || [],
  })
}

export async function PATCH(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const updates = {}
  if (body.status) {
    const validStatuses = ['open', 'pending', 'resolved', 'closed']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
  }
  if (typeof body.is_unread === 'boolean') {
    updates.is_unread = body.is_unread
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('email_conversations')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create POST /api/inbox/conversations/[id]/reply**

```javascript
// app/api/inbox/conversations/[id]/reply/route.js
import { getAuthContext } from '../../../../../../lib/auth'
import { sendReply } from '../../../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if (!body.bodyHtml && !body.bodyText) {
    return NextResponse.json({ error: 'Message body required' }, { status: 400 })
  }

  try {
    const result = await sendReply(ctx.workspaceId, id, ctx.user.email, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
    })

    if (result.error) {
      return NextResponse.json(result, { status: 429 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create GET/POST /api/inbox/conversations/[id]/notes**

```javascript
// app/api/inbox/conversations/[id]/notes/route.js
import { getAuthContext } from '../../../../../../lib/auth'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: notes } = await supabaseAdmin
    .from('conversation_notes')
    .select('*')
    .eq('conversation_id', id)
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ notes: notes || [] })
}

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Note body required' }, { status: 400 })
  }

  // Verify conversation belongs to workspace
  const { data: conv } = await supabaseAdmin
    .from('email_conversations')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const { data: note, error } = await supabaseAdmin
    .from('conversation_notes')
    .insert({
      conversation_id: id,
      workspace_id: ctx.workspaceId,
      body: body.body.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ note })
}
```

- [ ] **Step 5: Create POST /api/inbox/conversations/[id]/link-customer**

```javascript
// app/api/inbox/conversations/[id]/link-customer/route.js
import { getAuthContext } from '../../../../../../lib/auth'
import { linkCustomer } from '../../../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if (!body.shopifyCustomerId) {
    return NextResponse.json({ error: 'shopifyCustomerId required' }, { status: 400 })
  }

  try {
    const result = await linkCustomer(ctx.workspaceId, id, body.shopifyCustomerId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 6: Create POST /api/inbox/compose**

```javascript
// app/api/inbox/compose/route.js
import { getAuthContext } from '../../../../lib/auth'
import { sendNewEmail } from '../../../../lib/conversationEngine'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.to?.length) {
    return NextResponse.json({ error: 'Recipient required' }, { status: 400 })
  }
  if (!body.subject) {
    return NextResponse.json({ error: 'Subject required' }, { status: 400 })
  }
  if (!body.bodyHtml && !body.bodyText) {
    return NextResponse.json({ error: 'Message body required' }, { status: 400 })
  }

  // Determine which account to send from
  let accountId = body.accountId
  if (!accountId) {
    // Use default account
    const { data: defaultAccount } = await supabaseAdmin
      .from('email_accounts')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'active')
      .eq('is_default', true)
      .maybeSingle()

    if (!defaultAccount) {
      // Fall back to any active account
      const { data: anyAccount } = await supabaseAdmin
        .from('email_accounts')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!anyAccount) {
        return NextResponse.json({ error: 'No connected email account' }, { status: 400 })
      }
      accountId = anyAccount.id
    } else {
      accountId = defaultAccount.id
    }
  }

  try {
    const result = await sendNewEmail(ctx.workspaceId, ctx.user.email, accountId, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
    })

    if (result.error) {
      return NextResponse.json(result, { status: 429 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 7: Create POST /api/inbox/sync and GET /api/inbox/counts**

```javascript
// app/api/inbox/sync/route.js
import { getAuthContext } from '../../../../lib/auth'
import { syncAllAccounts } from '../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await syncAllAccounts(ctx.workspaceId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

```javascript
// app/api/inbox/counts/route.js
import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wsId = ctx.workspaceId

  const [open, pending, resolved, unlinked, trash] = await Promise.all([
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'open'),
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'pending'),
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'resolved'),
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).is('shopify_customer_id', null).neq('status', 'closed'),
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'closed'),
  ])

  return NextResponse.json({
    open: open.count || 0,
    pending: pending.count || 0,
    resolved: resolved.count || 0,
    unlinked: unlinked.count || 0,
    trash: trash.count || 0,
  })
}
```

- [ ] **Step 8: Create GET /api/inbox/accounts and DELETE /api/inbox/accounts/[id]**

```javascript
// app/api/inbox/accounts/route.js
import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: accounts } = await supabaseAdmin
    .from('email_accounts')
    .select('id, provider, email_address, display_name, status, is_default, last_sync_at, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ accounts: accounts || [] })
}
```

```javascript
// app/api/inbox/accounts/[id]/route.js
import { getAuthContext } from '../../../../../lib/auth'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('email_accounts')
    .update({ status: 'disconnected' })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 9: Verify all routes exist**

```bash
find app/api/inbox -name "route.js" | sort
```

Expected:
```
app/api/inbox/accounts/[id]/route.js
app/api/inbox/accounts/route.js
app/api/inbox/compose/route.js
app/api/inbox/conversations/[id]/link-customer/route.js
app/api/inbox/conversations/[id]/notes/route.js
app/api/inbox/conversations/[id]/reply/route.js
app/api/inbox/conversations/[id]/route.js
app/api/inbox/conversations/route.js
app/api/inbox/counts/route.js
app/api/inbox/sync/route.js
```


---

## Task 8: Fix OAuth Connection Flows

**Files:**
- Modify: `app/api/auth/gmail/route.js`
- Modify: `app/api/auth/gmail/callback/route.js`
- Modify: `app/api/auth/outlook/route.js`
- Modify: `app/api/auth/outlook/callback/route.js`
- Modify: `app/api/auth/custom-email/connect/route.js`

The existing OAuth routes write to legacy `gmail_tokens`/`outlook_tokens` tables. Update them to write to the unified `email_accounts` table with `workspace_id`.

- [ ] **Step 1: Read current OAuth routes**

Read all five files listed above to understand current implementation.

- [ ] **Step 2: Update Gmail OAuth route**

Modify `app/api/auth/gmail/route.js`:
- Ensure it builds a proper Google OAuth URL with scopes `gmail.readonly gmail.send gmail.modify`
- State parameter should encode `userId`, `provider: 'gmail'`, AND `workspaceId` using `createOAuthState` from `lib/oauthState.js`
  - **Important:** The callback route has NO Bearer token (user is mid-redirect), so `workspace_id` must come from the OAuth state, not `getAuthContext`
- Get `workspaceId` from the user's query param `t` (token) — decode the JWT to get user_id, then look up workspace_members
- Redirect URL: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`

- [ ] **Step 3: Update Gmail callback to write to email_accounts**

Modify `app/api/auth/gmail/callback/route.js`:
- After exchanging code for tokens, get user info from Google to get the Gmail address
- **Get `workspace_id` from the verified OAuth state** (not from `getAuthContext` — callback routes have no Bearer token):
  ```javascript
  const verifiedState = verifyOAuthState(state, 'gmail')
  // verifiedState contains { userId, workspaceId }
  const workspaceId = verifiedState.workspaceId
  ```
- Upsert into `email_accounts` (not `gmail_tokens`):
  ```javascript
  // Check if this is the first account for the workspace
  const { count } = await supabaseAdmin
    .from('email_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  await supabaseAdmin.from('email_accounts').upsert({
    workspace_id: workspaceId,
    provider: 'gmail',
    email_address: gmailAddress,
    display_name: gmailName || gmailAddress,
    access_token: encrypt(tokens.access_token),
    refresh_token: encrypt(tokens.refresh_token),
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    status: 'active',
    is_default: count === 0, // First account becomes default
  }, { onConflict: 'workspace_id,provider,email_address' })
  ```
- Redirect to `/settings?provider=gmail&status=connected`

- [ ] **Step 4: Update Outlook OAuth route and callback**

Same pattern as Gmail:
- `app/api/auth/outlook/route.js`: Build Microsoft OAuth URL with scopes `Mail.ReadWrite Mail.Send offline_access`
- `app/api/auth/outlook/callback/route.js`: Exchange code, encrypt tokens, upsert into `email_accounts` with `provider: 'outlook'`
- Redirect to `/settings?provider=outlook&status=connected`

- [ ] **Step 5: Update custom email connect**

Modify `app/api/auth/custom-email/connect/route.js`:
- Test IMAP connection with provided credentials
- On success, encrypt password and store in `email_accounts`:
  ```javascript
  await supabaseAdmin.from('email_accounts').upsert({
    workspace_id: workspaceId,
    provider: 'custom',
    email_address: email,
    display_name: email,
    encrypted_password: encrypt(password),
    username: username || email,
    imap_host, imap_port,
    smtp_host, smtp_port,
    status: 'active',
    is_default: isFirstAccount,
  }, { onConflict: 'workspace_id,provider,email_address' })
  ```

- [ ] **Step 6: Test OAuth flows manually**

For Gmail:
1. Navigate to `/settings` → click "Connect Gmail"
2. Verify redirect to Google OAuth
3. After authorization, verify redirect to `/settings?provider=gmail&status=connected`
4. Verify `email_accounts` row created with encrypted tokens


---

## Task 9: Refactor Inbound Webhook

**Files:**
- Modify: `app/api/webhooks/email/inbound/route.js`
- Reference: `lib/conversationEngine.js` (processInboundMessage)

- [ ] **Step 1: Read current webhook implementation**

Read `app/api/webhooks/email/inbound/route.js` fully.

- [ ] **Step 2: Refactor to use conversation engine**

Update the webhook to:
1. Keep existing signature verification (Svix or x-webhook-secret)
2. Parse the Resend payload into a `NormalizedMessage`
3. Look up `email_accounts` by `forwarding_address`
4. Call `processInboundMessage(account, normalizedMessage)` from the conversation engine
5. Remove direct database inserts — the engine handles that now

```javascript
// Key change in the webhook handler:
import { processInboundMessage } from '../../../../lib/conversationEngine'

// After signature verification and payload parsing:
const { data: account } = await supabaseAdmin
  .from('email_accounts')
  .select('*')
  .eq('forwarding_address', toAddress)
  .eq('status', 'active')
  .maybeSingle()

if (!account) {
  return NextResponse.json({ error: 'No matching email account' }, { status: 404 })
}

const normalizedMessage = {
  providerMessageId: headers['message-id'] || `resend_${Date.now()}`,
  messageId: headers['message-id'] || '',
  from: { email: fromAddress, name: fromName },
  to: [{ email: toAddress, name: '' }],
  cc: [],
  subject: subject || '(no subject)',
  bodyHtml: html || '',
  bodyText: text || '',
  date: new Date().toISOString(),
  isOutbound: false,
}

await processInboundMessage(account, normalizedMessage)

return NextResponse.json({ ok: true })
```


---

## Task 10: Update Settings UI — Email Connection

**Files:**
- Modify: `app/settings/integrations/email/page.js`

Wire up the "Connect Gmail", "Connect Outlook", and "Connect Custom Email" buttons to actually trigger OAuth flows.

- [ ] **Step 1: Read current settings page**

Read `app/settings/integrations/email/page.js` fully.

- [ ] **Step 2: Update connection buttons**

Replace placeholder/coming-soon behavior with:

**Gmail button:**
```javascript
const connectGmail = () => {
  window.location.href = `/api/auth/gmail`
}
```

**Outlook button:**
```javascript
const connectOutlook = () => {
  window.location.href = `/api/auth/outlook`
}
```

**Custom email button** → opens a modal with fields:
- Email address, IMAP host, IMAP port, SMTP host, SMTP port, Username, Password
- Submit calls: `POST /api/auth/custom-email/connect`

- [ ] **Step 3: Add connected accounts list**

Fetch from `/api/inbox/accounts` on page load. Display each account:
- Provider icon (Gmail/Outlook/Custom)
- Email address
- Status badge (active/disconnected/error)
- "Disconnect" button → `DELETE /api/inbox/accounts/[id]`
- "Set as default" toggle

- [ ] **Step 4: Handle success redirect**

Check URL params on page load:
```javascript
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('status') === 'connected') {
    setSuccessMessage(`${params.get('provider')} connected successfully!`)
    // Clean URL
    window.history.replaceState({}, '', '/settings/integrations/email')
  }
}, [])
```

- [ ] **Step 5: Test manually**

1. Navigate to Settings → Email Integration
2. Click "Connect Gmail" → should redirect to Google OAuth
3. After OAuth, should return to settings with success message
4. Connected account should appear in the list
5. "Disconnect" should work


---

## Task 11: Refactor Inbox UI

**Files:**
- Modify: `app/inbox/page.js`

This is the largest task. The existing inbox page (~214KB) needs to be updated to:
1. Use `/api/inbox/*` routes instead of provider-specific routes
2. Add status-based folder navigation
3. Add internal notes section
4. Add Shopify customer panel
5. Remove demo mode

- [ ] **Step 1: Read current inbox page structure**

Read `app/inbox/page.js` to understand the current component structure, state management, and data flow. Identify:
- Main state variables
- Data fetching functions
- UI sections
- What uses demo data vs real data

- [ ] **Step 2: Replace data fetching layer**

Replace all provider-specific API calls with unified calls:

```javascript
// Replace individual provider fetches with:
const fetchConversations = async (status) => {
  const res = await fetch(`/api/inbox/conversations?status=${status}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  return data.conversations
}

const fetchConversation = async (id) => {
  const res = await fetch(`/api/inbox/conversations/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  return res.json() // { conversation, messages, notes }
}

const fetchCounts = async () => {
  const res = await fetch('/api/inbox/counts', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  return res.json() // { open, pending, resolved, unlinked, trash }
}

const triggerSync = async () => {
  await fetch('/api/inbox/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  // Refresh conversations after sync
  await fetchConversations(activeFolder)
}
```

- [ ] **Step 3: Add folder navigation state**

```javascript
const [activeFolder, setActiveFolder] = useState('open')
const [counts, setCounts] = useState({ open: 0, pending: 0, resolved: 0, unlinked: 0, trash: 0 })

// Fetch counts on load and after status changes
useEffect(() => {
  fetchCounts().then(setCounts)
}, [])

// Fetch conversations when folder changes
useEffect(() => {
  const params = activeFolder === 'unlinked'
    ? 'unlinked=true'
    : `status=${activeFolder === 'trash' ? 'closed' : activeFolder}`
  fetchConversations(params).then(setConversations)
}, [activeFolder])
```

- [ ] **Step 4: Update folder sidebar**

Replace current tab navigation with status-based folders:

```jsx
const folders = [
  { key: 'open', label: 'Open', count: counts.open },
  { key: 'pending', label: 'Pending', count: counts.pending },
  { key: 'resolved', label: 'Resolved', count: counts.resolved },
  { key: 'unlinked', label: 'Unlinked', count: counts.unlinked },
  { key: 'trash', label: 'Trash', count: counts.trash },
]

// Render in sidebar:
{folders.map(f => (
  <button
    key={f.key}
    onClick={() => setActiveFolder(f.key)}
    className={activeFolder === f.key ? 'active' : ''}
  >
    {f.label} {f.count > 0 && <span>({f.count})</span>}
  </button>
))}
```

- [ ] **Step 5: Add internal notes section to conversation view**

Below the message thread, add a collapsible notes section:

```jsx
const [notes, setNotes] = useState([])
const [newNote, setNewNote] = useState('')

const addNote = async () => {
  if (!newNote.trim()) return
  const res = await fetch(`/api/inbox/conversations/${selectedConversation.id}/notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: newNote }),
  })
  const data = await res.json()
  setNotes(prev => [...prev, data.note])
  setNewNote('')
}

// Render notes section with muted/yellow background
// Each note shows body + created_at timestamp
// Input field + "Add Note" button at bottom
```

- [ ] **Step 6: Update reply to use unified API**

```javascript
const sendReplyMessage = async () => {
  const res = await fetch(`/api/inbox/conversations/${selectedConversation.id}/reply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bodyHtml: editorContent,
      bodyText: editorPlainText,
    }),
  })
  const data = await res.json()
  if (data.error) {
    // Handle email limit reached
    showError(data.error)
    return
  }
  // Refresh conversation
  await fetchConversation(selectedConversation.id)
  // Update counts
  fetchCounts().then(setCounts)
}
```

- [ ] **Step 7: Create Shopify customer search route**

Create `app/api/inbox/shopify-customer/route.js`:
```javascript
// GET /api/inbox/shopify-customer?q=email@example.com
// or GET /api/inbox/shopify-customer?id=12345
import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const customerId = searchParams.get('id')

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('shopify_domain, shopify_api_key')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!client?.shopify_domain || !client?.shopify_api_key) {
    return NextResponse.json({ customers: [] })
  }

  let url
  if (customerId) {
    url = `https://${client.shopify_domain}/admin/api/2024-01/customers/${customerId}.json`
  } else if (query) {
    url = `https://${client.shopify_domain}/admin/api/2024-01/customers/search.json?query=${encodeURIComponent(query)}`
  } else {
    return NextResponse.json({ error: 'q or id parameter required' }, { status: 400 })
  }

  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': client.shopify_api_key },
  })
  if (!res.ok) return NextResponse.json({ customers: [] })
  const data = await res.json()

  const customers = customerId ? [data.customer] : (data.customers || [])
  return NextResponse.json({
    customers: customers.map(c => ({
      id: String(c.id),
      email: c.email,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      ordersCount: c.orders_count,
      totalSpent: c.total_spent,
    }))
  })
}
```

- [ ] **Step 8: Add Shopify customer info panel in inbox UI**

When viewing a conversation with `shopify_customer_id`:
- Fetch customer data from `/api/inbox/shopify-customer?id={shopifyCustomerId}`
- Display inline card showing: name, email, order count, total spent
- When `shopify_customer_id` is null, show a "Link Customer" button
- "Link Customer" opens a search input → calls `/api/inbox/shopify-customer?q={search}`
- Selecting a customer calls `POST /api/inbox/conversations/[id]/link-customer`

```jsx
// Inline in the conversation header — not a separate component file
const [customerData, setCustomerData] = useState(null)

useEffect(() => {
  if (conversation?.shopify_customer_id) {
    fetch(`/api/inbox/shopify-customer?id=${conversation.shopify_customer_id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => setCustomerData(d.customers?.[0]))
  }
}, [conversation?.shopify_customer_id])
```

- [ ] **Step 9: Remove demo mode**

Remove all demo/hardcoded thread data. Remove `is_demo` filtering. The inbox should show real data only — an empty state with "Connect your email to get started" when no accounts are connected.

- [ ] **Step 10: Add sync/refresh button**

Add a refresh button in the thread list header:
```jsx
<button onClick={triggerSync} disabled={syncing}>
  {syncing ? 'Syncing...' : 'Refresh'}
</button>
```

Trigger sync on page load as well.

- [ ] **Step 11: Test full flow manually**

1. Connect a Gmail account via Settings
2. Navigate to Inbox
3. Verify sync runs and threads appear
4. Click a thread → messages display
5. Send a reply → verify it sends and status changes to Pending
6. Add an internal note → verify it appears
7. Change status manually → verify it updates
8. Check folder counts update correctly


---

## Task 12: Delete Legacy Routes

**Files:**
- Delete: `app/api/gmail/threads/route.js`
- Delete: `app/api/gmail/thread/[id]/route.js`
- Delete: `app/api/gmail/send/route.js`
- Delete: `app/api/gmail/sent/route.js`
- Delete: `app/api/gmail/sent-threads/route.js`
- Delete: `app/api/gmail/trash/route.js`
- Delete: `app/api/outlook/threads/route.js`
- Delete: `app/api/outlook/thread/[id]/route.js`
- Delete: `app/api/outlook/send/route.js`
- Delete: `app/api/outlook/sent-threads/route.js`
- Delete: `app/api/custom-email/threads/route.js`
- Delete: `app/api/custom-email/thread/[id]/route.js`
- Delete: `app/api/custom-email/send/route.js`
- Delete: `app/api/custom-email/sent-threads/route.js`
- Delete: `app/api/custom-email/connect/route.js` (duplicate — keep only `/api/auth/custom-email/connect`)
- Delete: `app/api/email/conversations/route.js`
- Delete: `app/api/email/conversations/[id]/route.js`
- Delete: `app/api/email/conversations/[id]/reply/route.js`
- Delete: `app/api/email/connect/route.js`

Only delete AFTER verifying the unified API works end-to-end.

- [ ] **Step 1: Verify no remaining references to old routes**

Search the codebase for any references to the old API paths:
```bash
grep -r "/api/gmail/" app/ --include="*.js" --include="*.jsx" -l
grep -r "/api/outlook/" app/ --include="*.js" --include="*.jsx" -l
grep -r "/api/custom-email/" app/ --include="*.js" --include="*.jsx" -l
grep -r "/api/email/conversations" app/ --include="*.js" --include="*.jsx" -l
```

If any references found in UI code → update them to use `/api/inbox/*` first.

- [ ] **Step 2: Delete legacy route files**

```bash
rm -rf app/api/gmail/threads app/api/gmail/thread app/api/gmail/send app/api/gmail/sent app/api/gmail/sent-threads app/api/gmail/trash
rm -rf app/api/outlook/threads app/api/outlook/thread app/api/outlook/send app/api/outlook/sent-threads
rm -rf app/api/custom-email/threads app/api/custom-email/thread app/api/custom-email/send app/api/custom-email/sent-threads app/api/custom-email/connect
rm -rf app/api/email/conversations app/api/email/connect
```

- [ ] **Step 3: Verify app still builds**

```bash
npm run build
```

Fix any import errors if the build fails.


---

## Task 13: End-to-End Verification

- [ ] **Step 1: Verify build passes**

```bash
npm run build
```

- [ ] **Step 2: Run the dev server and test full flow**

```bash
npm run dev
```

Test checklist:
1. Settings → Connect Gmail → OAuth flow works → account appears
2. Settings → Connect Outlook → OAuth flow works → account appears
3. Settings → Connect Custom Email → modal works → account appears
4. Inbox → sync runs → threads load from connected accounts
5. Inbox → folder navigation (Open/Pending/Resolved/Unlinked/Trash) works
6. Inbox → click thread → messages display correctly
7. Inbox → send reply → message appears, status changes to Pending
8. Inbox → add internal note → note appears
9. Inbox → change status manually → updates correctly
10. Inbox → Shopify customer auto-linked (if customer exists)
11. Inbox → manual customer linking works
12. Inbound webhook → new email creates conversation in Open folder

