import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { checkEmailLimit, incrementEmailCount } from '../../../../lib/emailUsage'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limitCheck = await checkEmailLimit(user.email)
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: 'Email limit reached',
      code: 'EMAIL_LIMIT_REACHED',
      used: limitCheck.used,
      limit: limitCheck.limit,
      plan: limitCheck.plan,
    }, { status: 429 })
  }

  const { to, subject, body, threadId, replyToMessageId, tags } = await request.json()

  const { data: gmailToken } = await supabaseAdmin
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!gmailToken) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })

  // Refresh token if expired
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

  // Build RFC 2822 email
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ]

  if (replyToMessageId) {
    emailLines.splice(2, 0, `In-Reply-To: ${replyToMessageId}`)
    emailLines.splice(3, 0, `References: ${replyToMessageId}`)
  }

  const raw = Buffer.from(emailLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const sendBody = { raw }
  if (threadId) sendBody.threadId = threadId

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sendBody),
  })

  const result = await res.json()
  if (!res.ok) return NextResponse.json({ error: result.error?.message || 'Send failed' }, { status: 500 })

  await incrementEmailCount(user.email)

  // Log sent email with tags to Supabase (only for new emails, not replies)
  if (!threadId && tags) {
    await supabaseAdmin.from('sent_emails').insert({
      user_id: user.id,
      to_email: to,
      subject,
      body,
      tags,
    })
  }

  return NextResponse.json({ success: true, messageId: result.id })
}
