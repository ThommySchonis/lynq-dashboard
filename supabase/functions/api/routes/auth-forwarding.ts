import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { logger } from '../lib/logger.ts'
import {
  registerOrGetDomain,
  getDomain,
  getDnsRecords,
  isDomainVerified,
  verifyDomain,
  deleteDomain,
} from '../lib/services/resend-domains.ts'
import type { AuthContext } from '../lib/types.ts'

const FORWARDING_DOMAIN = Deno.env.get('FORWARDING_EMAIL_DOMAIN') || 'inbox.lynq.com'
const RESEND_API = 'https://api.resend.com/emails'

async function generateForwardingAddress(workspaceId: string, email: string): Promise<string> {
  const data = new TextEncoder().encode(workspaceId + email)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `fwd_${hex.slice(0, 12)}@${FORWARDING_DOMAIN}`
}

function extractDomain(email: string): string {
  return email.split('@')[1].toLowerCase()
}

const app = new Hono()

// All routes require auth
app.use('*', authMiddleware)

// ── POST /connect — generate forwarding address, register domain, upsert account ──
app.post('/connect', async (c) => {
  const ctx = c.get('authContext') as AuthContext

  let body: { email?: string; store_id?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const email = body.email
  const storeId = body.store_id
  if (!email) return c.json({ error: 'email is required' }, 400)

  const { user, workspaceId } = ctx
  const senderDomain = extractDomain(email)
  const forwardingAddress = await generateForwardingAddress(workspaceId, email)

  const sb = getAdminClient()

  try {
    // Check for existing Resend domain registration
    const { data: existingDomain } = await sb
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
      const domain = await registerOrGetDomain(senderDomain)
      resendDomainId = domain.id
    }

    // Check if first account for is_default
    const { count } = await sb
      .from('email_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    const isDefault = count === 0

    // Upsert email account
    const { data, error: upsertError } = await sb
      .from('email_accounts')
      .upsert(
        {
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
        },
        { onConflict: 'workspace_id,provider,email_address' },
      )
      .select('id, domain_verified, forwarding_verified')
      .single()

    const account = data as { id: string; domain_verified: boolean; forwarding_verified: boolean } | null
    if (upsertError || !account) {
      return c.json({ error: upsertError?.message || 'Failed to save account' }, 500)
    }

    // Keep this mailbox's conversations on the same store as the mailbox
    // (cascade on link). email_conversations.store_id is snapshotted at
    // ingestion, so re-stamp existing rows whenever the store link changes.
    await sb
      .from('email_conversations')
      .update({ store_id: storeId || null })
      .eq('workspace_id', workspaceId)
      .eq('email_account_id', account.id)

    // Fetch DNS records from Resend
    const domainInfo = await getDomain(resendDomainId)

    return c.json({
      account_id: account.id,
      forwarding_address: forwardingAddress,
      dns_records: domainInfo.records || [],
      domain_verified: domainInfo.status === 'verified',
      forwarding_verified: false,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to connect forwarding email'
    return c.json({ error: message }, 500)
  }
})

// ── POST /disconnect — soft-delete account, optionally delete Resend domain ──
app.post('/disconnect', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked

  let body: { account_id?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const accountId = body.account_id
  if (!accountId) return c.json({ error: 'account_id is required' }, 400)

  const sb = getAdminClient()

  const { data: account, error: fetchError } = await sb
    .from('email_accounts')
    .select('id, resend_domain_id, provider')
    .eq('id', accountId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  if (fetchError || !account) {
    return c.json({ error: 'Account not found' }, 404)
  }

  // Soft delete — set status to disconnected
  await sb.from('email_accounts').update({ status: 'disconnected' }).eq('id', accountId)

  // Check if other accounts share this Resend domain
  if (account.resend_domain_id) {
    const { count } = await sb
      .from('email_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('resend_domain_id', account.resend_domain_id)
      .neq('id', accountId)
      .neq('status', 'disconnected')

    if (count === 0) {
      try {
        await deleteDomain(account.resend_domain_id as string)
      } catch {
        // Domain cleanup is best-effort
      }
    }
  }

  return c.json({ ok: true })
})

// ── GET /status — return account status + DNS records ──
app.get('/status', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const url = new URL(c.req.url)
  const accountId = url.searchParams.get('account_id')

  if (!accountId) return c.json({ error: 'account_id is required' }, 400)

  interface AccountRow {
    id: string
    email_address: string
    forwarding_address: string
    domain_verified: boolean
    forwarding_verified: boolean
    resend_domain_id: string | null
    status: string
    provider: string
  }

  const sb = getAdminClient()

  const { data, error: fetchError } = await sb
    .from('email_accounts')
    .select(
      'id, email_address, forwarding_address, domain_verified, forwarding_verified, resend_domain_id, status, provider',
    )
    .eq('id', accountId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  const account = data as AccountRow | null
  if (fetchError || !account) {
    return c.json({ error: 'Account not found' }, 404)
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

  return c.json({
    account_id: account.id,
    forwarding_address: account.forwarding_address,
    email: account.email_address,
    domain_verified: account.domain_verified,
    forwarding_verified: account.forwarding_verified,
    dns_records: dnsRecords,
    status: account.status,
  })
})

// ── POST /verify-dns — trigger Resend domain verification ──
app.post('/verify-dns', async (c) => {
  const ctx = c.get('authContext') as AuthContext

  let body: { account_id?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const accountId = body.account_id
  if (!accountId) return c.json({ error: 'account_id is required' }, 400)

  const sb = getAdminClient()

  // Fetch account with workspace scoping
  const { data: account, error: fetchError } = await sb
    .from('email_accounts')
    .select('id, resend_domain_id, forwarding_verified, provider')
    .eq('id', accountId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  if (fetchError || !account) {
    return c.json({ error: 'Account not found' }, 404)
  }

  if (!account.resend_domain_id) {
    return c.json({ error: 'No domain registered for this account' }, 400)
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

    await sb.from('email_accounts').update(updates).eq('id', accountId)

    return c.json({
      domain_verified: domainVerified,
      records: getDnsRecords(domainInfo),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'DNS verification failed'
    return c.json({ error: message }, 500)
  }
})

// ── POST /verify-forwarding — send verification email via Resend REST API ──
app.post('/verify-forwarding', async (c) => {
  const ctx = c.get('authContext') as AuthContext

  let body: { account_id?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const accountId = body.account_id
  if (!accountId) return c.json({ error: 'account_id is required' }, 400)

  const sb = getAdminClient()

  const { data: account, error: fetchError } = await sb
    .from('email_accounts')
    .select('id, email_address, provider')
    .eq('id', accountId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  if (fetchError || !account) {
    return c.json({ error: 'Account not found' }, 404)
  }

  // Generate verification token with 24h expiry
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await sb
    .from('email_accounts')
    .update({
      verification_token: token,
      verification_token_expires_at: expiresAt,
    })
    .eq('id', accountId)

  // Send verification email via Resend REST API
  const emailAddress = account.email_address as string
  try {
    const from = Deno.env.get('FORWARDING_VERIFY_FROM') || 'Lynq & Flow <verify@resend.dev>'
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: emailAddress,
        subject: `Verify your email forwarding [lynq-verify:${token}]`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Email Forwarding Verification</h2>
            <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
              This is a test email to verify that forwarding is set up correctly for
              <strong style="color:#1C0F36;">${emailAddress}</strong>.
            </p>
            <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0;">
              If you see this email in your Lynq inbox, forwarding is working. If not, please check your email forwarding settings.
            </p>
            <p style="font-size:12px;color:#9B91A8;margin:24px 0 0;">
              This verification link expires in 24 hours.
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}))
      const errorMessage = (errorBody as Record<string, string>).message ?? `HTTP ${res.status}`
      logger.error('[forwarding/verify]', 'Failed to send verification email', { error: errorMessage })
      return c.json({ error: errorMessage }, 500)
    }

    return c.json({ sent: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send verification email'
    return c.json({ error: message }, 500)
  }
})

export { app as authForwardingRoutes }
