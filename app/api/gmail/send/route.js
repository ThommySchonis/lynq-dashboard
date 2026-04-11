import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, subject, body, threadId, replyToMessageId } = await request.json()

  const { data: gmailToken } = await supabaseAdmin
    .from('gmail_tokens')
    .select('*')
    .eq('email', user.email)
    .single()

  if (!gmailToken) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })

  const accessToken = gmailToken.access_token

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

  return NextResponse.json({ success: true, messageId: result.id })
}
