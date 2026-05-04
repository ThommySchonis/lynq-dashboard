import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_KPIS } from '../../../../lib/demoData'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (creds?.domain === DEMO_SHOP) return NextResponse.json(DEMO_KPIS)

  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  let startOfMonth, endDate

  if (fromParam && toParam) {
    // Caller-supplied date range: treat as UTC day boundaries
    startOfMonth = new Date(fromParam).toISOString()
    endDate = new Date(toParam + 'T23:59:59.999Z').toISOString()
  } else {
    // Default: start of current month in Amsterdam timezone
    const now = new Date()
    const amsterdamNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
    const startOfMonthAmsterdam = new Date(amsterdamNow.getFullYear(), amsterdamNow.getMonth(), 1, 0, 0, 0)
    const offsetMs = now.getTime() - amsterdamNow.getTime()
    startOfMonth = new Date(startOfMonthAmsterdam.getTime() + offsetMs).toISOString()
    endDate = null
  }

  let query = supabaseAdmin
    .from('shopify_orders')
    .select('subtotal_price, total_discounts, refund_amount, cancel_reason, financial_status, processed_at, created_at_shopify, source_name')
    .eq('workspace_id', ctx.workspaceId)

  if (endDate) {
    query = query.gte('processed_at', startOfMonth).lte('processed_at', endDate)
  }

  const { data: allOrders, error } = await query

  if (error) return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })

  // When no explicit range is given, filter client-side to handle fallback to created_at_shopify
  const orders = endDate
    ? (allOrders || [])
    : (allOrders || []).filter(o => {
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

  const netRevenue = nonCancelled.reduce((s, o) => s + (o.subtotal_price || 0) - (o.refund_amount || 0), 0)
  const totalDiscounts = nonCancelled.reduce((s, o) => s + (o.total_discounts || 0), 0)
  const totalReturns = nonCancelled.reduce((s, o) => s + (o.refund_amount || 0), 0)
  const totalRefunds = nonCancelled.filter(o => o.refund_amount > 0).length
  const refundRate = totalOrders > 0 ? ((totalRefunds / totalOrders) * 100).toFixed(1) : '0.0'
  const refundPct = netRevenue > 0 ? ((totalReturns / netRevenue) * 100).toFixed(1) : '0.0'

  return NextResponse.json({
    totalOrders,
    cancelledOrders,
    totalRefunds,
    refundRate,
    refundPct,
    netRevenue: netRevenue.toFixed(0),
    totalRevenue: netRevenue.toFixed(0),
    discounts: totalDiscounts.toFixed(0),
    returns: totalReturns.toFixed(0),
    refundAmount: totalReturns.toFixed(0),
  })
}
