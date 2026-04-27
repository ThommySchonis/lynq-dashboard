import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { decrypt } from '../../../../lib/encryption'
import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

const SENT_FOLDER_CANDIDATES = ['Sent', 'Sent Messages', 'Sent Items', 'SENT', '[Gmail]/Sent Mail']

async function findSentFolder(client) {
  const list = await client.list()
  for (const candidate of SENT_FOLDER_CANDIDATES) {
    if (list.find(m => m.path === candidate || m.name === candidate)) return candidate
  }
  // Fallback: any mailbox with \Sent attribute
  const sentBox = list.find(m => m.flags?.has('\\Sent'))
  return sentBox?.path || null
}

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

  if (!creds) return NextResponse.json({ threads: [], connected: false })

  let password
  try {
    password = decrypt(creds.encrypted_password)
  } catch {
    return NextResponse.json({ threads: [], connected: false })
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

    const threads = []

    try {
      const sentFolder = await findSentFolder(client)
      if (!sentFolder) {
        return NextResponse.json({ threads: [], connected: true, email: creds.email })
      }

      const lock = await client.getMailboxLock(sentFolder)
      try {
        const total = client.mailbox.exists
        if (total > 0) {
          const start = Math.max(1, total - 29)
          const messages = await client.fetch(
            { seq: `${start}:*` },
            { envelope: true, flags: true }
          )

          for await (const msg of messages) {
            threads.push({
              id: msg.uid?.toString() || msg.seq?.toString(),
              subject: msg.envelope?.subject || '(no subject)',
              from: msg.envelope?.from?.[0]
                ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address}>`.trim()
                : creds.email,
              to: msg.envelope?.to?.map(r => r.address).join(', ') || '',
              date: msg.envelope?.date,
              snippet: '',
              unread: false,
              isSent: true,
            })
          }
        }
      } finally {
        lock.release()
      }
    } finally {
      await client.logout()
    }

    return NextResponse.json({
      threads: threads.reverse(),
      connected: true,
      email: creds.email,
    })
  } catch (err) {
    return NextResponse.json({ error: `IMAP error: ${err.message}`, threads: [], connected: true }, { status: 500 })
  }
}
