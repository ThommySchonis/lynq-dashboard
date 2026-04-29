import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { checkEmailLimit, incrementEmailCount } from '../../../../lib/emailUsage'
import { NextResponse } from 'next/server'

function hasHeaderInjection(value) {
  return /[\r\n]/.test(String(value || ''))
}

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

  const { to, subject, body, replyToMessageId } = await request.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  if (!replyToMessageId && (!to || !subject)) {
    return NextResponse.json({ error: 'to and subject are required for new messages' }, { status: 400 })
  }
  if ([to, subject, replyToMessageId].some(hasHeaderInjection)) {
    return NextResponse.json({ error: 'Invalid email header value' }, { status: 400 })
  }

  const { data: outlookToken } = await supabaseAdmin
    .from('outlook_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!outlookToken) return NextResponse.json({ error: 'Outlook not connected' }, { status: 400 })

  let accessToken = outlookToken.access_token
  if (new Date(outlookToken.expires_at) < new Date()) {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: outlookToken.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!data.access_token) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
    accessToken = data.access_token
    await supabaseAdmin.from('outlook_tokens').update({
      access_token: accessToken,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq('user_id', user.id)
  }

  const endpoint = replyToMessageId
    ? `https://graph.microsoft.com/v1.0/me/messages/${replyToMessageId}/reply`
    : 'https://graph.microsoft.com/v1.0/me/sendMail'

  const messagePayload = replyToMessageId
    ? { comment: body }
    : {
        message: {
          subject,
          body: { contentType: 'HTML', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messagePayload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: err?.error?.message || 'Send failed' }, { status: 500 })
  }

  await incrementEmailCount(user.email)

  return NextResponse.json({ success: true })
}
