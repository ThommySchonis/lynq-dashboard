# Email Forwarding Integration (Gorgias-style)

## Summary

Add a forwarding-based email connection method as an alternative to the existing IMAP/SMTP approach. Users configure their email provider to forward incoming messages to a unique Lynq address, and add DNS records so Lynq (via Resend) can send replies on their behalf. No email credentials are needed.

This is the default and recommended connection method. IMAP/SMTP remains available as a secondary option.

## Motivation

The current IMAP/SMTP approach requires users to share their email password, relies on polling (not real-time), and is fragile (connections drop, auth fails with field name mismatches). Forwarding-based email is how Gorgias, Front, and other customer support tools handle custom email — it's simpler for the user, real-time, and more reliable.

## Existing Infrastructure

The codebase already has partial scaffolding for this feature:

- `email_accounts` table has `forwarding_address` column (nullable)
- `/api/webhooks/email/inbound` route already looks up accounts by `forwarding_address` and calls `processInboundMessage()`
- `processInboundMessage()` in `conversationEngine.ts` already handles creating/updating conversations from webhook data
- Resend is integrated for transactional emails (`lib/email.ts`) with `RESEND_API_KEY` env var
- A domain has already been connected to Resend
- `PROVIDERS` enum in `lib/providers/types.ts` — needs `FORWARDING: 'forwarding'` added

## Connection Flow (User Experience)

### Step 1: Choose connection method

On the custom email connection screen, user sees two options:
1. **Email Forwarding** (default, selected first) — no credentials needed
2. **IMAP/SMTP** — existing flow for manual credential entry

### Step 2: Enter email address

User enters their business email (e.g., `info@earthlysheets.com`). Lynq:
- Generates a unique forwarding address using a hash of `workspaceId + email_address`: `fwd_{first12CharsOfHash}@inbox.lynq.com` (e.g., `fwd_a8c3e9f12b47@inbox.lynq.com`). This ensures uniqueness even when a workspace connects multiple email addresses.
- Extracts the domain and registers it with Resend via `POST /domains`
- Creates an `email_accounts` row with `provider = 'forwarding'`, `status = 'pending'`, `client_id = user.id`
- Sets `is_default = true` if this is the first email account for the workspace (same pattern as existing custom-email connect)
- Uses `upsert` with `onConflict: 'workspace_id,provider,email_address'` — reconnecting the same email overwrites the previous pending/disconnected row

### Step 3: Set up email forwarding

UI displays the generated forwarding address with a copy button and provider-specific instructions:

> Forward all incoming emails from `info@earthlysheets.com` to `fwd_a8c3e9f12b47@inbox.lynq.com`

Collapsible instruction sections for common providers:
- Gmail (Settings > Forwarding and POP/IMAP)
- Outlook (Settings > Mail > Forwarding)
- Namecheap/Privateemail (Forwarding settings in control panel)
- Generic (add a mail forwarding rule)

### Step 4: Add DNS records

UI shows a table of DNS records to add to the user's domain:

| Type  | Name                    | Value                          | Status  |
|-------|-------------------------|--------------------------------|---------|
| TXT   | @                       | v=spf1 include:resend.com ~all | pending |
| CNAME | resend._domainkey       | (from Resend API)              | pending |
| TXT   | _dmarc                  | v=DMARC1; p=none               | pending |

Each row has a copy button. "Verify DNS" button triggers verification.

Note: DNS propagation can take minutes to hours. The `POST /domains/{id}/verify` call on Resend triggers an async check. If records are not yet propagated, Resend returns `pending`. The UI should show "DNS records not yet detected — this can take up to 48 hours. Click Verify again to re-check." with a re-check button.

### Step 5: Verification

Two independent checks:

