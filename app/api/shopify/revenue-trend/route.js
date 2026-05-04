import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_TREND } from '../../../../lib/demoData'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (creds?.domain === DEMO_SHOP) return NextResponse.json({ trend: DEMO_TREND })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ trend: [] })

  const { data, error } = await supabaseAdmin
    .from('shopify_orders')
    .select('processed_at, created_at_shopify, subtotal_price, refund_amount, cancel_reason')
    .eq('workspace_id', ctx.workspaceId)
    .gte('processed_at', from)
    .lte('processed_at', to + 'T23:59:59.999Z')

  if (error) return NextResponse.json({ trend: [] })

  const dayMap = {}
  for (const o of data || []) {
    if (o.cancel_reason) continue
    const date = (o.processed_at || o.created_at_shopify || '').slice(0, 10)
    if (!date || date < from || date > to) continue
    if (!dayMap[date]) dayMap[date] = 0
    dayMap[date] += (o.subtotal_price || 0) - (o.refund_amount || 0)
  }

  // Fill every day in range with 0 if no orders
  const trend = []
  const cur = new Date(from)
  const end = new Date(to)
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10)
    trend.push({ date: d, revenue: Math.max(0, dayMap[d] || 0) })
    cur.setDate(cur.getDate() + 1)
  }

  return NextResponse.json({ trend })
}
