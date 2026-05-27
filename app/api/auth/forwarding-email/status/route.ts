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

  const { data, error: fetchError } = await supabaseAdmin
    .from('email_accounts')
    .select('id, email_address, forwarding_address, domain_verified, forwarding_verified, resend_domain_id, status, provider')
    .eq('id', account_id)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  const account = data as AccountRow | null
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
