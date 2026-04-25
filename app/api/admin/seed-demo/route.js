import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { DEMO_SHOP, DEMO_EMAIL, DEMO_PASSWORD, getDemoShopifyOrderRows } from '../../../../lib/demoData'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // 1. Create demo auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })

  let userId
  if (authError) {
    if (authError.message?.includes('already been registered')) {
      // User exists — fetch the ID
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
      const found = existing?.users?.find(u => u.email === DEMO_EMAIL)
      if (!found) return NextResponse.json({ error: 'User exists but could not find ID' }, { status: 500 })
      userId = found.id
    } else {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }
  } else {
    userId = authData.user.id
  }

  // 2. Insert/update integrations row (marks Shopify as connected)
  await supabaseAdmin.from('integrations').upsert({
    client_id: userId,
    shopify_domain: DEMO_SHOP,
    shopify_access_token: 'demo_token_not_real',
    shopify_scope: 'read_orders,read_customers,read_products',
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  // 3. Seed shopify_orders for KPIs
  const rows = getDemoShopifyOrderRows(userId)
  await supabaseAdmin.from('shopify_orders').upsert(rows, { onConflict: 'id,client_id' })

  return NextResponse.json({
    success: true,
    userId,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    shop: DEMO_SHOP,
    ordersSeeded: rows.length,
  })
}
