import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { getAuthContext } from '@/lib/auth'
import { listStoreEmailAccounts } from '@/lib/services/stores'
import { validateParams } from '@/lib/validation'
import { storeParams } from '@/lib/schemas/stores'

export async function GET(
  request: NextRequest,
  { params: routeParams }: RouteContext<{ id: string }>
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [params, paramErr] = validateParams(await routeParams, storeParams)
  if (paramErr) return paramErr

  try {
    const configs = await listStoreEmailAccounts(params.id, ctx.workspaceId)
    return NextResponse.json({ configs })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
