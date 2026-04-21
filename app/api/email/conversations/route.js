import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'open'

  const { data: conversations } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('client_id', user.id)
    .eq('status', status)
    .order('last_message_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ conversations: conversations || [] })
}
