import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { cancelAccountDeletion } from '@/lib/services/account-deletion'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await cancelAccountDeletion(ctx.user.id, ctx.user.email ?? '')
    return NextResponse.json({ cancelled: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel deletion'
    console.error('[account/cancel-deletion POST]', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
