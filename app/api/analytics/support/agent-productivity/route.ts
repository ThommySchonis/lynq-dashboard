import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const agentId = url.searchParams.get('agent_id') || null
  const dateFrom = url.searchParams.get('date_from') || null
  const dateTo = url.searchParams.get('date_to') || null

  const rpcResult = await supabaseAdmin.rpc('get_agent_productivity', {
    p_workspace_id: ctx.workspaceId,
    p_agent_id: agentId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  })

  if (rpcResult.error) {
    console.error('[analytics] get_agent_productivity error:', rpcResult.error.message)
    return NextResponse.json({ data: null, error: 'analytics_unavailable' })
  }

  return NextResponse.json({ data: rpcResult.data as unknown }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
