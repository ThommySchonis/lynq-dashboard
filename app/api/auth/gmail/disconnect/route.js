import { getUserFromToken, supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Revoke token at Google before deleting
  const { data: gmailToken } = await supabaseAdmin
    .from('gmail_tokens')
    .select('access_token, refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (gmailToken?.access_token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${gmailToken.access_token}`, { method: 'POST' }).catch(() => {})
  }

  await supabaseAdmin.from('gmail_tokens').delete().eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
