import { getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../../../lib/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const { lineItems, restock, notify, reason, shipping, customAmount } = await request.json()

  // Custom amount refund — bypass line item calculation
  if (customAmount && Number(customAmount) > 0) {
    const txRes = await shopifyFetch(client, `/orders/${id}/transactions.json`)
    const txData = await txRes.json()
    const originalTx = (txData.transactions || []).find(t => t.kind === 'capture' || t.kind === 'sale' || t.kind === 'authorization')

    const transaction = originalTx
      ? { parent_id: originalTx.id, kind: 'refund', gateway: originalTx.gateway, amount: String(Number(customAmount).toFixed(2)) }
      : { kind: 'refund', amount: String(Number(customAmount).toFixed(2)) }

    const refundRes = await shopifyFetch(client, `/orders/${id}/refunds.json`, {
      method: 'POST',
      body: JSON.stringify({ refund: { notify: notify !== false, note: reason || '', transactions: [transaction] } }),
    })
    const refundData = await refundRes.json()
    if (!refundRes.ok) return NextResponse.json({ error: refundData.errors || 'Refund failed' }, { status: 502 })
    return NextResponse.json({ success: true, refund: refundData.refund })
  }

  // Line-item based refund (partial by qty or full)
  const refundLineItems = (lineItems || []).map(item => ({
    line_item_id: item.lineItemId,
    quantity: item.quantity,
    restock_type: restock ? 'return' : 'no_restock',
  }))

  const calcRes = await shopifyFetch(client, `/orders/${id}/refunds/calculate.json`, {
    method: 'POST',
    body: JSON.stringify({ refund: { shipping: { full_refund: !!shipping }, refund_line_items: refundLineItems } }),
  })
  const calcData = await calcRes.json()
  if (!calcRes.ok) return NextResponse.json({ error: calcData.errors || 'Calculation failed' }, { status: 502 })

  const transactions = (calcData.refund?.transactions || []).map(t => ({
    parent_id: t.parent_id, amount: t.amount, kind: 'refund', gateway: t.gateway,
  }))

  const refundRes = await shopifyFetch(client, `/orders/${id}/refunds.json`, {
    method: 'POST',
    body: JSON.stringify({
      refund: {
        notify: notify !== false,
        note: reason || '',
        shipping: { full_refund: !!shipping },
        refund_line_items: refundLineItems,
        transactions,
      },
    }),
  })
  const refundData = await refundRes.json()
  if (!refundRes.ok) return NextResponse.json({ error: refundData.errors || 'Refund failed' }, { status: 502 })
  return NextResponse.json({ success: true, refund: refundData.refund })
}
