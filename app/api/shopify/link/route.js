import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

function normalizeShopDomain(shop) {
  const value = String(shop || '').trim().toLowerCase()
  const domain = value.endsWith('.myshopify.com') ? value : `${value}.myshopify.com`
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : ''
}

// Called when user confirms linking a pending Shopify token to their account
// Used when OAuth came from a Custom distribution install link
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shop } = await request.json()
  const shopDomain = normalizeShopDomain(shop)
  if (!shopDomain) return NextResponse.json({ error: 'Invalid shop' }, { status: 400 })

  const { data: pending } = await supabaseAdmin
    .from('pending_shopify_tokens')
    .select('*')
    .eq('shop', shopDomain)
    .maybeSingle()

  if (!pending || new Date(pending.expires_at) < new Date()) {
    return NextResponse.json({ error: 'No pending token found or it expired. Please reconnect.' }, { status: 404 })
  }

  // Transition: dual-write client_id (legacy) + workspace_id, keep onConflict
  await supabaseAdmin.from('integrations').upsert({
    client_id:            ctx.user.id,
    workspace_id:         ctx.workspaceId,
    shopify_domain:       shopDomain,
    shopify_access_token: pending.access_token,
    shopify_scope:        pending.scope,
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  await supabaseAdmin.from('pending_shopify_tokens').delete().eq('shop', shopDomain)

  return NextResponse.json({ success: true })
}
