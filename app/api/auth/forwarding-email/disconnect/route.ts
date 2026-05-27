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
