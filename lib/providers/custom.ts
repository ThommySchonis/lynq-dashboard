import { ImapFlow } from 'imapflow'
// @ts-ignore — no @types/nodemailer installed
import nodemailer from 'nodemailer'
import { decrypt } from '../encryption'

function getImapConfig(account: any) {
  return {
    host: account.imap_host,
    port: account.imap_port || 993,
    secure: (account.imap_port || 993) !== 143,
    auth: {
      user: account.email,
      pass: decrypt(account.encrypted_password),
    },
    logger: false as const,
    connectionTimeout: 15000,
  }
}

function getSmtpConfig(account: any) {
  const port = account.smtp_port || 465
  return {
    host: account.smtp_host,
    port,
    secure: port === 465,
    auth: {
      user: account.email,
      pass: decrypt(account.encrypted_password),
    },
  }
}

function hasHeaderInjection(value: any) {
  return /[\r\n]/.test(String(value || ''))
}

function normalizeSubject(subject: any) {
  return (subject || '').replace(/^(re|fwd?|fw):\s*/gi, '').trim().toLowerCase()
}

function parseImapAddress(addr: any) {
  if (!addr || !addr.length) return []
  return addr.map((a: any) => ({
    email: a.address || '',
    name: a.name || '',
  }))
}

function extractBodyFromSource(source: any) {
  const raw = Buffer.isBuffer(source) ? source.toString('utf-8') : String(source)

  // Extract text/plain first (preferred for bodyText)
  const plainMatch = raw.match(
    /Content-Type: text\/plain[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\nContent-Type:|$)/i
  )
  const bodyText = plainMatch ? plainMatch[1].replace(/=\r?\n/g, '').trim() : ''

  // Extract text/html for bodyHtml
  const htmlMatch = raw.match(
    /Content-Type: text\/html[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\nContent-Type:|$)/i
  )
  const bodyHtml = htmlMatch ? htmlMatch[1].replace(/=\r?\n/g, '').trim() : ''

  return { bodyText, bodyHtml }
}

function parseImapMessage(msg: any, accountEmail: any, mailboxLabel: any) {
  const envelope = msg.envelope || {}
  const fromRaw = envelope.from?.[0]
  const from = fromRaw
    ? { email: fromRaw.address || '', name: fromRaw.name || '' }
    : { email: '', name: '' }
  const to = parseImapAddress(envelope.to)
  const cc = parseImapAddress(envelope.cc)
  const isOutbound = from.email.toLowerCase() === (accountEmail || '').toLowerCase()

  const { bodyText, bodyHtml } = msg.source
    ? extractBodyFromSource(msg.source)
    : { bodyText: '', bodyHtml: '' }

  return {
    providerMessageId: mailboxLabel ? `${mailboxLabel}:${msg.uid}` : `imap_${msg.uid}`,
    messageId: envelope.messageId || `imap_${msg.uid}`,
    from,
    to,
    cc,
    subject: envelope.subject || '(no subject)',
    bodyHtml,
    bodyText,
    date: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
    isOutbound,
  }
}

export async function refreshTokenIfNeeded(account: any) {
  // IMAP/SMTP uses static credentials — no token refresh needed
  return account
}