- **Forwarding:** User clicks "Send test email". Lynq sends an email via Resend to `info@earthlysheets.com` with a unique verification token embedded in the email subject as `[lynq-verify:{token}]`. Using the subject (not a custom header) ensures the token survives email forwarding — most providers strip or rewrite custom headers, but always preserve the subject line. If forwarding is configured, the webhook receives it, the handler extracts and matches the token from the subject, and sets `forwarding_verified = true`. The verification email is not created as a conversation (handler returns early).
- **DNS:** User clicks "Verify DNS". Lynq calls `POST /domains/{domain_id}/verify` on Resend, then `GET /domains/{domain_id}` to get updated record statuses. Green checkmarks appear as each record is confirmed. Sets `domain_verified = true`.

Verification tokens expire after 24 hours. If expired, the user can re-send.

### Step 6: Active

Once both `forwarding_verified` and `domain_verified` are true, `status` changes to `active`. Emails flow in real-time via webhook; replies go out via Resend from the user's domain.

### Progress persistence

Verification state is stored in DB (`forwarding_verified`, `domain_verified`), so the user can leave and return — the wizard resumes at the current state.

## Architecture

### Inbound (receiving emails)

```
Customer sends email to info@earthlysheets.com
  -> Email provider forwards to fwd_a8c3e9f12b47@inbox.lynq.com
  -> Resend receives it, fires webhook to /api/webhooks/email/inbound
  -> Route looks up email_accounts by forwarding_address (existing logic)
  -> processInboundMessage() creates/updates conversation (existing logic)
  -> Message appears in inbox in real-time
```

One change to the existing inbound webhook: add verification token check (see "Changes to Existing Code" section).

### Outbound (sending replies)

```
Agent clicks Reply in Lynq inbox
  -> POST /api/inbox/conversations/[id]/reply
  -> conversationEngine.sendReply() gets the forwarding adapter
  -> Adapter calls Resend API:
       resend.emails.send({
         from: "info@earthlysheets.com",
         to: customer@example.com,
         subject: "Re: ...",
         html: "...",
         headers: { "In-Reply-To": "...", "References": "..." }
       })
  -> Saves outbound message to email_messages
```

### No sync needed

Forwarding accounts are entirely webhook-driven. `syncAllAccounts()` explicitly skips accounts with `provider = 'forwarding'` — the check is added in `syncAllAccounts()` before calling `syncAccount()`. This is cleaner than having the adapter return empty, because it avoids unnecessary adapter instantiation and the `last_sync_at` update.

## New Provider Adapter

### `lib/providers/forwarding.ts`

Minimal adapter — only sending capabilities:

- `refreshTokenIfNeeded(account)` — no-op, returns account unchanged
- `fetchThreads(account, filters)` — returns `{ threads: [], nextPageToken: null }` (inbound is webhook-only, should never be called due to sync skip, but safe fallback)
- `fetchThread(account, threadId)` — returns `{ messages: [] }` (messages already in DB from webhook)
- `sendReply(account, message)` — calls Resend API with `from: account.email_address`, includes `In-Reply-To` and `References` headers
- `sendNew(account, message)` — same Resend API call without reply headers

Registered in `lib/providers/index.ts` alongside `gmail`, `outlook`, `custom` using `PROVIDERS.FORWARDING` key.

## Database Changes

### Migration: add columns to `email_accounts`

```sql
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS forwarding_verified boolean DEFAULT false;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS resend_domain_id text;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS verification_token text;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS verification_token_expires_at timestamptz;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS sender_domain text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_forwarding_address
  ON email_accounts(forwarding_address) WHERE forwarding_address IS NOT NULL;
```

Column details:
- `domain_verified` — true when Resend confirms DNS records are correct
- `forwarding_verified` — true when test email arrives via forwarding
- `resend_domain_id` — Resend's domain ID for DNS verification API calls
- `verification_token` — unique token sent in test email to verify forwarding
- `verification_token_expires_at` — expiry timestamp for the verification token (24 hours from creation)
- `sender_domain` — extracted domain from `email_address` (e.g., `earthlysheets.com`), stored at connect time for efficient domain sharing lookups

