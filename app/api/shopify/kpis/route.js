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
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const query = `
    FROM orders
    WHERE order_date >= '${startOfMonth}' AND order_date <= '${today}'
    SELECT
      count(order_id) AS total_orders,
      sum(gross_sales) AS gross_sales,
      sum(discounts) AS discounts,
      sum(returns) AS returns,
      sum(net_sales) AS net_sales,
      count(order_id, financial_status = 'refunded' OR financial_status = 'partially_refunded') AS total_refunds
  `

  try {
    const res = await fetch(`https://${client.domain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': client.accessToken,
      },
      body: JSON.stringify({
        query: `{
          shopifyqlQuery(query: ${JSON.stringify(query)}) {
            ... on TableResponse {
              tableData {
                columns { name }
                rowData
              }
            }
            ... on ParseErrorResponse {
              parseErrors { code message range { start { line column } } }
            }
          }
        }`,
      }),
    })

    const json = await res.json()
    const tableData = json?.data?.shopifyqlQuery?.tableData

    if (!tableData) {
      const errors = json?.data?.shopifyqlQuery?.parseErrors
      return NextResponse.json({ error: 'ShopifyQL error', details: errors }, { status: 502 })
    }

    const cols = tableData.columns.map(c => c.name)
    const row = tableData.rowData[0] || []
    const get = (name) => parseFloat(row[cols.indexOf(name)] || 0)

    const totalOrders = Math.round(get('total_orders'))
    const netSales = get('net_sales')
    const grossSales = get('gross_sales')
    const discounts = Math.abs(get('discounts'))
    const returns = Math.abs(get('returns'))
    const totalRefunds = Math.round(get('total_refunds'))

    const refundRate = totalOrders > 0 ? ((totalRefunds / totalOrders) * 100).toFixed(1) : '0.0'

    return NextResponse.json({
      totalOrders,
      totalRevenue: netSales.toFixed(0),
      grossSales: grossSales.toFixed(0),
      discounts: discounts.toFixed(0),
      returns: returns.toFixed(0),
      totalRefunds,
      refundRate,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch Shopify analytics' }, { status: 500 })
  }
}
