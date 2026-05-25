import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { updateStore, deleteStore } from '@/lib/services/stores'
import { validateBody, validateParams } from '@/lib/validation'
import { storeParams, updateStoreBody } from '@/lib/schemas/stores'

export async function PATCH(
  request: NextRequest,
  { params: routeParams }: RouteContext<{ id: string }>
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [params, paramErr] = validateParams(await routeParams, storeParams)
  if (paramErr) return paramErr

  const [body, bodyErr] = await validateBody(request, updateStoreBody)
  if (bodyErr) return bodyErr

  try {
    const store = await updateStore(params.id, ctx.workspaceId, { name: body.name })
    return NextResponse.json({ store })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params: routeParams }: RouteContext<{ id: string }>
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked2 = requireWriteAccess(ctx)
  if (blocked2) return blocked2

  const [params, paramErr] = validateParams(await routeParams, storeParams)
  if (paramErr) return paramErr

  try {
    await deleteStore(params.id, ctx.workspaceId)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
