import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/admin-constants'
import { validateBody } from '@/lib/validation'
import { webhookEventIdsBody } from '@/lib/schemas/admin'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [body, bErr] = await validateBody(request, webhookEventIdsBody)
  if (bErr) return bErr

  const { error, count } = await supabaseAdmin
    .from('webhook_events')
    .update({ status: 'dismissed' })
    .in('id', body.ids)
    .in('status', ['dead_letter'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: count ?? 0 })
}
