import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isPlatformAdmin } from '@/lib/platformAdmin'
import { validateBody } from '@/lib/validation'
import { webhookEventIdsBody } from '@/lib/schemas/admin'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  const isAdmin = await isPlatformAdmin(user?.email)
  if (!user || !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [body, bErr] = await validateBody(request, webhookEventIdsBody)
  if (bErr) return bErr

  const { error, count } = await supabaseAdmin
    .from('webhook_events')
    .update({
      status: 'failed',
      attempt_count: 0,
      next_retry_at: new Date().toISOString(),
    })
    .in('id', body.ids)
    .in('status', ['dead_letter'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: count ?? 0 })
}
