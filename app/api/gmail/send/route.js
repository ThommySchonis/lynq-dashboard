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
    .maybeSingle()

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

  // Strip HTML tags for plain-text fallback
  const plainText = body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
  const isHtml = /<[a-z][\s\S]*>/i.test(body)

  // Build RFC 2822 multipart email (plain + HTML)
  const boundary = `lynq_${Date.now()}`
  let headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ]
  if (replyToMessageId) {
    headers.push(`In-Reply-To: ${replyToMessageId}`)
    headers.push(`References: ${replyToMessageId}`)
  }

  let emailBody
  if (isHtml) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    emailBody = [
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      plainText,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      `<html><body style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${body}</body></html>`,
      '',
      `--${boundary}--`,
    ].join('\r\n')
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8')
    emailBody = '\r\n' + plainText
  }

  const raw = Buffer.from(headers.join('\r\n') + emailBody)
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
