import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getAccountDeletionStatus } from '@/lib/services/account-deletion'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await getAccountDeletionStatus(ctx.user.id)
  return NextResponse.json(status)
}
