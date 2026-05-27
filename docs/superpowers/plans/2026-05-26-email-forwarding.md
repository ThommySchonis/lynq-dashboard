# Email Forwarding Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gorgias-style email forwarding as the default custom email connection method — users configure forwarding + DNS records, no credentials needed.

**Architecture:** New `forwarding` provider adapter (send-only via Resend API). Inbound is webhook-driven (existing `/api/webhooks/email/inbound`). Four new API routes for connect, verify-dns, verify-forwarding, and status. Multi-step setup wizard in the settings UI.

**Tech Stack:** Next.js 16 API routes, Resend API (domains + sending), Supabase (email_accounts table), Zod validation, TanStack Query, Zustand

**Spec:** `docs/superpowers/specs/2026-05-26-email-forwarding-design.md`

---

## File Structure

### New files
- `supabase/migrations/YYYYMMDDHHMMSS_email_forwarding_columns.sql` — DB migration
- `lib/providers/forwarding.ts` — Forwarding provider adapter (Resend send-only)
- `lib/services/resend-domains.ts` — Resend domain API helpers (register, verify, get records, delete)
- `lib/schemas/forwarding.ts` — Zod schemas for forwarding routes
- `app/api/auth/forwarding-email/connect/route.ts` — Connect endpoint
- `app/api/auth/forwarding-email/verify-dns/route.ts` — DNS verification endpoint
- `app/api/auth/forwarding-email/verify-forwarding/route.ts` — Forwarding verification endpoint
- `app/api/auth/forwarding-email/status/route.ts` — Status endpoint
- `app/api/auth/forwarding-email/disconnect/route.ts` — Disconnect endpoint
- `hooks/settings/use-forwarding-mutations.ts` — TanStack Query mutations for forwarding
- `components/features/settings/integrations/forwarding/forwarding-setup-wizard.tsx` — Wizard shell (dialog + step routing)
- `components/features/settings/integrations/forwarding/forwarding-email-step.tsx` — Step 1: email input
- `components/features/settings/integrations/forwarding/forwarding-setup-step.tsx` — Step 2: forwarding + DNS verification
- `components/features/settings/integrations/forwarding/forwarding-active-step.tsx` — Step 3: success confirmation
- `components/features/settings/integrations/forwarding/dns-record-table.tsx` — DNS records table with copy buttons
- `components/features/settings/integrations/forwarding/provider-instructions.tsx` — Collapsible provider-specific forwarding instructions
- `components/features/settings/integrations/forwarding/copy-button.tsx` — Reusable copy-to-clipboard button
- `types/forwarding.ts` — TypeScript types for forwarding API responses

### Modified files
- `lib/providers/types.ts` — Add `FORWARDING` to `PROVIDERS` enum
- `lib/providers/index.ts` — Register forwarding adapter
- `lib/conversationEngine.ts` — Skip forwarding accounts in sync
- `app/api/webhooks/email/inbound/route.ts` — Add verification token check
- `types/settings.ts` — Add `'forwarding'` to `EmailProvider` type
- `components/features/settings/integrations/email-settings.tsx` — Replace Custom button with Forwarding + IMAP options
- `components/features/settings/integrations/email-account-row.tsx` — Add forwarding provider label/icon

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_email_forwarding_columns.sql`

> @migration-rules — invoke before creating migration

- [ ] **Step 1: Generate migration file**

Run: `cd lynq-dashboard && npx supabase migration new email_forwarding_columns`

- [ ] **Step 2: Write migration SQL**

```sql
-- Add columns for email forwarding feature (Gorgias-style)
-- Supports forwarding-based email connection as alternative to IMAP/SMTP

ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS forwarding_verified boolean DEFAULT false;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS resend_domain_id text;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS verification_token text;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS verification_token_expires_at timestamptz;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS sender_domain text;

-- Unique index on forwarding_address to prevent hash collisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_forwarding_address
  ON email_accounts(forwarding_address) WHERE forwarding_address IS NOT NULL;
```

- [ ] **Step 3: Apply migration**

Run: `npx supabase db push`
Expected: Migration applied successfully, no errors.

---

## Task 2: Provider Types & Registration

**Files:**
- Modify: `lib/providers/types.ts:38-42`
- Modify: `lib/providers/index.ts:1-41`
- Create: `lib/providers/forwarding.ts`

- [ ] **Step 1: Add FORWARDING to PROVIDERS enum**

In `lib/providers/types.ts`, change:
```typescript
export const PROVIDERS = {
  GMAIL: 'gmail',
  OUTLOOK: 'outlook',
  CUSTOM: 'custom',
}
```
To:
```typescript
export const PROVIDERS = {
  GMAIL: 'gmail',
  OUTLOOK: 'outlook',
  CUSTOM: 'custom',
  FORWARDING: 'forwarding',
}
```

- [ ] **Step 2: Create forwarding provider adapter**

Create `lib/providers/forwarding.ts`:

```typescript
import type { ProviderAccount } from './index'

