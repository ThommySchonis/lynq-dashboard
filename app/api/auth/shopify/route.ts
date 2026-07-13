import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { CANONICAL_SHOPIFY_SCOPES } from '@/lib/shopify-scopes'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.SHOPIFY_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Shopify app not configured' }, { status: 500 })

  let body: { shop?: string; store_name?: string }
  try {
    body = (await request.json()) as { shop?: string; store_name?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { shop, store_name } = body
  if (!shop) return NextResponse.json({ error: 'shop is required' }, { status: 400 })

  const shopDomain = shop.includes('.myshopify.com')
    ? shop.toLowerCase().trim()
    : `${shop.toLowerCase().trim()}.myshopify.com`

  const state = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { error: stateError } = await supabaseAdmin.from('oauth_states').insert({
    state,
    user_id: ctx.user.id,
    workspace_id: ctx.workspaceId,
    shop: shopDomain,
    expires_at: expiresAt,
    store_name: store_name || null,
  })

  if (stateError) {
    logger.error('[shopify/auth]', 'oauth_states insert failed', { error: stateError.message })
    return NextResponse.json({ error: 'Failed to initiate OAuth: ' + stateError.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const redirectUri = `${appUrl}/api/auth/shopify/callback`

  const authUrl =
    `https://${shopDomain}/admin/oauth/authorize?` +
    new URLSearchParams({
      client_id: clientId,
      scope: CANONICAL_SHOPIFY_SCOPES,
      redirect_uri: redirectUri,
      state,
    }).toString()

  return NextResponse.json({ url: authUrl })
}
