import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../lib/auth'
import { supabaseAdmin }  from '../../../../../lib/supabaseAdmin'

// Per ONBOARDING_SPEC v1.1 §6.1: pure UI / intent-saving endpoint voor
// /settings/integrations/shopify. Slaat alleen het store-domein op met
// status='pending'. Echte OAuth + access_token komt via /api/auth/shopify
// callback later.
//
// GET  → huidige integration row voor deze workspace ({ domain, status,
//        shopify_connected_at })
// POST → upsert { domain }; zet status='pending', wist eventuele oude
//        access_token fields zodat een nieuwe connect-flow volgt.

function normalizeShopDomain(shop) {
  const raw = String(shop || '').trim().toLowerCase()
  if (!raw) return ''
  const domain = raw.endsWith('.myshopify.com') ? raw : `${raw}.myshopify.com`
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : ''
}

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_connected_at, status')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  return NextResponse.json({
    domain:       data?.shopify_domain ?? null,
    status:       data?.status ?? 'not_connected',
    connected_at: data?.shopify_connected_at ?? null,
  })
}

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json().catch(() => ({}))
  const domain = normalizeShopDomain(body?.domain)
  if (!domain) {
    return NextResponse.json(
      { error: 'Valid Shopify store URL is required (e.g. your-store.myshopify.com)' },
      { status: 400 }
    )
  }

  // Intent-only upsert. shopify_access_token + scope + client_secret +
  // connected_at worden expliciet op null gezet zodat een eerder echte
  // connect niet als "still connected" blijft hangen onder een nieuw domein.
  // Dual-write client_id (Block C transitiepatroon) + workspace_id.
  const { error } = await supabaseAdmin
    .from('integrations')
    .upsert({
      client_id:             ctx.user.id,
      workspace_id:          ctx.workspaceId,
      shopify_domain:        domain,
      shopify_access_token:  null,
      shopify_scope:         null,
      shopify_client_secret: null,
      shopify_connected_at:  null,
      status:                'pending',
    }, { onConflict: 'client_id' })

  if (error) {
    console.error('[settings/integrations/shopify POST] upsert failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'save_failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok:      true,
    domain,
    status:  'pending',
    message: 'Settings saved. Connection will activate when integration is live.',
  })
}
