import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wsId = ctx.workspaceId
  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id')

  const baseQuery = () => {
    const q = supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId)
    return storeId ? q.eq('store_id', storeId) : q
  }

  const [open, pending, resolved, unlinked, trash] = await Promise.all([
    baseQuery().eq('status', 'open'),
    baseQuery().eq('status', 'pending'),
    baseQuery().eq('status', 'resolved'),
    baseQuery().is('shopify_customer_id', null).neq('status', 'closed'),
    baseQuery().eq('status', 'closed'),
  ])

  return NextResponse.json({
    open: open.count || 0,
    pending: pending.count || 0,
    resolved: resolved.count || 0,
    unlinked: unlinked.count || 0,
    trash: trash.count || 0,
  })
}