interface EmailAddress {
  email: string
  name?: string
}

async function getResend() {
  const { Resend } = await import('resend')
  return new Resend(process.env.RESEND_API_KEY)
}

export async function refreshTokenIfNeeded(account: ProviderAccount) {
  return account
}

export async function fetchThreads() {
  return { threads: [], nextPageToken: null }
}

export async function fetchThread() {
  return { messages: [] }
}

export async function sendReply(
  account: ProviderAccount,
  { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }: {
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    subject: string
    bodyHtml: string
    bodyText: string
    inReplyTo: string | null
    references: string | null
  }
) {
  const resend = await getResend()
  const fromEmail = account.email_address || account.email || ''
  const formatAddr = (a: EmailAddress) => (a.name ? `${a.name} <${a.email}>` : a.email)

  const headers: Record<string, string> = {}
  if (inReplyTo) headers['In-Reply-To'] = inReplyTo
  if (references) headers['References'] = references

  const result = await resend.emails.send({
    from: account.display_name
      ? `${account.display_name} <${fromEmail}>`
      : fromEmail,
    to: to.map(formatAddr),
    cc: cc?.length ? cc.map(formatAddr) : undefined,
    bcc: bcc?.length ? bcc.map(formatAddr) : undefined,
    subject,
    html: bodyHtml || undefined,
    text: bodyText || undefined,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })

  const messageId = result.data?.id
    ? `<${result.data.id}@resend.dev>`
    : `<resend_${Date.now()}@resend.dev>`

  return {
    providerMessageId: messageId.replace(/[<>]/g, ''),
    messageId,
  }
}

export async function sendNew(
  account: ProviderAccount,
  message: {
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    subject: string
    bodyHtml: string
    bodyText: string
  }
) {
  return sendReply(account, { ...message, inReplyTo: null, references: null })
}
```

- [ ] **Step 3: Register adapter in index.ts**

In `lib/providers/index.ts`, add import and registration:

```typescript
import * as forwardingAdapter from './forwarding'
```

Add to the `adapters` record:
```typescript
[PROVIDERS.FORWARDING]: forwardingAdapter as unknown as ProviderAdapter,
```

- [ ] **Step 4: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 3: Resend Domain Service

**Files:**
- Create: `lib/services/resend-domains.ts`

- [ ] **Step 1: Create Resend domain helpers**

Create `lib/services/resend-domains.ts`:

```typescript
import type { DnsRecord } from '@/types/forwarding'

interface ResendDomain {
  id: string
  name: string
  status: string
  records: DnsRecord[]
}

async function getResend() {
  const { Resend } = await import('resend')
  return new Resend(process.env.RESEND_API_KEY)
}

export async function registerDomain(domainName: string): Promise<ResendDomain> {
  const resend = await getResend()
  const { data, error } = await resend.domains.create({ name: domainName })
  if (error) throw new Error(`Failed to register domain: ${error.message}`)
  return data as unknown as ResendDomain
}

export async function getDomain(domainId: string): Promise<ResendDomain> {
  const resend = await getResend()
  const { data, error } = await resend.domains.get(domainId)
  if (error) throw new Error(`Failed to get domain: ${error.message}`)
  return data as unknown as ResendDomain
}

export async function verifyDomain(domainId: string): Promise<void> {
  const resend = await getResend()
  const { error } = await resend.domains.verify(domainId)
  if (error) throw new Error(`Failed to verify domain: ${error.message}`)
}

export async function deleteDomain(domainId: string): Promise<void> {
  const resend = await getResend()
  const { error } = await resend.domains.remove(domainId)
  if (error) throw new Error(`Failed to delete domain: ${error.message}`)
}

export function isDomainVerified(domain: ResendDomain): boolean {
  return domain.status === 'verified'
}

export function getDnsRecords(domain: ResendDomain): DnsRecord[] {
  return domain.records || []
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 4: Validation Schemas

**Files:**
- Create: `lib/schemas/forwarding.ts`

- [ ] **Step 1: Create Zod schemas**

Create `lib/schemas/forwarding.ts`:

```typescript
import { z } from 'zod'

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

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 5: Connect API Route

**Files:**
- Create: `app/api/auth/forwarding-email/connect/route.ts`

> @api-route-rules — invoke before creating API route

- [ ] **Step 1: Create the connect route**

Create `app/api/auth/forwarding-email/connect/route.ts`:

```typescript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { forwardingEmailConnectBody } from '@/lib/schemas/forwarding'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registerDomain, getDomain } from '@/lib/services/resend-domains'

const FORWARDING_DOMAIN = process.env.FORWARDING_EMAIL_DOMAIN || 'inbox.lynq.com'

