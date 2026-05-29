import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext, requireNotImpersonating } from '@/lib/auth'
import { scheduleAccountDeletion } from '@/lib/services/account-deletion'
import { getSiteUrl } from '@/lib/utils/request'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const impersonationBlocked = requireNotImpersonating(ctx)
  if (impersonationBlocked) return impersonationBlocked

  try {
    const siteUrl = getSiteUrl(request)
    const result = await scheduleAccountDeletion(
      ctx.user.id,
      ctx.user.email ?? '',
      siteUrl,
    )
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to schedule deletion'
    logger.error('[account/delete]', 'POST failed', { error: message })
    const status = message.includes('other members') || message.includes('pending') || message.includes('already') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
