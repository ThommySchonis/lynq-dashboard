import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id')

  let query = supabaseAdmin
    .from('email_accounts')
    .select('id, provider, email_address, display_name, status, is_default, last_sync_at, connected_at')
    .eq('workspace_id', ctx.workspaceId)

  if (storeId) {
    query = query.eq('store_id', storeId)
  }

  const { data, error } = await query.order('connected_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ accounts: data || [] })
}
