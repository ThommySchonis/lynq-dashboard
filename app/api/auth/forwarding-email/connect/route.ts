import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { forwardingEmailConnectBody } from '@/lib/schemas/forwarding'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registerOrGetDomain, getDomain } from '@/lib/services/resend-domains'

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
      const domain = await registerOrGetDomain(senderDomain)
      resendDomainId = domain.id
    }

    // Check if first account for is_default
    const { count } = await supabaseAdmin
      .from('email_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    const isDefault = count === 0

    // Upsert email account
    const { data, error: upsertError } = await supabaseAdmin
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

    const account = data as { id: string; domain_verified: boolean; forwarding_verified: boolean } | null
    if (upsertError || !account) {
      return NextResponse.json({ error: upsertError?.message || 'Failed to save account' }, { status: 500 })
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
