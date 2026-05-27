import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/admin-constants'
import { validateQuery } from '@/lib/validation'
import { listWebhookEventsQuery } from '@/lib/schemas/admin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [query, qErr] = validateQuery(request, listWebhookEventsQuery)
  if (qErr) return qErr

  const { status, source, page } = query
  const limit = 25
  const offset = (page - 1) * limit

  let dbQuery = supabaseAdmin
    .from('webhook_events')
    .select(
      'id, event_id, source, event_type, status, error_message, attempt_count, next_retry_at, workspace_id, metadata, created_at, completed_at',
      { count: 'exact' },
    )

  const statuses = status.split(',').map((s) => s.trim())
  if (statuses.length === 1) {
    dbQuery = dbQuery.eq('status', statuses[0])
  } else {
    dbQuery = dbQuery.in('status', statuses)
  }

  if (source) {
    dbQuery = dbQuery.eq('source', source)
  }

  dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data, count, error } = await dbQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [], total: count ?? 0, page, limit })
}
