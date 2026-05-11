# Inbox System — Production-Ready Design (Single Store)

**Date:** 2026-05-08
**Goal:** Take the existing inbox from prototype to fully functional production system for a single Shopify store, with Gmail, Outlook, and custom IMAP/SMTP support.

## Scope

**In scope:**
- Working OAuth connection flows for Gmail, Outlook, and custom email
- Unified conversation engine (provider-agnostic)
- Email ↔ Shopify customer auto-linking + manual linking
- Status-based folder navigation (Open / Pending / Resolved / Unlinked / Trash)
- Automated status rules with manual override
- Internal notes on conversations
- Refactored inbox UI against unified API
- Migration from legacy token tables (`gmail_tokens`, `outlook_tokens`, `custom_email_tokens`) to unified `email_accounts`
- Migration from legacy API routes (`/api/email/*`, `/api/gmail/*`, `/api/outlook/*`, `/api/custom-email/*`) to unified `/api/inbox/*`

**Out of scope (future):**
- AI-powered reply suggestions (architected for, not built)
- Spam folder / classification
- Team collaboration / assignment
- Multi-store support
- Real-time background sync (on-demand sync is sufficient for now)

## Architecture

Four layers, top to bottom:

```
┌─────────────────────────────────────┐
│           Inbox UI (React)          │  ← Talks ONLY to unified API
├─────────────────────────────────────┤
│       Unified Inbox API             │  ← /api/inbox/* routes
│  (conversations, messages, notes)   │
├─────────────────────────────────────┤
│       Conversation Engine           │  ← Normalizes, links, manages status
│  (sync, Shopify linking, statuses)  │
├──────────┬──────────┬───────────────┤
│  Gmail   │ Outlook  │ Custom IMAP   │  ← Provider adapters (fetch/send)
│ Provider │ Provider │   Provider    │
└──────────┴──────────┴───────────────┘
         ↕               ↕
    OAuth APIs      IMAP/SMTP servers
```

**Key principle:** The UI never knows which provider a conversation came from. It always talks to `/api/inbox/*`. Each provider has an adapter with a common interface that the conversation engine calls.

### Data Flow — Incoming Email

Two paths for incoming email:

**Path 1: On-demand sync (pull)**
1. User triggers sync (page load or manual refresh button)
2. Conversation engine calls appropriate provider adapter for each connected account
3. Adapter returns normalized messages
4. Engine stores in `email_conversations` + `email_messages`
5. Engine auto-matches sender email to Shopify customers
6. Engine sets/updates conversation status based on automation rules
7. UI fetches from unified API

**Path 2: Resend inbound webhook (push)**
1. Email arrives at forwarding address → Resend receives it
2. Resend sends POST to `/api/webhooks/email/inbound`
3. Webhook verifies signature, looks up `email_accounts` by forwarding address
4. Webhook calls the conversation engine's `processInboundMessage()` (same normalization + status logic as sync path)
5. Message stored in `email_conversations` + `email_messages`

Both paths converge at the conversation engine — the webhook does NOT bypass the engine.

### Data Flow — Sending Email

1. UI calls `/api/inbox/conversations/[id]/reply`
2. Conversation engine determines which provider adapter to use (based on `email_accounts.provider`)
3. Adapter sends via Gmail API / Outlook API / SMTP (not via Resend — Resend is receive-only)
4. Engine stores sent message in `email_messages`
5. Engine enforces email usage limits via `lib/emailUsage.js` (`checkEmailLimit` / `incrementEmailCount`) before sending
6. Status auto-updates to "Pending"

**Note on Resend:** The existing codebase uses Resend for sending in some routes. This spec replaces that with direct provider sending. Resend remains only for inbound email receiving via webhooks. The `RESEND_API_KEY` env var is still needed for webhook verification but not for sending.

## Database Schema

All tables use `workspace_id` for scoping (the codebase has migrated from `client_id` to `workspace_id`). Every query is filtered by `workspace_id` — no cross-workspace data leakage.

### `email_accounts` (updated — single source of truth for all providers)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK, scoping key |
| provider | enum | gmail / outlook / custom |
| email_address | text | The actual email address |
| display_name | text | Shown in UI |
| access_token | text | Encrypted (AES-256-GCM). Gmail/Outlook OAuth token |
| refresh_token | text | Encrypted. Gmail/Outlook refresh token |
| encrypted_password | text | Encrypted. Custom provider only (IMAP/SMTP password) |
| username | text | Custom provider only (IMAP/SMTP username, often same as email) |
| expires_at | timestamp | OAuth token expiry. Null for custom |
| imap_host | text | Custom provider only |
| imap_port | int | Custom provider only |
| smtp_host | text | Custom provider only |
| smtp_port | int | Custom provider only |
| forwarding_address | text | Resend forwarding address for inbound webhook |
| is_default | boolean | Which account to send from |
| last_sync_at | timestamp | Last successful sync |
| status | enum | active / disconnected / error |
| created_at | timestamp | |

