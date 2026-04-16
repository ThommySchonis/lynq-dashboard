import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  await supabaseAdmin
    .from('integrations')
    .upsert({ user_id: user.id, ...body }, { onConflict: 'user_id' })

  return NextResponse.json({ success: true })
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_connected_at, parcelpanel_api_key')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    shopify: !!data?.shopify_domain,
    shopifyDomain: data?.shopify_domain || null,
    parcelpanel: !!data?.parcelpanel_api_key,
  })
}
