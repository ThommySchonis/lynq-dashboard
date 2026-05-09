import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { syncOrders } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const full = searchParams.get('full') === 'true'

  try {
    const result = await syncOrders(ctx.workspaceId, client, ctx.user.id, { full })
    return NextResponse.json({ success: true, synced: result.synced })
  } catch (err) {
    console.error('[sync] error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
