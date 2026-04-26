import { getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../../../lib/shopify'
import { NextResponse } from 'next/server'

export async function PUT(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const { note, tags } = await request.json()

  const body = { order: { id: Number(id) } }
  if (note !== undefined) body.order.note = note
  if (tags !== undefined) body.order.tags = tags

  const res = await shopifyFetch(client, `/orders/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.errors || 'Save failed' }, { status: 502 })

  return NextResponse.json({ success: true })
}
