import { supabaseAdmin, getUserFromToken } from '../../../../../lib/supabaseAdmin'
import { encrypt } from '../../../../../lib/encryption'
import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

// POST /api/auth/custom-email/connect
// Body: { imapHost, imapPort, smtpHost, smtpPort, email, password }
// Tests both IMAP and SMTP connections, then saves encrypted credentials
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { imapHost, imapPort, smtpHost, smtpPort, email, password } = await request.json()

  if (!imapHost || !smtpHost || !email || !password) {
    return NextResponse.json({ error: 'imapHost, smtpHost, email and password are required' }, { status: 400 })
  }

  // Test IMAP connection
  const imapClient = new ImapFlow({
    host: imapHost,
    port: parseInt(imapPort) || 993,
    secure: parseInt(imapPort) !== 143,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: 10000,
  })

  try {
    await imapClient.connect()
    await imapClient.logout()
  } catch (err) {
    return NextResponse.json({ error: `IMAP connection failed: ${err.message}` }, { status: 400 })
  }

  // Test SMTP connection
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort) || 587,
    secure: parseInt(smtpPort) === 465,
    auth: { user: email, pass: password },
    connectionTimeout: 10000,
  })

  try {
    await transporter.verify()
  } catch (err) {
    return NextResponse.json({ error: `SMTP connection failed: ${err.message}` }, { status: 400 })
  }

  // Save encrypted credentials
  const encryptedPassword = encrypt(password)

  const { error } = await supabaseAdmin.from('custom_email_tokens').upsert({
    user_id: user.id,
    email,
    imap_host: imapHost,
    imap_port: parseInt(imapPort) || 993,
    smtp_host: smtpHost,
    smtp_port: parseInt(smtpPort) || 587,
    encrypted_password: encryptedPassword,
  }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, email })
}
