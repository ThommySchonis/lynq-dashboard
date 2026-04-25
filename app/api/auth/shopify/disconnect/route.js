import { getUserFromToken, supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('integrations').delete().eq('client_id', user.id)
  await supabaseAdmin.from('shopify_orders').delete().eq('client_id', user.id)
  await supabaseAdmin.from('oauth_states').delete().eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
