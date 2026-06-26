import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { getAuthContext } from '@/lib/auth'
import { revokeUserConnection } from '@/lib/services/oauth-connections'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function DELETE(request: NextRequest, { params }: RouteContext<{ clientId: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId } = await params
  try {
    const revoked = await revokeUserConnection(supabaseAdmin as never, ctx.user.id, clientId)
    return NextResponse.json({ revoked })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
