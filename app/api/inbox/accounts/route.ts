import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { getAccountsQuery } from '@/lib/schemas/inbox'
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

  const [query, queryErr] = validateQuery(request, getAccountsQuery)
  if (queryErr) return queryErr

  let dbQuery = supabaseAdmin
    .from('email_accounts')
    .select('id, provider, email_address, display_name, status, is_default, last_sync_at, connected_at')
    .eq('workspace_id', ctx.workspaceId)

  if (query.store_id) {
    dbQuery = dbQuery.eq('store_id', query.store_id)
  }

  const { data, error } = await dbQuery.order('connected_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ accounts: data || [] })
}
