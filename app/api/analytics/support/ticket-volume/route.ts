import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { supportAnalyticsQuery } from '@/lib/schemas/analytics'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, supportAnalyticsQuery)
  if (qErr) return qErr

  const rpcResult = await supabaseAdmin.rpc('get_ticket_volume', {
    p_workspace_id: ctx.workspaceId,
    p_agent_id: query.agent_id ?? null,
    p_date_from: query.date_from ?? null,
    p_date_to: query.date_to ?? null,
  })

  if (rpcResult.error) {
    console.error('[analytics] get_ticket_volume error:', rpcResult.error.message)
    return NextResponse.json({ data: null, error: 'analytics_unavailable' })
  }

  return NextResponse.json({ data: rpcResult.data as unknown }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
