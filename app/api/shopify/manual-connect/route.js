import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shop, accessToken } = await request.json()
  if (!shop || !accessToken) {
    return NextResponse.json({ error: 'Shop domain and access token are required' }, { status: 400 })
  }

  const shopDomain = shop.includes('.myshopify.com')
    ? shop.toLowerCase().trim()
    : `${shop.toLowerCase().trim()}.myshopify.com`

  // Verify the token actually works before saving
  const testRes = await fetch(
    `https://${shopDomain}/admin/api/2025-04/shop.json`,
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  )

  if (!testRes.ok) {
    return NextResponse.json({ error: 'Invalid token or store domain. Please check your credentials.' }, { status: 400 })
  }

  // Transition: dual-write client_id (legacy) + workspace_id, keep onConflict
  await supabaseAdmin.from('integrations').upsert({
    client_id:            ctx.user.id,
    workspace_id:         ctx.workspaceId,
    shopify_domain:       shopDomain,
    shopify_access_token: accessToken,
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  return NextResponse.json({ success: true, shop: shopDomain })
}

export async function DELETE(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('integrations').delete().eq('workspace_id', ctx.workspaceId)
  return NextResponse.json({ success: true })
}
