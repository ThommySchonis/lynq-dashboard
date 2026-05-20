import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const unlinked = searchParams.get('unlinked') === 'true'
  const search = searchParams.get('search')
  const storeId = searchParams.get('store_id')
  const page = parseInt(searchParams.get('page') || '0')
  const limit = 50

  let query = supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('last_message_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (unlinked) {
    query = query.is('shopify_customer_id', null).neq('status', 'closed')
  }

  if (storeId) {
    query = query.eq('store_id', storeId)
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`)
  }

  const { data: conversations, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ conversations: conversations || [] })
}
