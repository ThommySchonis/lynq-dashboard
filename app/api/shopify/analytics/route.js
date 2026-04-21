import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
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
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const since = `${year}-${month}-01`
  const until = now.toISOString().split('T')[0]

  const query = `
    FROM orders
    SHOW
      sum(net_sales) AS net_sales,
      sum(gross_sales) AS gross_sales,
      sum(discounts) AS discounts,
      sum(returns) AS returns,
      count(orders) AS total_orders
    SINCE ${since} UNTIL ${until}
  `

  const res = await fetch(`https://${client.domain}/admin/api/2024-01/shopify_ql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': client.accessToken,
    },
    body: JSON.stringify({ query }),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: 'ShopifyQL failed', detail: data }, { status: 500 })
  }

  return NextResponse.json({ raw: data, query })
}
