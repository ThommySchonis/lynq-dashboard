import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { decrypt } from '@/lib/encryption'
import { validateBody } from '@/lib/validation'
import { disconnectGmailBody } from '@/lib/schemas/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bErr] = await validateBody(request, disconnectGmailBody)
  if (bErr) return bErr

  // Fetch the email account — scoped to workspace + gmail provider
  const { data: account, error: fetchError } = await supabaseAdmin
    .from('email_accounts')
    .select('id, access_token')
    .eq('id', body.account_id)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'gmail')
    .maybeSingle()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
  }

  // Revoke token at Google (must decrypt — tokens are stored encrypted)
  if (account.access_token) {
    try {
      const plainToken = decrypt(account.access_token as string)
      await fetch(`https://oauth2.googleapis.com/revoke?token=${plainToken}`, {
        method: 'POST',
      }).catch(() => {})
    } catch {
      // Decryption failure — token may already be invalid, proceed with disconnect
    }
  }

  // Update the account: disconnect, clear tokens
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
