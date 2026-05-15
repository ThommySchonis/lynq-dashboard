import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { resolveCredentials } from '../../../../lib/store-credentials'
import { syncOrders } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id')
  const full = searchParams.get('full') === 'true'

  const credentials = storeId
    ? await resolveCredentials(storeId, ctx.workspaceId)
    : await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  try {
    const result = await syncOrders(ctx.workspaceId, credentials, ctx.user.id, { full, storeId: storeId || undefined })
    return NextResponse.json({ success: true, synced: result.synced })
  } catch (err: unknown) {
    console.error('[sync] error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
