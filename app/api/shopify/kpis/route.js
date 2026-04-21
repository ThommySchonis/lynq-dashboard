import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyCredentials } from '../../../../lib/shopifyCredentials'
import { NextResponse } from 'next/server'

async function fetchAllOrders(domain, accessToken, dateFilter, dateValue) {
  let orders = []
  let url = `https://${domain}/admin/api/2024-01/orders.json?status=any&limit=250&${dateFilter}=${dateValue}`
  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } })
    if (!res.ok) return null
    const data = await res.json()
    orders = orders.concat(data.orders)
    const link = res.headers.get('link')
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }
  return orders
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyCredentials(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const now = new Date()
  // Start of month in Amsterdam timezone (UTC+2 in summer, UTC+1 in winter)
  const isDST = now.getMonth() >= 2 && now.getMonth() <= 9
  const offsetHours = isDST ? 2 : 1
  const startOfMonthUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1) - offsetHours * 3600000)
  const dateValue = startOfMonthUTC.toISOString()

  try {
    // Fetch by created_at and processed_at, merge and deduplicate
    const [byCreated, byProcessed] = await Promise.all([
      fetchAllOrders(client.domain, client.accessToken, 'created_at_min', dateValue),
      fetchAllOrders(client.domain, client.accessToken, 'processed_at_min', dateValue),
    ])

    if (!byCreated || !byProcessed) {
      return NextResponse.json({ error: 'Shopify API error' }, { status: 502 })
    }

    // Deduplicate by order ID
    const orderMap = new Map()
    for (const o of [...byCreated, ...byProcessed]) orderMap.set(o.id, o)
    const orders = Array.from(orderMap.values())

    const cancelledOrders = orders.filter(o => o.cancel_reason).length
    const totalOrders = orders.length
    const nonCancelled = orders.filter(o => !o.cancel_reason)

    const ordersWithRefunds = nonCancelled.filter(o => o.refunds && o.refunds.length > 0)
    const totalRefunds = ordersWithRefunds.length
    const refundAmount = ordersWithRefunds.reduce((sum, o) => {
      return sum + o.refunds.reduce((rs, r) => {
        return rs + (r.transactions || []).reduce((ts, t) => ts + parseFloat(t.amount || 0), 0)
      }, 0)
    }, 0)

    const totalRevenue = nonCancelled.reduce((sum, o) => sum + parseFloat(o.subtotal_price || 0), 0) - refundAmount

    const refundRate = totalOrders > 0 ? ((totalRefunds / totalOrders) * 100).toFixed(1) : '0.0'
    const refundPct = totalRevenue > 0 ? ((refundAmount / totalRevenue) * 100).toFixed(1) : '0.0'

    return NextResponse.json({
      totalOrders,
      totalRevenue: totalRevenue.toFixed(0),
      cancelledOrders,
      totalRefunds,
      refundAmount: refundAmount.toFixed(0),
      refundRate,
      refundPct,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch Shopify data' }, { status: 500 })
  }
}
