import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateBody } from '@/lib/validation'
import { shopifyManualConnectBody } from '@/lib/schemas/shopify'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [body, bErr] = await validateBody(request, shopifyManualConnectBody)
  if (bErr) return bErr

  const shopDomain = body.shop.includes('.myshopify.com')
    ? body.shop.toLowerCase().trim()
    : `${body.shop.toLowerCase().trim()}.myshopify.com`

  // Verify the token actually works before saving
  const testRes = await fetch(
    `https://${shopDomain}/admin/api/2025-04/shop.json`,
    { headers: { 'X-Shopify-Access-Token': body.accessToken } }
  )

  if (!testRes.ok) {
    return NextResponse.json({ error: 'Invalid token or store domain. Please check your credentials.' }, { status: 400 })
  }

  // Transition: dual-write client_id (legacy) + workspace_id, keep onConflict
  await supabaseAdmin.from('integrations').upsert({
    client_id:            ctx.user.id,
    workspace_id:         ctx.workspaceId,
    shopify_domain:       shopDomain,
    shopify_access_token: body.accessToken,
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  return NextResponse.json({ success: true, shop: shopDomain })
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked2 = requireWriteAccess(ctx)
  if (blocked2) return blocked2

  await supabaseAdmin.from('integrations').update({
    shopify_domain: null,
    shopify_access_token: null,
    shopify_connected_at: null,
  }).eq('workspace_id', ctx.workspaceId)
  return NextResponse.json({ success: true })
}
