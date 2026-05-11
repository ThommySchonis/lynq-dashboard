import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wsId = ctx.workspaceId

  const [open, pending, resolved, unlinked, trash] = await Promise.all([
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'open'),
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'pending'),
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'resolved'),
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).is('shopify_customer_id', null).neq('status', 'closed'),
    supabaseAdmin.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'closed'),
  ])

  return NextResponse.json({
    open: open.count || 0,
    pending: pending.count || 0,
    resolved: resolved.count || 0,
    unlinked: unlinked.count || 0,
    trash: trash.count || 0,
  })
}
