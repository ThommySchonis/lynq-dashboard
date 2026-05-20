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

  const rpcResult = await supabaseAdmin.rpc('get_response_times', {
    p_workspace_id: ctx.workspaceId,
    p_agent_id: agentId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  })

  if (rpcResult.error) {
    console.error('[analytics] get_response_times error:', rpcResult.error.message)
    return NextResponse.json({ data: null, error: 'analytics_unavailable' })
  }

  const rows = rpcResult.data as unknown[]
  return NextResponse.json({ data: rows?.[0] ?? null }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
