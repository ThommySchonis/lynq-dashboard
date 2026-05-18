import { getAuthContext } from '../../../../lib/auth'
import { getStoreCredentials } from '../../../../lib/store-credentials'
import { syncOrders } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id')
  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 })
  }
  const full = searchParams.get('full') === 'true'

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)

  try {
    const result = await syncOrders(ctx.workspaceId, credentials, ctx.user.id, { full, storeId })
    return NextResponse.json({ success: true, synced: result.synced })
  } catch (err: unknown) {
    console.error('[sync] error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
