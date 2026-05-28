import { getUserFromToken } from '@/lib/supabaseAdmin'
import { ADMIN_EMAILS } from '@/lib/admin-constants'
import { getClientOverview } from '@/lib/services/admin-clients'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await getClientOverview()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error('[admin/clients/overview]', 'fetch failed', { error: message })
    return NextResponse.json({ error: 'Failed to fetch client overview' }, { status: 500 })
  }
}
