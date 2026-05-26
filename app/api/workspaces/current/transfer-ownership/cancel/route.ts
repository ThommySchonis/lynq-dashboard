import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { cancelTransfer } from '@/lib/services/ownership-transfer'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await cancelTransfer(ctx.workspaceId, ctx.user.id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel transfer'
    logger.error('[transfer-ownership]', 'cancel POST failed', { message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