### `email_conversations` (updated)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK, scoping key |
| email_account_id | UUID | FK to email_accounts |
| subject | text | |
| snippet | text | Preview text |
| customer_email | text | |
| customer_name | text | |
| status | enum | open / pending / resolved / closed |
| provider_thread_id | text | Gmail thread ID, Outlook conversation ID, or IMAP-generated |
| shopify_customer_id | text | Nullable, filled by auto-match or manual link |
| last_message_at | timestamp | |
| created_at | timestamp | |
| message_count | int | |
| is_unread | boolean | |

### `email_messages` (updated)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| conversation_id | UUID | FK to email_conversations |
| workspace_id | UUID | FK, for RLS policies |
| provider_message_id | text | Unique, for dedup during sync |
| message_id | text | RFC 2822 Message-ID header, for threading |
| from_email | text | |
| from_name | text | |
| to_email | text | |
| to_name | text | |
| cc | jsonb | Array of {email, name} |
| bcc | jsonb | Array of {email, name} |
| subject | text | |
| body_html | text | |
| body_text | text | |
| is_outbound | boolean | true = sent by user, false = received |
| created_at | timestamp | |

### `conversation_notes` (new)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| conversation_id | UUID | FK to email_conversations |
| workspace_id | UUID | FK, for RLS policies |
| body | text | Plain text or simple markdown |
| created_at | timestamp | |

**Future extensibility:** When AI replies are added, a `source` column (human / ai) gets added to `email_messages`. Notes remain separate — they are never sent externally.

### Migration from Legacy Tables

The existing `gmail_tokens`, `outlook_tokens`, and `custom_email_tokens` tables are migrated into the unified `email_accounts` table:

1. For each row in `gmail_tokens`: create `email_accounts` row with `provider = 'gmail'`, copy encrypted tokens
2. For each row in `outlook_tokens`: create `email_accounts` row with `provider = 'outlook'`, copy encrypted tokens
3. For each row in `custom_email_tokens`: create `email_accounts` row with `provider = 'custom'`, copy `encrypted_password`, `username`, IMAP/SMTP fields
4. After migration verified: legacy tables remain but are no longer read from (can be dropped in a future cleanup)

### Key Indexes

- `email_conversations`: (`workspace_id`, `status`), (`workspace_id`, `last_message_at`), (`customer_email`)
- `email_messages`: (`conversation_id`, `created_at`), (`provider_message_id` unique)
- `conversation_notes`: (`conversation_id`, `created_at`)

## Provider Adapters

Each adapter implements a common interface:

```
ProviderAdapter {
  fetchThreads(account, options) → { threads[], nextPageToken }
  fetchThread(account, threadId) → { messages[] }
  sendReply(account, conversationId, { to, cc, bcc, subject, bodyHtml }) → messageId
  sendNew(account, { to, cc, bcc, subject, bodyHtml }) → { threadId, messageId }
  refreshTokenIfNeeded(account) → updatedAccount
}
```

All adapters return normalized messages:

```
NormalizedMessage {
  providerMessageId: string
  messageId: string          // RFC 2822 Message-ID
  from: { email, name }
  to: [{ email, name }]
  cc: [{ email, name }]
  subject: string
  bodyHtml: string
  bodyText: string
  date: ISO timestamp
  isOutbound: boolean
}
```

### Gmail Adapter
- Uses Gmail API REST endpoints
- `fetchThreads` → `GET /gmail/v1/users/me/threads` with pagination
- `fetchThread` → `GET /gmail/v1/users/me/threads/{id}` with full message format
- `sendReply` / `sendNew` → `POST /gmail/v1/users/me/messages/send` (RFC 2822 with In-Reply-To / References headers)
- Token refresh via Google OAuth2 refresh token flow
- `isOutbound` determined by comparing `from` address to `account.email_address`

### Outlook Adapter
- Uses Microsoft Graph API
- `fetchThreads` → `GET /me/mailFolders/inbox/messages` grouped by `conversationId`
- `fetchThread` → `GET /me/messages?$filter=conversationId eq '{id}'`
- `sendReply` / `sendNew` → `POST /me/sendMail`
- Token refresh via MSAL refresh token flow

### Custom Email Adapter
- Uses `imapflow` for reading, `nodemailer` for sending
- `fetchThreads` → IMAP FETCH from INBOX only, limited to last 30 days or 200 messages (whichever is smaller). Threads grouped by `In-Reply-To` / `References` headers client-side. For messages without threading headers, each is its own thread.
- `fetchThread` → IMAP FETCH specific messages by UID (UIDs tracked in `provider_message_id`)
- `sendReply` / `sendNew` → SMTP via nodemailer with proper threading headers
- No token refresh — uses stored encrypted password
- IMAP connections opened per-request, not persistent (avoids idle connection management)

