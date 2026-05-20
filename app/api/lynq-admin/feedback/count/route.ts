import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LYNQ_ADMIN_EMAILS = ['info@lynqagency.com']

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !LYNQ_ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await supabaseAdmin
    .from('feedback_submissions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  if (error) {
    console.error('[lynq-admin/feedback/count] query failed:', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  return NextResponse.json({ count: count || 0 })
}
