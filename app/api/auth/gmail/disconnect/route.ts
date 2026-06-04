import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { decrypt } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { account_id?: string }
  try {
    body = (await request.json()) as { account_id?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const accountId = body.account_id
  if (!accountId) {
    return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
  }

  const { data: account, error: fetchError } = await supabaseAdmin
    .from('email_accounts')
    .select('id, access_token')
    .eq('id', accountId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'gmail')
    .maybeSingle()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
  }

  if (account.access_token) {
    try {
      const plainToken = decrypt(account.access_token as string)
      await fetch(`https://oauth2.googleapis.com/revoke?token=${plainToken}`, {
        method: 'POST',
      }).catch(() => {})
    } catch {
      // Token may already be invalid
    }
  }

  await supabaseAdmin
    .from('email_accounts')
    .update({
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      watch_expiry: null,
    })
    .eq('id', account.id)

  return NextResponse.json({ success: true })
}