## Conversation Engine

Central logic layer at `lib/conversationEngine.js`.

### Sync Logic

1. For each connected `email_account`: call adapter's `fetchThreads` (since `last_sync_at`)
2. For each returned thread: check if `provider_thread_id` exists in `email_conversations`
   - **Exists** → fetch new messages only (dedup by `provider_message_id`), append to `email_messages`, update `last_message_at`, `snippet`, `message_count`
   - **New** → create `email_conversation`, store all messages, run Shopify auto-match
3. Update `email_account.last_sync_at`

Sync is on-demand (page load + manual refresh).

### Inbound Webhook Integration

The existing `/api/webhooks/email/inbound` route is refactored to call the conversation engine:

1. Webhook receives POST from Resend, verifies signature
2. Looks up `email_accounts` by `forwarding_address`
3. Normalizes the inbound email into a `NormalizedMessage`
4. Calls `conversationEngine.processInboundMessage(account, normalizedMessage)`
5. Engine handles conversation matching (by `message_id` threading), status updates, and Shopify linking — same logic as sync path

### Status Automation

| Event | Status Change |
|-------|--------------|
| New inbound email, no existing conversation | → Open |
| New inbound email on Resolved/Closed conversation | → Open (reopen) |
| New inbound email on Pending conversation | → Open |
| User sends reply | → Pending |
| User manually changes status | → Whatever they choose (override) |

Manual changes always win over automation.

### Email Usage Limits

Before sending any email, the conversation engine calls `checkEmailLimit(userEmail)` from `lib/emailUsage.js`. If the limit is exceeded, the send is rejected with a clear error. After successful send, `incrementEmailCount(userEmail)` is called. This preserves existing rate limiting per subscription plan.

### Shopify Customer Linking

**Auto-match (on new conversation):**
1. Extract sender's email
2. Query Shopify: `GET /admin/api/2024-01/customers/search.json?query=email:{email}`
3. Match found → store `shopify_customer_id`
4. No match → leave null (shows in "Unlinked" folder)

**Manual link:** `/api/inbox/conversations/[id]/link-customer` accepts a `shopify_customer_id`.

### Folder Logic (query filters, not stored)

| Folder | Query |
|--------|-------|
| Open | `status = 'open'` |
| Pending | `status = 'pending'` |
| Resolved | `status = 'resolved'` |
| Unlinked | `shopify_customer_id IS NULL AND status != 'closed'` |
| Trash | `status = 'closed'` |

"Unlinked" contains emails from people not matched to a Shopify customer. It is not "All" — it specifically shows unlinked conversations.

Counts are `COUNT(*)` queries grouped by these filters.

## Unified Inbox API

### Conversations

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/inbox/conversations` | GET | List with filters (status, unlinked, search) + pagination |
| `/api/inbox/conversations/[id]` | GET | Full conversation with messages and notes |
| `/api/inbox/conversations/[id]` | PATCH | Update status, mark read/unread |
| `/api/inbox/conversations/[id]/reply` | POST | Send reply via correct provider |
| `/api/inbox/conversations/[id]/notes` | GET | List internal notes |
| `/api/inbox/conversations/[id]/notes` | POST | Add internal note |
| `/api/inbox/conversations/[id]/link-customer` | POST | Manually link Shopify customer |

### Compose & Sync

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/inbox/compose` | POST | Send new email |
| `/api/inbox/sync` | POST | Trigger sync for all connected accounts |
| `/api/inbox/counts` | GET | Folder counts |

### Email Accounts

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/inbox/accounts` | GET | List connected accounts |
| `/api/inbox/accounts/[id]` | DELETE | Disconnect account |

### Auth

Every route: extract Supabase session from `Authorization: Bearer` header, get `workspace_id`, scope all queries to that `workspace_id`.

### Legacy Route Migration

The following existing routes are replaced by the unified API and should be deleted after migration:

| Old Route | Replaced By |
|-----------|-------------|
| `/api/email/conversations` | `/api/inbox/conversations` |
| `/api/email/conversations/[id]` | `/api/inbox/conversations/[id]` |
| `/api/email/conversations/[id]/reply` | `/api/inbox/conversations/[id]/reply` |
| `/api/email/connect` | OAuth flows (unchanged paths) |
| `/api/gmail/threads` | `/api/inbox/sync` + `/api/inbox/conversations` |
| `/api/gmail/thread/[id]` | `/api/inbox/conversations/[id]` |
| `/api/gmail/send` | `/api/inbox/conversations/[id]/reply` |
| `/api/outlook/threads` | `/api/inbox/sync` + `/api/inbox/conversations` |
| `/api/outlook/thread/[id]` | `/api/inbox/conversations/[id]` |
| `/api/outlook/send` | `/api/inbox/conversations/[id]/reply` |
| `/api/custom-email/threads` | `/api/inbox/sync` + `/api/inbox/conversations` |
| `/api/custom-email/thread/[id]` | `/api/inbox/conversations/[id]` |
| `/api/custom-email/send` | `/api/inbox/conversations/[id]/reply` |

Provider-specific routes are deleted once the unified API is verified. The old routes are not aliased — clean cutover.

The duplicate custom email connect routes (`/api/custom-email/connect` and `/api/auth/custom-email/connect`) are consolidated to `/api/auth/custom-email/connect` (consistent with other auth routes). The other is deleted.

## OAuth Connection Flows

### Gmail
1. User clicks "Connect Gmail" in Settings
2. Frontend redirects to `/api/auth/gmail`
3. Route builds Google OAuth URL with scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`
4. User authorizes → Google redirects to `/api/auth/gmail/callback`
5. Callback exchanges code for tokens, encrypts (AES-256-GCM), stores in `email_accounts` with `provider = 'gmail'`
6. Redirects to `/settings?provider=gmail&status=connected`

