import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { getAuthContext } from '@/lib/auth'
import { deleteStoreEmailAccount } from '@/lib/services/stores'
import { validateParams } from '@/lib/validation'
import { emailConfigParams } from '@/lib/schemas/stores'

export async function DELETE(
  request: NextRequest,
  { params: routeParams }: RouteContext<{ id: string; configId: string }>
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [params, paramErr] = validateParams(await routeParams, emailConfigParams)
  if (paramErr) return paramErr

  try {
    await deleteStoreEmailAccount(params.configId, params.id, ctx.workspaceId)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