Note: The unique constraint `idx_email_accounts_workspace_provider_email ON (workspace_id, provider, email_address)` already exists (migration `20260508000001`), so the upsert with `onConflict` works without additional migration steps. A unique constraint on `forwarding_address` is also added by this migration to prevent the astronomically unlikely SHA-256 hash collision from causing silent data corruption.

Existing columns reused:
- `forwarding_address` — the generated `fwd_...@inbox.lynq.com` address
- `email_address` — the user's real email
- `provider` — new value `'forwarding'`
- `status` — `'pending'` until both verifications pass, then `'active'`
- `client_id` — set to `user.id` at connect time
- `is_default` — set to true if first account in workspace

### New provider enum value

Add `FORWARDING: 'forwarding'` to `PROVIDERS` in `lib/providers/types.ts`.

## Validation Schemas

Add to `lib/schemas/auth.ts`:

```typescript
export const forwardingEmailConnectBody = z.object({
  email: z.string().email('Valid email is required'),
  store_id: z.string().optional(),
})

export const forwardingEmailVerifyBody = z.object({
  account_id: z.string().min(1, 'Account ID is required'),
})

export const forwardingEmailStatusQuery = z.object({
  account_id: z.string().min(1, 'Account ID is required'),
})
```

`forwardingEmailVerifyBody` is shared by `verify-dns`, `verify-forwarding`, and `disconnect` routes (all accept `{ account_id }`). The `status` GET route uses `validateQuery` with `forwardingEmailStatusQuery`.

## New API Routes

### `POST /api/auth/forwarding-email/connect`

Accepts: `{ email, store_id? }`
Schema: `forwardingEmailConnectBody`

1. Auth via `getAuthContext(request)`
2. Validates body via `validateBody(request, forwardingEmailConnectBody)`
3. Extracts domain from email (e.g., `earthlysheets.com`)
4. Checks for existing `resend_domain_id` by querying `email_accounts` where `sender_domain = extractedDomain` and `resend_domain_id IS NOT NULL` (limit 1). If found, reuses the domain ID. If not, registers domain with Resend API `POST /domains`.
5. Generates forwarding address: `fwd_{sha256(workspaceId + email).slice(0, 12)}@inbox.lynq.com`
6. Checks if this is the first email account for the workspace (for `is_default`)
7. Upserts `email_accounts` row with `onConflict: 'workspace_id,provider,email_address'`:
   - `client_id: user.id`
   - `workspace_id`
   - `provider: 'forwarding'`
   - `email_address: email`
   - `sender_domain: extractedDomain`
   - `forwarding_address: generatedAddress`
   - `resend_domain_id: domainId`
   - `status: 'pending'`
   - `is_default: isDefault`
   - `store_id: storeId || null`
8. Fetches DNS records from `GET /domains/{domain_id}` on Resend
9. Returns: `{ account_id, forwarding_address, dns_records: [...], domain_verified, forwarding_verified }`

### `POST /api/auth/forwarding-email/verify-dns`

Accepts: `{ account_id }`
Schema: `forwardingEmailVerifyBody`

1. Auth + workspace scoping (verify account belongs to workspace)
2. Looks up `resend_domain_id` from the account
3. Calls `POST https://api.resend.com/domains/{domain_id}/verify`
4. Calls `GET https://api.resend.com/domains/{domain_id}` to get updated record statuses
5. Updates `domain_verified` if all records pass
6. If both `domain_verified` and `forwarding_verified` are true, sets `status = 'active'`
7. Returns: `{ domain_verified, records: [...with statuses...] }`

### `POST /api/auth/forwarding-email/verify-forwarding`

Accepts: `{ account_id }`
Schema: `forwardingEmailVerifyBody`

