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