export async function fetchThreads(account: any, { limit = 20 }: any = {}) {
  const client = new ImapFlow(getImapConfig(account))

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    const rawMessages: any[] = []

    try {
      const exists = (client.mailbox as any)?.exists || 0
      const seqStart = Math.max(1, exists - limit + 1)

      for await (const msg of client.fetch(
        { seq: `${seqStart}:*` },
        { envelope: true, flags: true }
      )) {
        rawMessages.push(msg)
      }
    } finally {
      lock.release()
    }

    // Group into threads by normalised subject
    const threadMap = new Map()
    for (const msg of rawMessages) {
      const subject = msg.envelope?.subject || '(no subject)'
      const threadKey = normalizeSubject(subject)

      if (!threadMap.has(threadKey)) {
        threadMap.set(threadKey, { messages: [], subject })
      }
      threadMap.get(threadKey).messages.push({
        providerMessageId: `imap_${msg.uid}`,
        messageId: msg.envelope?.messageId || `imap_${msg.uid}`,
        from: msg.envelope?.from?.[0]
          ? { email: msg.envelope.from[0].address || '', name: msg.envelope.from[0].name || '' }
          : { email: '', name: '' },
        to: parseImapAddress(msg.envelope?.to),
        cc: parseImapAddress(msg.envelope?.cc),
        subject,
        bodyHtml: '',
        bodyText: '',
        date: msg.envelope?.date
          ? new Date(msg.envelope.date).toISOString()
          : new Date().toISOString(),
        isOutbound:
          (msg.envelope?.from?.[0]?.address || '').toLowerCase() ===
          (account.email || '').toLowerCase(),
        unread: !msg.flags?.has('\\Seen'),
      })
    }

    const threads = Array.from(threadMap.entries()).map(([_threadKey, { messages: msgs, subject }]: [any, any]) => {
      msgs.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const lastMsg = msgs[msgs.length - 1]
      return {
        providerThreadId: _threadKey,
        messages: msgs,
        subject,
        snippet: lastMsg?.bodyText?.substring(0, 100) || '',
        lastMessageAt: lastMsg?.date || new Date().toISOString(),
      }
    })

    threads.sort((a: any, b: any) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

    return { threads, nextPageToken: null }
  } finally {
    await client.logout()
  }
}

export async function fetchThread(account: any, providerThreadId: string) {
  const client = new ImapFlow(getImapConfig(account))

  try {
    await client.connect()
    const messages: any[] = []

    // Search across INBOX and common Sent mailbox names
    const mailboxes = ['INBOX', 'Sent', 'Sent Messages', 'Sent Items', '[Gmail]/Sent Mail']
    for (const mailbox of mailboxes) {
      let lock: any
      try {
        lock = await client.getMailboxLock(mailbox)
      } catch {
        // Mailbox doesn't exist on this server — skip
        continue
      }
      try {
        // providerThreadId is the normalised subject key
        const uids = await client.search({ subject: providerThreadId })
        if (!uids || !(uids as any[]).length) continue

        for await (const msg of client.fetch((uids as any[]).slice(0, 50), {
          envelope: true,
          source: true,
          flags: true,
        })) {
          messages.push(parseImapMessage(msg, account.email, mailbox))
        }
      } finally {
        lock.release()
      }
    }

    // Sort ascending so conversation reads top-to-bottom
    messages.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Deduplicate: same message can appear in both INBOX and Sent
    const seen = new Set()
    const deduped = messages.filter((m: any) => {
      const key = `${m.date}|${m.from.email}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return { messages: deduped }
  } finally {
    await client.logout()
  }
}

export async function sendReply(account: any, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }: { to: any; cc: any; bcc: any; subject: any; bodyHtml: any; bodyText: any; inReplyTo: any; references: any }) {
  if ([subject, inReplyTo].some(hasHeaderInjection)) {
    throw new Error('Invalid email header value')
  }

  const transporter = nodemailer.createTransport(getSmtpConfig(account))

  const formatAddr = (a: any) => (a.name ? `"${a.name}" <${a.email}>` : a.email)

  const info = await transporter.sendMail({
    from: account.display_name
      ? `"${account.display_name}" <${account.email}>`
      : account.email,
    to: to.map(formatAddr).join(', '),
    cc: cc?.length ? cc.map(formatAddr).join(', ') : undefined,
    bcc: bcc?.length ? bcc.map(formatAddr).join(', ') : undefined,
    subject,
    text: bodyText || '',
    html: bodyHtml || undefined,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
  })

  const rawId = info.messageId || `<smtp_${Date.now()}@${account.smtp_host}>`
  return {
    providerMessageId: rawId.replace(/[<>]/g, ''),
    messageId: rawId,
  }
}

export async function sendNew(account: any, { to, cc, bcc, subject, bodyHtml, bodyText }: { to: any; cc: any; bcc: any; subject: any; bodyHtml: any; bodyText: any }) {
  return sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo: null, references: null })
}
