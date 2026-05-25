import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { disconnectStore } from '@/lib/services/stores'
import { validateParams } from '@/lib/validation'
import { storeParams } from '@/lib/schemas/stores'

export async function POST(
  request: NextRequest,
  { params: routeParams }: RouteContext<{ id: string }>
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [params, paramErr] = validateParams(await routeParams, storeParams)
  if (paramErr) return paramErr

  try {
    await disconnectStore(params.id, ctx.workspaceId)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
