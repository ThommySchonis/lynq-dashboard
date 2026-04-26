import { supabaseAdmin, getUserFromToken } from '../../../../../lib/supabaseAdmin'
import { decrypt } from '../../../../../lib/encryption'
import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

function normalizeSubject(subject) {
  return (subject || '').replace(/^(re|fwd?|fw):\s*/gi, '').trim().toLowerCase()
}

function parseAddressHeader(raw) {
  if (!raw) return ''
  // Already a string like "Name <email>" — return as-is
  return raw
}

// GET — fetch all messages in a thread by searching subject across INBOX + Sent
export async function GET(request, { params }) {
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

  if (!creds) return NextResponse.json({ error: 'Custom email not connected' }, { status: 400 })

  let password
  try {
    password = decrypt(creds.encrypted_password)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 })
  }

  const { id } = await params

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
    const messages = []

    // Step 1: Fetch the target message by UID to get its subject
    let baseSubject = null
    {
      const lock = await client.getMailboxLock('INBOX')
      try {
        for await (const msg of client.fetch({ uid: id }, { envelope: true, bodyStructure: true })) {
          baseSubject = msg.envelope?.subject || null
        }
      } finally {
        lock.release()
      }
    }

    // If not found in INBOX by UID, the UID is the subject thread key itself
    const normalized = normalizeSubject(baseSubject || id)

    // Step 2: Search INBOX for all messages with this normalized subject
    const mailboxes = ['INBOX', 'Sent', 'Sent Messages', 'Sent Items', '[Gmail]/Sent Mail']
    for (const mailbox of mailboxes) {
      let lock
      try {
        lock = await client.getMailboxLock(mailbox)
      } catch {
        continue
      }
      try {
        const uids = await client.search({ subject: normalized })
        if (!uids?.length) continue

        for await (const msg of client.fetch(uids.slice(0, 50), {
          envelope: true,
          source: true,
          flags: true,
        })) {
          const fromAddr = msg.envelope?.from?.[0]
          const toAddr = msg.envelope?.to?.[0]
          const from = fromAddr ? `${fromAddr.name || ''} <${fromAddr.address}>`.trim() : ''
          const to = toAddr ? toAddr.address : ''

          // Decode body from raw source (plain text extraction)
          let body = ''
          if (msg.source) {
            const raw = msg.source.toString('utf-8')
            // Extract text/plain part from raw MIME
            const plainMatch = raw.match(/Content-Type: text\/plain[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\nContent-Type:|$)/i)
            body = plainMatch ? plainMatch[1].replace(/=\r?\n/g, '').trim() : msg.envelope?.subject || ''
          }

          messages.push({
            id: `${mailbox}:${msg.uid}`,
            threadId: normalized,
            from: parseAddressHeader(from),
            to,
            subject: msg.envelope?.subject || '(no subject)',
            date: msg.envelope?.date?.toISOString() || new Date().toISOString(),
            body,
            snippet: body.slice(0, 200),
            unread: !msg.flags?.has('\\Seen'),
            mailbox,
          })
        }
      } finally {
        lock.release()
      }
    }

    await client.logout()

    // Sort by date ascending so conversation reads top-to-bottom
    messages.sort((a, b) => new Date(a.date) - new Date(b.date))

    // Deduplicate by subject+from+date combo (same message may appear in INBOX + Sent)
    const seen = new Set()
    const deduped = messages.filter(m => {
      const key = `${m.date}|${m.from}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({ messages: deduped, threadId: id })
  } catch (err) {
    return NextResponse.json({ error: `IMAP error: ${err.message}` }, { status: 500 })
  }
}

// PATCH — mark the specific UID message as read
export async function PATCH(request, { params }) {
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

  if (!creds) return NextResponse.json({ error: 'Custom email not connected' }, { status: 400 })

  let password
  try {
    password = decrypt(creds.encrypted_password)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 })
  }

  const { id } = await params

  const client = new ImapFlow({
    host: creds.imap_host,
    port: creds.imap_port,
    secure: creds.imap_port !== 143,
    auth: { user: creds.email, pass: password },
    logger: false,
    connectionTimeout: 10000,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      await client.messageFlagsAdd({ uid: id }, ['\\Seen'])
    } finally {
      lock.release()
    }
    await client.logout()
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: `IMAP error: ${err.message}` }, { status: 500 })
  }
}
