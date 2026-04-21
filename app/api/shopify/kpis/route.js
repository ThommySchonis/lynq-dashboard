import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const isDST = now.getMonth() >= 2 && now.getMonth() <= 9
  const offsetHours = isDST ? 2 : 1
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1) - offsetHours * 3600000).toISOString()

  const { data: allOrders, error } = await supabaseAdmin
    .from('shopify_orders')
    .select('subtotal_price, refund_amount, cancel_reason, financial_status, processed_at, created_at_shopify')
    .eq('client_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })

  // Filter by date using processed_at, falling back to created_at_shopify
  const orders = (allOrders || []).filter(o => {
    const date = o.processed_at || o.created_at_shopify
    return date && date >= startOfMonth
  })

  if (orders.length === 0) {
    return NextResponse.json({
      totalOrders: 0, totalRevenue: '0', cancelledOrders: 0,
      totalRefunds: 0, refundAmount: '0', refundRate: '0.0', refundPct: '0.0',
      needsSync: true,
    })
  }

  const totalOrders = orders.length
  const cancelledOrders = orders.filter(o => o.cancel_reason).length
  const nonCancelled = orders.filter(o => !o.cancel_reason)

  const totalRefundAmount = nonCancelled.reduce((s, o) => s + (o.refund_amount || 0), 0)
  const totalRevenue = nonCancelled.reduce((s, o) => s + (o.subtotal_price || 0), 0) - totalRefundAmount
  const totalRefunds = nonCancelled.filter(o => o.refund_amount > 0).length

  const refundRate = totalOrders > 0 ? ((totalRefunds / totalOrders) * 100).toFixed(1) : '0.0'
  const refundPct = totalRevenue > 0 ? ((totalRefundAmount / totalRevenue) * 100).toFixed(1) : '0.0'

  return NextResponse.json({
    totalOrders,
    totalRevenue: totalRevenue.toFixed(0),
    cancelledOrders,
    totalRefunds,
    refundAmount: totalRefundAmount.toFixed(0),
    refundRate,
    refundPct,
  })
}
