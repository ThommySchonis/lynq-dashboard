import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { encrypt } from '../../../../lib/encryption'
import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, password, imap_host, imap_port, smtp_host, smtp_port } = await request.json()

  if (!email || !password || !imap_host || !imap_port || !smtp_host || !smtp_port) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const imapPort = parseInt(imap_port)
  const smtpPort = parseInt(smtp_port)

  // Test IMAP connection before saving
  const client = new ImapFlow({
    host: imap_host,
    port: imapPort,
    secure: imapPort !== 143,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: 10000,
  })

  try {
    await client.connect()
    await client.logout()
  } catch (err) {
    return NextResponse.json({ error: `Cannot connect: ${err.message}` }, { status: 400 })
  }

  const encrypted_password = encrypt(password)

  await supabaseAdmin.from('custom_email_tokens').upsert({
    user_id: user.id,
    email,
    encrypted_password,
    imap_host,
    imap_port: imapPort,
    smtp_host,
    smtp_port: smtpPort,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({ success: true, email })
}

export async function DELETE(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('custom_email_tokens').delete().eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
