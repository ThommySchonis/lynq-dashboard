import { getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../../../lib/shopify'
import { NextResponse } from 'next/server'

// POST — begin edit, apply changes, commit
export async function POST(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  // lineItems: [{ lineItemId, quantity }] — quantity 0 = remove
  // reason: string
  // notify: boolean
  const { lineItems, reason, notify } = await request.json()

  // Step 1: begin edit
  const beginRes = await shopifyFetch(client, `/orders/${id}/edits.json`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const beginData = await beginRes.json()
  if (!beginRes.ok) {
    return NextResponse.json({ error: beginData.errors || 'Could not begin edit' }, { status: 502 })
  }

  const editId = beginData.order_edit?.id
  if (!editId) return NextResponse.json({ error: 'No edit session returned' }, { status: 502 })

  // Step 2: set quantities for each changed line item
  for (const item of (lineItems || [])) {
    const setRes = await shopifyFetch(
      client,
      `/order_edits/${editId}/line_items/${item.lineItemId}/set_quantity.json`,
      {
        method: 'POST',
        body: JSON.stringify({ quantity: item.quantity, restock: true }),
      }
    )
    if (!setRes.ok) {
      const err = await setRes.json()
      console.error('[edit order] set_quantity failed:', err)
    }
  }

  // Step 3: commit the edit
  const commitRes = await shopifyFetch(client, `/order_edits/${editId}/commit.json`, {
    method: 'POST',
    body: JSON.stringify({
      order_edit: {
        notify_customer: notify !== false,
        staff_note: reason || 'Order updated via support agent',
      },
    }),
  })

  const commitData = await commitRes.json()
  if (!commitRes.ok) {
    return NextResponse.json({ error: commitData.errors || 'Commit failed' }, { status: 502 })
  }

  return NextResponse.json({ success: true, orderEdit: commitData.order_edit })
}