function generateForwardingAddress(workspaceId: string, email: string): string {
  const hash = crypto.createHash('sha256').update(workspaceId + email).digest('hex')
  return `fwd_${hash.slice(0, 12)}@${FORWARDING_DOMAIN}`
}

function extractDomain(email: string): string {
  return email.split('@')[1].toLowerCase()
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bErr] = await validateBody(request, forwardingEmailConnectBody)
  if (bErr) return bErr

  const { email, store_id: storeId } = body
  const { user, workspaceId } = ctx

  const senderDomain = extractDomain(email)
  const forwardingAddress = generateForwardingAddress(workspaceId, email)

  try {
    // Check for existing Resend domain registration
    const { data: existingDomain } = await supabaseAdmin
      .from('email_accounts')
      .select('resend_domain_id')
      .eq('sender_domain', senderDomain)
      .not('resend_domain_id', 'is', null)
      .limit(1)
      .maybeSingle()

    let resendDomainId: string
    if (existingDomain?.resend_domain_id) {
      resendDomainId = existingDomain.resend_domain_id as string
    } else {
      const domain = await registerDomain(senderDomain)
      resendDomainId = domain.id
    }

    // Check if first account for is_default
    const { count } = await supabaseAdmin
      .from('email_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    const isDefault = count === 0

    // Upsert email account
    const { data: account, error: upsertError } = await supabaseAdmin
      .from('email_accounts')
      .upsert({
        client_id: user.id,
        workspace_id: workspaceId,
        provider: 'forwarding',
        email_address: email,
        sender_domain: senderDomain,
        forwarding_address: forwardingAddress,
        resend_domain_id: resendDomainId,
        status: 'pending',
        is_default: isDefault,
        store_id: storeId || null,
        domain_verified: false,
        forwarding_verified: false,
      }, { onConflict: 'workspace_id,provider,email_address' })
      .select('id, domain_verified, forwarding_verified')
      .single()

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Fetch DNS records from Resend
    const domainInfo = await getDomain(resendDomainId)

    return NextResponse.json({
      account_id: account.id,
      forwarding_address: forwardingAddress,
      dns_records: domainInfo.records || [],
      domain_verified: domainInfo.status === 'verified',
      forwarding_verified: false,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to connect forwarding email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 6: Verify DNS Route

**Files:**
- Create: `app/api/auth/forwarding-email/verify-dns/route.ts`

> @api-route-rules — invoke before creating API route

- [ ] **Step 1: Create the verify-dns route**

Create `app/api/auth/forwarding-email/verify-dns/route.ts`:

```typescript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { forwardingEmailVerifyBody } from '@/lib/schemas/forwarding'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyDomain, getDomain, isDomainVerified, getDnsRecords } from '@/lib/services/resend-domains'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bErr] = await validateBody(request, forwardingEmailVerifyBody)
  if (bErr) return bErr

  const { account_id } = body

  // Fetch account with workspace scoping
  const { data: account, error: fetchError } = await supabaseAdmin
    .from('email_accounts')
    .select('id, resend_domain_id, forwarding_verified, provider')
    .eq('id', account_id)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (!account.resend_domain_id) {
    return NextResponse.json({ error: 'No domain registered for this account' }, { status: 400 })
  }

  try {
    // Trigger verification check on Resend
    await verifyDomain(account.resend_domain_id as string)

    // Fetch updated domain status
    const domainInfo = await getDomain(account.resend_domain_id as string)
    const domainVerified = isDomainVerified(domainInfo)

    // Update account
    const updates: Record<string, unknown> = { domain_verified: domainVerified }
    if (domainVerified && account.forwarding_verified) {
      updates.status = 'active'
    }

    await supabaseAdmin
      .from('email_accounts')
      .update(updates)
      .eq('id', account_id)

    return NextResponse.json({
      domain_verified: domainVerified,
      records: getDnsRecords(domainInfo),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'DNS verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 7: Verify Forwarding Route

**Files:**
- Create: `app/api/auth/forwarding-email/verify-forwarding/route.ts`

> @api-route-rules — invoke before creating API route

- [ ] **Step 1: Create the verify-forwarding route**

Create `app/api/auth/forwarding-email/verify-forwarding/route.ts`:

```typescript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { forwardingEmailVerifyBody } from '@/lib/schemas/forwarding'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bErr] = await validateBody(request, forwardingEmailVerifyBody)
  if (bErr) return bErr

  const { account_id } = body

  const { data: account, error: fetchError } = await supabaseAdmin
    .from('email_accounts')
    .select('id, email_address, provider')
    .eq('id', account_id)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Generate verification token with 24h expiry
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('email_accounts')
    .update({
      verification_token: token,
      verification_token_expires_at: expiresAt,
    })
    .eq('id', account_id)

  // Send verification email via Resend
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: process.env.FORWARDING_VERIFY_FROM || 'Lynq & Flow <verify@resend.dev>',
      to: account.email_address as string,
      subject: `Verify your email forwarding [lynq-verify:${token}]`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Email Forwarding Verification</h2>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
            This is a test email to verify that forwarding is set up correctly for
            <strong style="color:#1C0F36;">${account.email_address as string}</strong>.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0;">
            If you see this email in your Lynq inbox, forwarding is working. If not, please check your email forwarding settings.
          </p>
          <p style="font-size:12px;color:#9B91A8;margin:24px 0 0;">
            This verification link expires in 24 hours.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ sent: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send verification email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 8: Status Route

**Files:**
- Create: `app/api/auth/forwarding-email/status/route.ts`

> @api-route-rules — invoke before creating API route

- [ ] **Step 1: Create the status route**

Create `app/api/auth/forwarding-email/status/route.ts`:

```typescript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { validateQuery } from '@/lib/validation'
import { forwardingEmailStatusQuery } from '@/lib/schemas/forwarding'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getDomain, getDnsRecords } from '@/lib/services/resend-domains'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, forwardingEmailStatusQuery)
  if (qErr) return qErr

  const { account_id } = query

  const { data: account, error: fetchError } = await supabaseAdmin
    .from('email_accounts')
    .select('id, email_address, forwarding_address, domain_verified, forwarding_verified, resend_domain_id, status, provider')
    .eq('id', account_id)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  let dnsRecords: unknown[] = []
  if (account.resend_domain_id) {
    try {
      const domainInfo = await getDomain(account.resend_domain_id as string)
      dnsRecords = getDnsRecords(domainInfo)
    } catch {
      // If Resend API fails, return what we have from DB
    }
  }

  return NextResponse.json({
    account_id: account.id,
    forwarding_address: account.forwarding_address,
    email: account.email_address,
    domain_verified: account.domain_verified,
    forwarding_verified: account.forwarding_verified,
    dns_records: dnsRecords,
    status: account.status,
  })
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 9: Disconnect Route

**Files:**
- Create: `app/api/auth/forwarding-email/disconnect/route.ts`

> @api-route-rules — invoke before creating API route

- [ ] **Step 1: Create the disconnect route**

Create `app/api/auth/forwarding-email/disconnect/route.ts`:

```typescript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { forwardingEmailVerifyBody } from '@/lib/schemas/forwarding'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { deleteDomain } from '@/lib/services/resend-domains'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [body, bErr] = await validateBody(request, forwardingEmailVerifyBody)
  if (bErr) return bErr

  const { account_id } = body

  const { data: account, error: fetchError } = await supabaseAdmin
    .from('email_accounts')
    .select('id, resend_domain_id, provider')
    .eq('id', account_id)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Soft delete — set status to disconnected
  await supabaseAdmin
    .from('email_accounts')
    .update({ status: 'disconnected' })
    .eq('id', account_id)

  // Check if other accounts share this Resend domain
  if (account.resend_domain_id) {
    const { count } = await supabaseAdmin
      .from('email_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('resend_domain_id', account.resend_domain_id)
      .neq('id', account_id)
      .neq('status', 'disconnected')

    if (count === 0) {
      try {
        await deleteDomain(account.resend_domain_id as string)
      } catch {
        // Domain cleanup is best-effort
      }
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 10: Modify Existing Backend Code

**Files:**
- Modify: `lib/conversationEngine.ts:108-116`
- Modify: `app/api/webhooks/email/inbound/route.ts:70-115`

- [ ] **Step 1: Skip forwarding accounts in sync**

In `lib/conversationEngine.ts`, inside `syncAllAccounts()`, find the for loop (line ~108):

```typescript
for (const account of accounts) {
```

Change to:

```typescript
for (const account of accounts) {
  // Forwarding accounts are webhook-driven, no sync needed
  if ((account as EmailAccountRow).provider === 'forwarding') continue
```

- [ ] **Step 2: Add verification token check to inbound webhook**

In `app/api/webhooks/email/inbound/route.ts`, inside the `handler` callback, after the account lookup (after line ~93 `if (!account) return ...`), add verification token handling before `processInboundMessage`:

```typescript
      // Check for forwarding verification token
      const verifyMatch = (subject as string)?.match(/\[lynq-verify:([^\]]+)\]/)
      if (verifyMatch) {
        const token = verifyMatch[1]
        const acct = account as Record<string, unknown>
        if (
          acct.verification_token === token &&
          acct.verification_token_expires_at &&
          new Date(acct.verification_token_expires_at as string) > new Date()
        ) {
          const updates: Record<string, unknown> = {
            forwarding_verified: true,
            verification_token: null,
          }
          if (acct.domain_verified) updates.status = 'active'

          await supabaseAdmin
            .from('email_accounts')
            .update(updates)
            .eq('id', acct.id as string)

          return {
            response: NextResponse.json({ ok: true, verified: true }),
            workspaceId: acct.workspace_id as string | undefined,
          }
        }
        // Token expired or mismatched — process as normal email
      }
```

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 11: TypeScript Types

**Files:**
- Create: `types/forwarding.ts`
- Modify: `types/settings.ts:130`

- [ ] **Step 1: Create forwarding types**

Create `types/forwarding.ts`:

```typescript
export interface DnsRecord {
  type: string
  name: string
  value: string
  status: string
  ttl?: string
  priority?: number
}

export interface ForwardingConnectResponse {
  account_id: string
  forwarding_address: string
  dns_records: DnsRecord[]
  domain_verified: boolean
  forwarding_verified: boolean
}

export interface ForwardingStatusResponse {
  account_id: string
  forwarding_address: string
  email: string
  domain_verified: boolean
  forwarding_verified: boolean
  dns_records: DnsRecord[]
  status: string
}

export interface ForwardingVerifyDnsResponse {
  domain_verified: boolean
  records: DnsRecord[]
}
```

- [ ] **Step 2: Add 'forwarding' to EmailProvider type**

In `types/settings.ts`, change line 130:
```typescript
export type EmailProvider = 'gmail' | 'outlook' | 'custom'
```
To:
```typescript
export type EmailProvider = 'gmail' | 'outlook' | 'custom' | 'forwarding'
```

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 12: Frontend Hooks

**Files:**
- Create: `hooks/settings/use-forwarding-mutations.ts`

> @component-rules — invoke before creating hooks

- [ ] **Step 1: Create forwarding mutation hooks**

Create `hooks/settings/use-forwarding-mutations.ts`:

```typescript
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'
import { parseJson } from '@/lib/utils/typed-json'
import type { ForwardingConnectResponse, ForwardingStatusResponse, ForwardingVerifyDnsResponse } from '@/types/forwarding'

interface ErrorResponse {
  error?: string
}

export function useConnectForwardingEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: { email: string; store_id?: string }) => {
      const res = await fetch('/api/auth/forwarding-email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to connect forwarding email')
      }
      return parseJson<ForwardingConnectResponse>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.emailAccounts() })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useVerifyForwardingDns() {
  const token = useToken()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch('/api/auth/forwarding-email/verify-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'DNS verification failed')
      }
      return parseJson<ForwardingVerifyDnsResponse>(res)
    },
  })
}

export function useVerifyForwarding() {
  const token = useToken()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch('/api/auth/forwarding-email/verify-forwarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to send verification email')
      }
      return parseJson<{ sent: boolean }>(res)
    },
    onSuccess: () => {
      toast.success('Verification email sent — check your inbox')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDisconnectForwardingEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch('/api/auth/forwarding-email/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to disconnect')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.emailAccounts() })
      toast.success('Email account disconnected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useForwardingStatus(accountId: string | null) {
  const token = useToken()
  return useQuery<ForwardingStatusResponse>({
    queryKey: [...settingsKeys.all, 'forwarding-status', accountId],
    queryFn: async () => {
      const res = await fetch(`/api/auth/forwarding-email/status?account_id=${accountId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load forwarding status')
      return parseJson<ForwardingStatusResponse>(res)
    },
    enabled: !!token && !!accountId,
    refetchInterval: 10_000, // Poll every 10s during setup
  })
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 13a: Copy Button Component

**Files:**
- Create: `components/features/settings/integrations/forwarding/copy-button.tsx`

> @component-rules — invoke before creating component

- [ ] **Step 1: Create copy button**

Create `components/features/settings/integrations/forwarding/copy-button.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 13b: DNS Record Table Component

**Files:**
- Create: `components/features/settings/integrations/forwarding/dns-record-table.tsx`

> @component-rules — invoke before creating component

- [ ] **Step 1: Create DNS record table**

Create `components/features/settings/integrations/forwarding/dns-record-table.tsx`:

```typescript
'use client'

import { Check } from 'lucide-react'
import { CopyButton } from '@/components/features/settings/integrations/forwarding/copy-button'
import type { DnsRecord } from '@/types/forwarding'

function DnsRecordRow({ record }: { record: DnsRecord }) {
  const isVerified = record.status === 'verified'
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-3 text-xs font-mono text-muted-foreground">{record.type}</td>
      <td className="py-2 pr-3 text-xs font-mono truncate max-w-[120px]">{record.name}</td>
      <td className="py-2 pr-2 text-xs font-mono truncate max-w-[200px]">
        <div className="flex items-center gap-1.5">
          <span className="truncate">{record.value}</span>
          <CopyButton value={record.value} />
        </div>
      </td>
      <td className="py-2 text-xs">
        {isVerified ? (
          <span className="flex items-center gap-1 text-success"><Check className="size-3" /> Verified</span>
        ) : (
          <span className="text-muted-foreground">Pending</span>
        )}
      </td>
    </tr>
  )
}

export function DnsRecordTable({ records }: { records: DnsRecord[] }) {
  if (records.length === 0) {
    return <p className="text-xs text-muted-foreground">Loading DNS records...</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-1.5 text-xs font-semibold text-muted-foreground">Type</th>
            <th className="pb-1.5 text-xs font-semibold text-muted-foreground">Name</th>
            <th className="pb-1.5 text-xs font-semibold text-muted-foreground">Value</th>
            <th className="pb-1.5 text-xs font-semibold text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => (
            <DnsRecordRow key={i} record={record} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 13c: Provider Instructions Component

**Files:**
- Create: `components/features/settings/integrations/forwarding/provider-instructions.tsx`

> @component-rules — invoke before creating component

- [ ] **Step 1: Create provider instructions**

Create `components/features/settings/integrations/forwarding/provider-instructions.tsx`:

```typescript
'use client'

import { ChevronDown } from 'lucide-react'

export function ProviderInstructions() {
  return (
    <details className="mt-3 text-xs">
      <summary className="flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
        <ChevronDown className="size-3" />
        How to set up forwarding in your email provider
      </summary>
      <div className="mt-2 flex flex-col gap-2 pl-4 text-muted-foreground">
        <div>
          <strong className="text-foreground">Gmail:</strong> Settings &gt; Forwarding and POP/IMAP &gt; Add a forwarding address &gt; paste the address above
        </div>
        <div>
          <strong className="text-foreground">Outlook:</strong> Settings &gt; Mail &gt; Forwarding &gt; Enable forwarding &gt; paste the address above
        </div>
        <div>
          <strong className="text-foreground">Namecheap / Privateemail:</strong> Email Forwarding settings in your hosting control panel &gt; add forward rule
        </div>
        <div>
          <strong className="text-foreground">Other:</strong> Look for &quot;Email forwarding&quot; or &quot;Mail rules&quot; in your provider settings and forward all incoming mail to the address above
        </div>
      </div>
    </details>
  )
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 13d: Email Input Step

**Files:**
- Create: `components/features/settings/integrations/forwarding/forwarding-email-step.tsx`

> @component-rules — invoke before creating component

- [ ] **Step 1: Create email input step**

Create `components/features/settings/integrations/forwarding/forwarding-email-step.tsx`:

```typescript
'use client'

import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ForwardingEmailStepProps {
  email: string
  onEmailChange: (email: string) => void
  error: string
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function ForwardingEmailStep({ email, onEmailChange, error, isPending, onSubmit }: ForwardingEmailStepProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor="fwd-email" className="mb-1.5 text-xs font-semibold">
            Your business email
          </Label>
          <Input
            id="fwd-email"
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEmailChange(e.target.value)}
            placeholder="you@yourdomain.com"
            autoFocus
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-3.5 flex-shrink-0" />
            {error}
          </div>
        )}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          {isPending ? 'Setting up...' : 'Continue'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 13e: Setup Step (Forwarding + DNS)

**Files:**
- Create: `components/features/settings/integrations/forwarding/forwarding-setup-step.tsx`

> @component-rules — invoke before creating component

- [ ] **Step 1: Create setup step**

Create `components/features/settings/integrations/forwarding/forwarding-setup-step.tsx`:

```typescript
'use client'

import { Check, Loader2, RefreshCw, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/features/settings/integrations/forwarding/copy-button'
import { DnsRecordTable } from '@/components/features/settings/integrations/forwarding/dns-record-table'
import { ProviderInstructions } from '@/components/features/settings/integrations/forwarding/provider-instructions'
import type { DnsRecord } from '@/types/forwarding'

interface ForwardingSetupStepProps {
  forwardingAddress: string
  forwardingVerified: boolean
  domainVerified: boolean
  dnsRecords: DnsRecord[]
  accountId: string
  onVerifyForwarding: () => void
  onVerifyDns: () => void
  isVerifyingForwarding: boolean
  isVerifyingDns: boolean
}

export function ForwardingSetupStep({
  forwardingAddress,
  forwardingVerified,
  domainVerified,
  dnsRecords,
  accountId,
  onVerifyForwarding,
  onVerifyDns,
  isVerifyingForwarding,
  isVerifyingDns,
}: ForwardingSetupStepProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Forwarding instructions */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="size-4" />
            1. Set up email forwarding
            {forwardingVerified && <Check className="size-4 text-success" />}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Forward all incoming emails to this address:
        </p>
        <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
          <code className="text-xs font-mono flex-1 truncate">{forwardingAddress}</code>
          <CopyButton value={forwardingAddress} />
        </div>

        <ProviderInstructions />

        {!forwardingVerified && accountId && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={isVerifyingForwarding}
            onClick={onVerifyForwarding}
          >
            {isVerifyingForwarding && <Loader2 className="size-3 animate-spin" />}
            Send test email
          </Button>
        )}
        {forwardingVerified && (
          <p className="text-xs text-success mt-2">Forwarding verified</p>
        )}
      </div>

      {/* DNS records */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            2. Add DNS records
            {domainVerified && <Check className="size-4 text-success" />}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Add these records to your domain&apos;s DNS settings:
        </p>

        <DnsRecordTable records={dnsRecords} />

        {!domainVerified && accountId && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={isVerifyingDns}
              onClick={onVerifyDns}
            >
              {isVerifyingDns ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Verify DNS
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              DNS propagation can take up to 48 hours. Click Verify to re-check.
            </p>
          </>
        )}
        {domainVerified && (
          <p className="text-xs text-success mt-2">DNS verified</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 13f: Active Step

**Files:**
- Create: `components/features/settings/integrations/forwarding/forwarding-active-step.tsx`

> @component-rules — invoke before creating component

- [ ] **Step 1: Create active step**

Create `components/features/settings/integrations/forwarding/forwarding-active-step.tsx`:

```typescript
'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ForwardingActiveStepProps {
  email: string
  onClose: () => void
}

export function ForwardingActiveStep({ email, onClose }: ForwardingActiveStepProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
        <Check className="size-6 text-success" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{email}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Emails are now being received and you can send replies through Lynq.
        </p>
      </div>
      <Button onClick={onClose} className="mt-2">Done</Button>
    </div>
  )
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 13g: Wizard Shell (Orchestrator)

**Files:**
- Create: `components/features/settings/integrations/forwarding/forwarding-setup-wizard.tsx`

> @component-rules — invoke before creating component

- [ ] **Step 1: Create wizard shell**

Create `components/features/settings/integrations/forwarding/forwarding-setup-wizard.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  useConnectForwardingEmail,
  useVerifyForwardingDns,
  useVerifyForwarding,
  useForwardingStatus,
} from '@/hooks/settings/use-forwarding-mutations'
import { useEmailAccounts } from '@/hooks/settings/use-settings-data'
import { useStoreStore } from '@/stores/store'
import { ForwardingEmailStep } from '@/components/features/settings/integrations/forwarding/forwarding-email-step'
import { ForwardingSetupStep } from '@/components/features/settings/integrations/forwarding/forwarding-setup-step'
import { ForwardingActiveStep } from '@/components/features/settings/integrations/forwarding/forwarding-active-step'
import type { ForwardingConnectResponse, DnsRecord } from '@/types/forwarding'

interface ForwardingSetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type WizardStep = 'email' | 'setup' | 'active'

const STEP_TITLES: Record<WizardStep, string> = {
  email: 'Connect email via forwarding',
  setup: 'Set up email forwarding',
  active: 'Email connected',
}

const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  email: 'No credentials needed — just set up forwarding and DNS records.',
  setup: 'Complete these two steps to activate your email.',
  active: 'Your email is now receiving and sending through Lynq.',
}

export function ForwardingSetupWizard({ open, onOpenChange }: ForwardingSetupWizardProps) {
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const [step, setStep] = useState<WizardStep>('email')
  const [email, setEmail] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [connectData, setConnectData] = useState<ForwardingConnectResponse | null>(null)
  const [error, setError] = useState('')

  const { data: existingAccounts } = useEmailAccounts()
  const connectMutation = useConnectForwardingEmail()
  const verifyDnsMutation = useVerifyForwardingDns()
  const verifyForwardingMutation = useVerifyForwarding()
  const { data: status } = useForwardingStatus(step === 'setup' ? accountId : null)

  // Resume wizard for existing pending forwarding account
  useEffect(() => {
    if (!open || accountId) return
    const pending = existingAccounts?.find(
      (a) => a.provider === 'forwarding' && a.status === 'pending'
    )
    if (pending) {
      setAccountId(pending.id)
      setEmail(pending.email)
      setStep('setup')
    }
  }, [open, existingAccounts, accountId])

  // Merge connect response with polling status
  const dnsRecords = (status?.dns_records ?? connectData?.dns_records ?? []) as DnsRecord[]
  const domainVerified = status?.domain_verified ?? connectData?.domain_verified ?? false
  const forwardingVerified = status?.forwarding_verified ?? connectData?.forwarding_verified ?? false
  const forwardingAddress = status?.forwarding_address ?? connectData?.forwarding_address ?? ''

  // Auto-advance to active when both verified
  useEffect(() => {
    if (step === 'setup' && domainVerified && forwardingVerified) {
      setStep('active')
    }
  }, [step, domainVerified, forwardingVerified])

  function handleClose() {
    setStep('email')
    setEmail('')
    setAccountId(null)
    setConnectData(null)
    setError('')
    onOpenChange(false)
  }

  function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }
    setError('')
    connectMutation.mutate(
      { email: email.trim(), store_id: activeStoreId || undefined },
      {
        onSuccess: (data) => {
          setConnectData(data)
          setAccountId(data.account_id)
          setStep('setup')
        },
        onError: (err) => setError(err.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>{STEP_DESCRIPTIONS[step]}</DialogDescription>
        </DialogHeader>

        {step === 'email' && (
          <ForwardingEmailStep
            email={email}
            onEmailChange={setEmail}
            error={error}
            isPending={connectMutation.isPending}
            onSubmit={handleConnect}
          />
        )}

        {step === 'setup' && accountId && (
          <ForwardingSetupStep
            forwardingAddress={forwardingAddress}
            forwardingVerified={forwardingVerified}
            domainVerified={domainVerified}
            dnsRecords={dnsRecords}
            accountId={accountId}
            onVerifyForwarding={() => verifyForwardingMutation.mutate(accountId)}
            onVerifyDns={() => verifyDnsMutation.mutate(accountId)}
            isVerifyingForwarding={verifyForwardingMutation.isPending}
            isVerifyingDns={verifyDnsMutation.isPending}
          />
        )}

        {step === 'active' && (
          <ForwardingActiveStep email={email} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 14: Update Email Settings Page

**Files:**
- Modify: `components/features/settings/integrations/email-settings.tsx`
- Modify: `components/features/settings/integrations/email-account-row.tsx`

> @component-rules — invoke before modifying components

- [ ] **Step 1: Update email-settings.tsx**

Replace the "Custom (IMAP)" button with two buttons — "Email Forwarding" first (default), then "Custom (IMAP)":

In `email-settings.tsx`, add the import at the top:
```typescript
import { ForwardingSetupWizard } from '@/components/features/settings/integrations/forwarding/forwarding-setup-wizard'
```

Add state for the forwarding modal next to the existing `customModalOpen` state:
```typescript
const [forwardingModalOpen, setForwardingModalOpen] = useState(false)
```

Replace the "Custom" button block (lines ~87-97) with two buttons — forwarding first, then IMAP:

```tsx
          {/* Email Forwarding (recommended) */}
          <button
            type="button"
            onClick={() => setForwardingModalOpen(true)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm"
          >
            <span className="flex size-7 items-center justify-center flex-shrink-0">
              <Mail className="size-5 text-muted-foreground" />
            </span>
            <span className="flex-1">Email Forwarding</span>
            <Plus className="size-3.5 text-muted-foreground flex-shrink-0" />
          </button>

          {/* Custom (IMAP) */}
          <button
            type="button"
            onClick={() => setCustomModalOpen(true)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm"
          >
            <span className="flex size-7 items-center justify-center flex-shrink-0">
              <Mail className="size-5 text-muted-foreground" />
            </span>
            <span className="flex-1">Custom (IMAP)</span>
            <Plus className="size-3.5 text-muted-foreground flex-shrink-0" />
          </button>
```

Change the grid from 3 columns to 4: `grid-cols-1 sm:grid-cols-4`

Add the ForwardingSetupWizard at the bottom, next to the CustomEmailModal:
```tsx
      <ForwardingSetupWizard
        open={forwardingModalOpen}
        onOpenChange={setForwardingModalOpen}
      />
```

- [ ] **Step 2: Update email-account-row.tsx**

In `email-account-row.tsx`, add `'forwarding'` to `PROVIDER_LABELS`:

```typescript
const PROVIDER_LABELS: Record<EmailProvider, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  custom: 'Custom email',
  forwarding: 'Email Forwarding',
}
```

In the `ProviderIcon` component, forwarding uses the same `Mail` icon as custom (the existing fallback `return <Mail .../>` already handles this).

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No new errors.

---

## Task 15: End-to-End Verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test connect flow**

1. Navigate to `/settings/workspace/stores` (or wherever email settings live)
2. Click "Email Forwarding" button
3. Enter a test email address
4. Verify the wizard shows forwarding address and DNS records
5. Check the `email_accounts` table in Supabase for the new row

- [ ] **Step 3: Test DNS verification**

1. Click "Verify DNS" in the wizard
2. Verify it calls Resend API and returns record statuses
3. (Records will show as pending unless DNS is actually configured)

- [ ] **Step 4: Test forwarding verification**

1. Click "Send test email"
2. Verify the test email arrives at the target address
3. If forwarding is configured, verify the webhook receives it and sets `forwarding_verified`

- [ ] **Step 5: Test sync skip**

1. Trigger sync via `POST /api/inbox/sync`
2. Verify forwarding accounts are skipped (no "Sync failed" errors for forwarding accounts)

- [ ] **Step 6: Test disconnect**

1. Disconnect a forwarding account
2. Verify status changes to `disconnected`
3. Verify account is no longer shown as active

- [ ] **Step 7: Run full linter**

Run: `npm run lint`
Expected: No errors.
