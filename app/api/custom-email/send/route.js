import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { decrypt } from '../../../../lib/encryption'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, subject, body, replyToMessageId } = await request.json()

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
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: `Send failed: ${err.message}` }, { status: 500 })
  }
}
