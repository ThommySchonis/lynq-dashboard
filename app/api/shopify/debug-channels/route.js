import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orders, error } = await supabaseAdmin
    .from('shopify_orders')
    .select('id, order_number, source_name, subtotal_price, total_price, total_discounts, refund_amount, financial_status, cancel_reason, processed_at')
    .eq('client_id', user.id)
    .order('processed_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by source_name
  const channelMap = {}
  for (const o of orders) {
    const ch = o.source_name || 'web'
    if (!channelMap[ch]) {
      channelMap[ch] = {
        count: 0,
        subtotal_sum: 0,
        total_price_sum: 0,
        refund_sum: 0,
        cancelled_count: 0,
        sample: null,
      }
    }
    channelMap[ch].count++
    channelMap[ch].subtotal_sum += o.subtotal_price || 0
    channelMap[ch].total_price_sum += o.total_price || 0
    channelMap[ch].refund_sum += o.refund_amount || 0
    if (o.cancel_reason) channelMap[ch].cancelled_count++
    if (!channelMap[ch].sample) channelMap[ch].sample = o
  }

  const channels = Object.entries(channelMap).map(([name, v]) => ({
    source_name: name,
    order_count: v.count,
    cancelled: v.cancelled_count,
    subtotal_sum: v.subtotal_sum.toFixed(2),
    total_price_sum: v.total_price_sum.toFixed(2),
    refund_sum: v.refund_sum.toFixed(2),
    net_via_subtotal: (v.subtotal_sum - v.refund_sum).toFixed(2),
    net_via_total_price: (v.total_price_sum - v.refund_sum).toFixed(2),
    sample_order: v.sample,
  }))

  return NextResponse.json({ channels })
}
