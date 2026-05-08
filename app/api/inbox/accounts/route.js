import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: accounts } = await supabaseAdmin
    .from('email_accounts')
    .select('id, provider, email_address, display_name, status, is_default, last_sync_at, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ accounts: accounts || [] })
}
