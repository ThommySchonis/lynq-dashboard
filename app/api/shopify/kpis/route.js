import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyCredentials } from '../../../../lib/shopifyCredentials'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyCredentials(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  try {
    let orders = []
    let url = `https://${client.domain}/admin/api/2024-01/orders.json?status=any&limit=250&created_at_min=${startOfMonth}`

    while (url) {
      const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': client.accessToken } })
      if (!res.ok) return NextResponse.json({ error: 'Shopify API error' }, { status: 502 })
      const data = await res.json()
      orders = orders.concat(data.orders)

      const linkHeader = res.headers.get('link')
      const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
      url = nextMatch ? nextMatch[1] : null
    }

    const nonCancelled = orders.filter(o => !o.cancel_reason)
    const cancelledOrders = orders.filter(o => o.cancel_reason).length
    const totalOrders = nonCancelled.length

    const ordersWithRefunds = nonCancelled.filter(o => o.refunds && o.refunds.length > 0)
    const totalRefunds = ordersWithRefunds.length
    const refundAmount = ordersWithRefunds.reduce((sum, o) => {
      return sum + o.refunds.reduce((rs, r) => {
        return rs + (r.transactions || []).reduce((ts, t) => ts + parseFloat(t.amount || 0), 0)
      }, 0)
    }, 0)

    // Netto-omzet = subtotaal (na kortingen) − retouren, matching Shopify analytics
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
