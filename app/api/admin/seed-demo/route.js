import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { DEMO_SHOP, DEMO_EMAIL, DEMO_PASSWORD, getDemoShopifyOrderRows } from '../../../../lib/demoData'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const caller = await getUserFromToken(token)
  if (!caller || caller.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admin only', email: caller?.email ?? null }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  let userId = body.user_id

  if (!userId && body.email) {
    const { data } = await supabaseAdmin.auth.admin.listUsers()
    const found = data?.users?.find(u => u.email === body.email)
    if (!found) return NextResponse.json({ error: `No user found with email ${body.email}` }, { status: 404 })
    userId = found.id
  }

  if (!userId) return NextResponse.json({ error: 'Missing user_id or email in body' }, { status: 400 })

  // Mark onboarding as completed so demo user lands on inbox directly
  await supabaseAdmin.from('profiles').upsert({ id: userId, onboarding_completed: true })

  // Insert/update integrations row (marks Shopify as connected)
  await supabaseAdmin.from('integrations').upsert({
    client_id: userId,
    shopify_domain: DEMO_SHOP,
    shopify_access_token: 'demo_token_not_real',
    shopify_scope: 'read_orders,read_customers,read_products',
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  // Seed shopify_orders for KPIs
  const rows = getDemoShopifyOrderRows(userId)
  await supabaseAdmin.from('shopify_orders').upsert(rows, { onConflict: 'id,client_id' })

  return NextResponse.json({
    success: true,
    userId,
    email: DEMO_EMAIL,
    shop: DEMO_SHOP,
    ordersSeeded: rows.length,
  })
}
