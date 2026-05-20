import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { getCountsQuery } from '@/lib/schemas/inbox'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:inbox`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const [query, queryErr] = validateQuery(request, getCountsQuery)
  if (queryErr) return queryErr

  const wsId = ctx.workspaceId
  const storeId = query.store_id

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
  }, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}
