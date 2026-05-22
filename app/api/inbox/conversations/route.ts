import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { getConversationsQuery } from '@/lib/schemas/inbox'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeLikeInput } from '@/lib/sanitize'

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

  // When there's a search term, we need to find matching conversation IDs
  // via safe individual .ilike() queries (no .or() with user input)
  if (query.search) {
    const sanitized = sanitizeLikeInput(query.search)
    const pattern = `%${sanitized}%`

    // Build a base conversation ID query with shared filters
    const convIdQuery = () => {
      let q = supabaseAdmin.from('email_conversations').select('id').eq('workspace_id', ctx.workspaceId)
      if (query.status) q = q.eq('status', query.status)
      if (query.unlinked === 'true') q = q.is('shopify_customer_id', null).neq('status', 'closed')
      if (query.store_id) q = q.eq('store_id', query.store_id)
      return q
    }

    // Step 1 & 2: Find conversation IDs from metadata + body matches (parallel)
    const [subjectRes, emailRes, nameRes, bodyRes] = await Promise.all([
      convIdQuery().ilike('subject', pattern).limit(200),
      convIdQuery().ilike('customer_email', pattern).limit(200),
      convIdQuery().ilike('customer_name', pattern).limit(200),
      supabaseAdmin
        .from('email_messages')
        .select('conversation_id')
        .eq('workspace_id', ctx.workspaceId)
        .ilike('body_text', pattern)
        .limit(200),
    ])

    // Check for sub-query errors
    const subQueryError = subjectRes.error || emailRes.error || nameRes.error || bodyRes.error
    if (subQueryError) {
      return NextResponse.json({ error: subQueryError.message }, { status: 500 })
    }

    // Collect and deduplicate all matched IDs
    const idSet = new Set<string>()
    for (const row of subjectRes.data || []) idSet.add((row as { id: string }).id)
    for (const row of emailRes.data || []) idSet.add((row as { id: string }).id)
    for (const row of nameRes.data || []) idSet.add((row as { id: string }).id)
    for (const row of bodyRes.data || []) idSet.add((row as { conversation_id: string }).conversation_id)

    if (idSet.size === 0) {
      return NextResponse.json({ conversations: [] })
    }

    // Step 3: Fetch full conversation rows by matched IDs
    // Re-apply status/store/unlinked filters to cover body-matched IDs
    // (body search runs against email_messages, not email_conversations)
    const allIds = [...idSet]
    let finalQ = supabaseAdmin
      .from('email_conversations')
      .select('*, stores(name)')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', allIds)
      .order('last_message_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)

    if (query.status) finalQ = finalQ.eq('status', query.status)
    if (query.unlinked === 'true') finalQ = finalQ.is('shopify_customer_id', null).neq('status', 'closed')
    if (query.store_id) finalQ = finalQ.eq('store_id', query.store_id)

    const { data: conversations, error } = await finalQ

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const mapped = (conversations || []).map((c: Record<string, unknown>) => {
      const stores = c.stores as { name: string } | null
      return { ...c, store_name: stores?.name ?? null, stores: undefined }
    })
    return NextResponse.json({ conversations: mapped })
  }

  // No search — original query path (unchanged)
  let dbQuery = supabaseAdmin
    .from('email_conversations')
    .select('*, stores(name)')
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

  const { data: conversations, error } = await dbQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (conversations || []).map((c: Record<string, unknown>) => {
    const stores = c.stores as { name: string } | null
    return { ...c, store_name: stores?.name ?? null, stores: undefined }
  })
  return NextResponse.json({ conversations: mapped })
}