### Outlook
1. User clicks "Connect Outlook" in Settings
2. Frontend redirects to `/api/auth/outlook`
3. Route builds Microsoft OAuth URL with scopes: `Mail.ReadWrite`, `Mail.Send`, `offline_access`
4. User authorizes → Microsoft redirects to `/api/auth/outlook/callback`
5. Callback exchanges code for tokens, encrypts and stores in `email_accounts` with `provider = 'outlook'`
6. Redirects to `/settings?provider=outlook&status=connected`

### Custom Email
1. User clicks "Connect Custom Email" in Settings
2. Modal asks for: email address, IMAP host/port, SMTP host/port, username, password
3. Frontend calls `/api/auth/custom-email/connect` which tests the IMAP connection
4. Success → encrypts password, stores in `email_accounts` with `provider = 'custom'`
5. Modal closes with success message

### Shared
- All flows write to the same `email_accounts` table
- All credentials encrypted with `EMAIL_ENCRYPTION_KEY` via `lib/encryption.js`
- After connecting, initial sync is triggered to pull existing threads
- Settings page shows connected accounts with status and a "Disconnect" option
- All OAuth redirects go to `/settings?provider={name}&status=connected` (not onboarding)

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Gmail OAuth |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth |
| `MICROSOFT_CLIENT_ID` | Outlook OAuth |
| `MICROSOFT_CLIENT_SECRET` | Outlook OAuth |
| `EMAIL_ENCRYPTION_KEY` | Token encryption (existing) |
| `NEXT_PUBLIC_APP_URL` | OAuth callback URLs |
| `RESEND_API_KEY` | Inbound webhook verification (existing) |

## Inbox UI

### Layout

```
┌──────────┬─────────────────┬──────────────────────┐
│ Sidebar  │  Thread List     │  Conversation View   │
│          │                  │                      │
│ Open (3) │  [thread 1]      │  Message bubbles     │
│ Pending  │  [thread 2]      │  (inbound/outbound)  │
│ Resolved │  [thread 3]      │                      │
│ ──────── │  [thread 4]      │  ── Notes section ── │
│ Unlnkd 5 │                  │  [internal note 1]   │
│ Trash    │                  │  [add note input]    │
│          │                  │                      │
│          │                  │  ── Reply box ──     │
│          │                  │  [rich text editor]  │
│          │                  │  [Send] [Status v]   │
└──────────┴─────────────────┴──────────────────────┘
```

### Key Behaviors
- **Folder sidebar:** Status folders with unread counts. "Unlinked" shows count of conversations not matched to a Shopify customer. Active folder highlighted.
- **Thread list:** Conversations for selected folder. Shows customer name/email, subject snippet, timestamp, unread indicator. Sorted by `last_message_at` desc. Paginated on scroll.
- **Conversation view:** Messages as bubbles — inbound left, outbound right. Sender, timestamp, HTML body rendered safely.
- **Internal notes:** Collapsible section below messages. Visually distinct (muted background). Simple text input to add.
- **Reply box:** Rich text editor with existing toolbar (B, I, U, link, list). Macro support preserved. Status dropdown next to Send. Email usage limit shown if near cap.
- **Shopify customer panel:** Linked customer shows info card (name, email, orders, total spent). Unlinked shows "Link customer" button with search modal.
- **Connect email:** Settings buttons trigger real OAuth flows instead of "coming soon".

### What Stays
- Rich text editor and toolbar
- Macro system
- Light/dark theme support
- Design tokens and general styling

### What Changes
- Data source: provider-specific routes → `/api/inbox/*`
- Navigation: status-based folders replace current tabs
- Notes section added
- Shopify customer card added
- Demo mode removed (real data only)
