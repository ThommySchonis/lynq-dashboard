import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { decrypt } from '../../../../lib/encryption'
import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: creds } = await supabaseAdmin
    .from('custom_email_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!creds) return NextResponse.json({ error: 'Custom email not connected', connected: false }, { status: 200 })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '20')

  let password
  try {
    password = decrypt(creds.encrypted_password)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials', connected: false }, { status: 200 })
  }

  const client = new ImapFlow({
    host: creds.imap_host,
    port: creds.imap_port,
    secure: creds.imap_port !== 143,
    auth: { user: creds.email, pass: password },
    logger: false,
    connectionTimeout: 15000,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    const threads = []

    try {
      const messages = await client.fetch(
        { seq: `${Math.max(1, client.mailbox.exists - limit + 1)}:*` },
        { envelope: true, flags: true, bodyStructure: false }
      )

      for await (const msg of messages) {
        threads.push({
          id: msg.uid?.toString() || msg.seq?.toString(),
          subject: msg.envelope?.subject || '(no subject)',
          from: msg.envelope?.from?.[0]?.address,
          fromName: msg.envelope?.from?.[0]?.name,
          to: msg.envelope?.to?.[0]?.address,
          date: msg.envelope?.date,
          unread: !msg.flags?.has('\\Seen'),
          snippet: '',
        })
      }
    } finally {
      lock.release()
    }

    await client.logout()

    return NextResponse.json({
      connected: true,
      email: creds.email,
      threads: threads.reverse(),
    })
  } catch (err) {
    return NextResponse.json({ error: `IMAP error: ${err.message}`, connected: true }, { status: 500 })
  }
}
