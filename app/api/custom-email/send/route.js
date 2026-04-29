import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { decrypt } from '../../../../lib/encryption'
import { checkEmailLimit, incrementEmailCount } from '../../../../lib/emailUsage'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

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
  if (!to || !subject || !body) return NextResponse.json({ error: 'to, subject and body are required' }, { status: 400 })
  if ([to, subject, replyToMessageId].some(hasHeaderInjection)) {
    return NextResponse.json({ error: 'Invalid email header value' }, { status: 400 })
  }

  const { data: creds } = await supabaseAdmin
    .from('custom_email_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!creds) return NextResponse.json({ error: 'Custom email not connected' }, { status: 400 })

  let password
  try {
    password = decrypt(creds.encrypted_password)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 })
  }

  const transporter = nodemailer.createTransport({
    host: creds.smtp_host,
    port: creds.smtp_port,
    secure: creds.smtp_port === 465,
    auth: { user: creds.email, pass: password },
  })

  try {
    await transporter.sendMail({
      from: creds.email,
      to,
      subject,
      text: body,
      ...(replyToMessageId ? { inReplyTo: replyToMessageId, references: replyToMessageId } : {}),
    })
    await incrementEmailCount(user.email)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: `Send failed: ${err.message}` }, { status: 500 })
  }
}
