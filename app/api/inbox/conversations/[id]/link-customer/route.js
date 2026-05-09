import { getAuthContext } from '../../../../../../lib/auth'
import { linkCustomer } from '../../../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if (!body.shopifyCustomerId) {
    return NextResponse.json({ error: 'shopifyCustomerId required' }, { status: 400 })
  }

  try {
    const result = await linkCustomer(ctx.workspaceId, id, body.shopifyCustomerId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
