import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { syncOrders } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { shopifySyncQuery } from '@/lib/schemas/shopify'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, shopifySyncQuery)
  if (qErr) return qErr

  const full = query.full === 'true'
  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)

  try {
    const result = await syncOrders(ctx.workspaceId, credentials, ctx.user.id, { full, storeId: query.store_id })
    return NextResponse.json({ success: true, synced: result.synced })
  } catch (err: unknown) {
    console.error('[sync] error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
