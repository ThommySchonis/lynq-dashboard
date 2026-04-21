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
  if (!client) return NextResponse.json({ error: 'Not configured' }, { status: 400 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  let orders = []
  let url = `https://${client.domain}/admin/api/2024-01/orders.json?status=any&limit=250&created_at_min=${startOfMonth}`

  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': client.accessToken } })
    const data = await res.json()
    orders = orders.concat(data.orders)
    const link = res.headers.get('link')
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }

  const sample = orders.slice(0, 3).map(o => ({
    name: o.name,
    financial_status: o.financial_status,
    cancel_reason: o.cancel_reason,
    subtotal_price: o.subtotal_price,
    current_subtotal_price: o.current_subtotal_price,
    total_price: o.total_price,
    total_discounts: o.total_discounts,
  }))

  const sumSubtotal = orders.filter(o => !o.cancel_reason).reduce((s, o) => s + parseFloat(o.subtotal_price || 0), 0)
  const sumCurrentSubtotal = orders.filter(o => !o.cancel_reason).reduce((s, o) => s + parseFloat(o.current_subtotal_price || 0), 0)
  const sumTotalPrice = orders.filter(o => !o.cancel_reason).reduce((s, o) => s + parseFloat(o.total_price || 0), 0)

  return NextResponse.json({
    totalFetched: orders.length,
    cancelled: orders.filter(o => o.cancel_reason).length,
    sumSubtotal: sumSubtotal.toFixed(2),
    sumCurrentSubtotal: sumCurrentSubtotal.toFixed(2),
    sumTotalPrice: sumTotalPrice.toFixed(2),
    sample,
  })
}
