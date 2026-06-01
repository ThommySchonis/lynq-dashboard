import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { updateOrderNote, ShopifyApiError } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { validateQuery, validateParams, validateBody } from '@/lib/validation'
import { shopifyStoreQuery, shopifyOrderParams, updateNoteBody } from '@/lib/schemas/shopify'

export async function PUT(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [query, qErr] = validateQuery(request, shopifyStoreQuery)
  if (qErr) return qErr

  const [p, pErr] = validateParams(await params, shopifyOrderParams)
  if (pErr) return pErr

  const [body, bErr] = await validateBody(request, updateNoteBody)
  if (bErr) return bErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Store not connected to Shopify' }, { status: 422 })

  try {
    await updateOrderNote(credentials, p.id, body as Parameters<typeof updateOrderNote>[2])
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}