1. Auth + workspace scoping
2. Generates a unique `verification_token` (crypto.randomUUID), stores it + `verification_token_expires_at` (now + 24 hours) in the account row
3. Sends an email via Resend to the user's `email_address` with subject containing `[lynq-verify:{token}]`
4. Returns: `{ sent: true }`

### `GET /api/auth/forwarding-email/status`

Accepts: `?account_id=...`

1. Auth + workspace scoping
2. Fetches account row
3. If `resend_domain_id` exists, fetches current DNS record statuses from Resend API
4. Returns: `{ account_id, forwarding_address, email, domain_verified, forwarding_verified, dns_records: [...], status }`

## Changes to Existing Code

### `lib/providers/types.ts`
- Add `FORWARDING: 'forwarding'` to `PROVIDERS` object

### `lib/providers/index.ts`
- Import `forwarding` adapter
- Register under `PROVIDERS.FORWARDING` key

### `lib/conversationEngine.ts`
- In `syncAllAccounts()`: filter out forwarding accounts before the sync loop. Add `account.provider !== 'forwarding'` check when iterating accounts, before calling `syncAccount()`. This avoids unnecessary adapter calls and `last_sync_at` updates.

### `/api/webhooks/email/inbound/route.ts`
- After looking up the account by `forwarding_address`, check if the inbound email subject contains `[lynq-verify:{token}]` pattern
- If found: extract token, compare to `account.verification_token`, check `verification_token_expires_at` hasn't passed
- If valid: set `forwarding_verified = true`, clear `verification_token`. If `domain_verified` is also true, set `status = 'active'`. Return early (don't create a conversation).
- If expired or mismatched: ignore the token, process as normal email

### Settings UI
- Custom email connection screen shows two tabs/options:
  1. **Email Forwarding** (default, first) — new multi-step wizard
  2. **IMAP/SMTP** — existing credential form
- New `ForwardingSetupWizard` component with steps for email input, forwarding instructions, DNS records, and verification status

## Disconnect Flow

### `DELETE /api/auth/forwarding-email/disconnect`

Accepts: `{ account_id }` (or as URL param)

1. Auth + workspace scoping
2. Looks up the account, verifies `provider = 'forwarding'`
3. Sets `status = 'disconnected'` on the `email_accounts` row (soft delete — preserves conversation history)
4. Checks if any other active `email_accounts` rows share the same `resend_domain_id`
5. If no other accounts use the domain: delete it from Resend via `DELETE /domains/{domain_id}`
6. Existing `email_conversations` and `email_messages` remain intact (they reference `email_account_id` for history)
7. Returns: `{ ok: true }`

## Domain Sharing

If two workspaces both use `@earthlysheets.com`:
- Before calling Resend to create a domain, query `email_accounts` where `sender_domain = 'earthlysheets.com' AND resend_domain_id IS NOT NULL` (limit 1)
- Reuse the same `resend_domain_id` (no duplicate domain registration)
- Each workspace gets its own unique forwarding address (different hash) and `email_accounts` row
- When disconnecting, only remove the domain from Resend if no other active accounts reference the same `resend_domain_id`

## Connected Account Display

Once active, the account card in settings shows:
- Email address (`info@earthlysheets.com`)
- Provider badge: "Forwarding"
- Status indicator (green = active)
- Disconnect button — soft-deletes the account, conditionally removes Resend domain

## Error Handling

- Domain registration fails (Resend API error): show error, allow retry
- DNS verification not yet propagated: show "DNS records not yet detected — this can take up to 48 hours. Click Verify to re-check."
- DNS verification fails: show which records are missing/incorrect, allow retry
- Forwarding verification not received: show "Test email not received yet" with re-send button
- Verification token expired: show "Token expired" with re-send button (generates new token)
- Webhook receives email for unknown forwarding address: return 200 OK silently (existing behavior)
- Resend sending fails: surface error in inbox UI, same as current SMTP failures
- Duplicate connect attempt: upsert overwrites previous pending row for same workspace+provider+email
