import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Start of current month in Amsterdam timezone (UTC+1 CET / UTC+2 CEST)
  const now = new Date()
  const amsterdamNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  const startOfMonthAmsterdam = new Date(amsterdamNow.getFullYear(), amsterdamNow.getMonth(), 1, 0, 0, 0)
  // Convert back to UTC ISO string for comparison against stored UTC timestamps
  const offsetMs = now.getTime() - amsterdamNow.getTime()
  const startOfMonth = new Date(startOfMonthAmsterdam.getTime() + offsetMs).toISOString()

  // Get store currency — convert to EUR if needed (e.g. GBP store showing EUR analytics)
  let fxRate = 1
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('store_currency')
    .eq('client_id', user.id)
    .maybeSingle()

  const storeCurrency = integration?.store_currency || 'EUR'
  if (storeCurrency !== 'EUR') {
    try {
      const fxRes = await fetch(`https://api.frankfurter.app/latest?from=${storeCurrency}&to=EUR`)
      const fxData = await fxRes.json()
      fxRate = fxData.rates?.EUR || 1
    } catch {
      fxRate = 1
    }
  }

  const { data: allOrders, error } = await supabaseAdmin
    .from('shopify_orders')
    .select('subtotal_price, total_discounts, refund_amount, cancel_reason, financial_status, processed_at, created_at_shopify, source_name, presentment_currency')
    .eq('client_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })

  // Filter by processed_at in Amsterdam timezone, falling back to created_at_shopify
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

  const netRevenue = nonCancelled.reduce((s, o) => s + ((o.subtotal_price || 0) - (o.refund_amount || 0)) * fxRate, 0)
  const totalDiscounts = nonCancelled.reduce((s, o) => s + (o.total_discounts || 0) * fxRate, 0)
  const totalReturns = nonCancelled.reduce((s, o) => s + (o.refund_amount || 0) * fxRate, 0)
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
