import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { threadId } = await request.json()
  if (!threadId) return NextResponse.json({ error: 'Missing threadId' }, { status: 400 })

  const { data: gmailToken } = await supabaseAdmin
    .from('gmail_tokens')
    .select('access_token, expires_at, refresh_token')
    .eq('user_id', user.id)
    .single()

  if (!gmailToken) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })

  let accessToken = gmailToken.access_token
  if (new Date(gmailToken.expires_at) < new Date()) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID?.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
        refresh_token: gmailToken.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const refreshData = await refreshRes.json()
    if (!refreshData.access_token) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
    accessToken = refreshData.access_token
    await supabaseAdmin.from('gmail_tokens').update({
      access_token: accessToken,
      expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
    }).eq('user_id', user.id)
  }

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/trash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ error: err.error?.message || 'Trash failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
