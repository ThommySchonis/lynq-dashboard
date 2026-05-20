import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { getConversationsQuery } from '@/lib/schemas/inbox'
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

  const [query, queryErr] = validateQuery(request, getConversationsQuery)
  if (queryErr) return queryErr

  const page = query.page ?? 0
  const limit = 50

  let dbQuery = supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('last_message_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  if (query.unlinked === 'true') {
    dbQuery = dbQuery.is('shopify_customer_id', null).neq('status', 'closed')
  }

  if (query.store_id) {
    dbQuery = dbQuery.eq('store_id', query.store_id)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`subject.ilike.%${query.search}%,customer_email.ilike.%${query.search}%,customer_name.ilike.%${query.search}%`)
  }

  const { data: conversations, error } = await dbQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ conversations: conversations || [] })
}
