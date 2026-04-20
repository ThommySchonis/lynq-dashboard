import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// Called when user confirms linking a pending Shopify token to their account
// Used when OAuth came from a Custom distribution install link
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shop } = await request.json()
  if (!shop) return NextResponse.json({ error: 'Missing shop' }, { status: 400 })

  const { data: pending } = await supabaseAdmin
    .from('pending_shopify_tokens')
    .select('*')
    .eq('shop', shop)
    .maybeSingle()

  if (!pending || new Date(pending.expires_at) < new Date()) {
    return NextResponse.json({ error: 'No pending token found or it expired. Please reconnect.' }, { status: 404 })
  }

  await supabaseAdmin.from('integrations').upsert({
    user_id: user.id,
    shopify_domain: shop,
    shopify_access_token: pending.access_token,
    shopify_scope: pending.scope,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  await supabaseAdmin.from('pending_shopify_tokens').delete().eq('shop', shop)

  return NextResponse.json({ success: true })
}
