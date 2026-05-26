import { ImapFlow } from 'imapflow'
// @ts-expect-error — no @types/nodemailer installed
import nodemailer from 'nodemailer'
import { decrypt } from '../encryption'

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailAddress {
  email: string
  name: string
}

interface CustomAccount {
  id: string
  email: string
  email_address?: string
  display_name?: string
  encrypted_password: string
  imap_host: string
  imap_port?: number
  smtp_host: string
  smtp_port?: number
  [key: string]: unknown
}

interface ImapMailboxStatus {
  exists?: number
}

interface ImapEnvelopeAddress {
  address?: string
  name?: string
}

interface ImapEnvelope {
  from?: ImapEnvelopeAddress[]
  to?: ImapEnvelopeAddress[]
  cc?: ImapEnvelopeAddress[]
  subject?: string
  messageId?: string
  date?: string
}

interface ImapMessage {
  uid: number
  envelope?: ImapEnvelope
  flags?: Set<string>
  source?: Buffer | string
}

interface NormalizedMessage {
  providerMessageId: string
  messageId: string
  from: EmailAddress
  to: EmailAddress[]
  cc: EmailAddress[]
  subject: string
  bodyHtml: string
  bodyText: string
  date: string
  isOutbound: boolean
  unread?: boolean
}

interface Thread {
  providerThreadId: string
  messages: NormalizedMessage[]
  subject: string
  snippet: string
  lastMessageAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAccountEmail(account: CustomAccount) {
  return account.email_address || account.email
}

function getImapConfig(account: CustomAccount) {
  return {
    host: account.imap_host,
    port: account.imap_port || 993,
    secure: (account.imap_port || 993) !== 143,
    auth: {
      user: getAccountEmail(account),
      pass: decrypt(account.encrypted_password),
    },
    logger: false as const,
    connectionTimeout: 15000,
  }
}

function getSmtpConfig(account: CustomAccount) {
  const port = account.smtp_port || 465
  return {
    host: account.smtp_host,
    port,
    secure: port === 465,
    auth: {
      user: getAccountEmail(account),
      pass: decrypt(account.encrypted_password),
    },
  }
}

function hasHeaderInjection(value: string | null | undefined) {
  return /[\r\n]/.test(String(value || ''))
}

function normalizeSubject(subject: string) {
  return (subject || '').replace(/^(re|fwd?|fw):\s*/gi, '').trim().toLowerCase()
}

function parseImapAddress(addr: ImapEnvelopeAddress[] | undefined): EmailAddress[] {
  if (!addr || !addr.length) return []
  return addr.map((a) => ({
    email: a.address || '',
    name: a.name || '',
  }))
}

function extractBodyFromSource(source: Buffer | string) {
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

function parseImapMessage(msg: ImapMessage, accountEmail: string, mailboxLabel: string): NormalizedMessage {
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

// ── Exports ──────────────────────────────────────────────────────────────────

export async function refreshTokenIfNeeded(account: CustomAccount) {
  // IMAP/SMTP uses static credentials — no token refresh needed
  return account
}

export async function fetchThreads(account: CustomAccount, { limit = 20 }: { limit?: number } = {}) {
  const client = new ImapFlow(getImapConfig(account))

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    const rawMessages: ImapMessage[] = []

    try {
      const mailbox = client.mailbox as ImapMailboxStatus | undefined
      const exists = mailbox?.exists || 0
      const seqStart = Math.max(1, exists - limit + 1)

      for await (const msg of client.fetch(
        { seq: `${seqStart}:*` },
        { envelope: true, flags: true }
      )) {
        rawMessages.push(msg as ImapMessage)
      }
    } finally {
      lock.release()
    }

    // Group into threads by normalised subject
    const threadMap = new Map<string, { messages: NormalizedMessage[]; subject: string }>()
    for (const msg of rawMessages) {
      const subject = msg.envelope?.subject || '(no subject)'
      const threadKey = normalizeSubject(subject)

      if (!threadMap.has(threadKey)) {
        threadMap.set(threadKey, { messages: [], subject })
      }
      threadMap.get(threadKey)!.messages.push({
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
          getAccountEmail(account).toLowerCase(),
        unread: !msg.flags?.has('\\Seen'),
      })
    }

    const threads: Thread[] = Array.from(threadMap.entries()).map(([threadKey, { messages: msgs, subject }]) => {
      msgs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const lastMsg = msgs[msgs.length - 1]
      return {
        providerThreadId: threadKey,
        messages: msgs,
        subject,
        snippet: lastMsg?.bodyText?.substring(0, 100) || '',
        lastMessageAt: lastMsg?.date || new Date().toISOString(),
      }
    })

    threads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

    return { threads, nextPageToken: null }
  } finally {
    await client.logout()
  }
}

export async function fetchThread(account: CustomAccount, providerThreadId: string) {
  const client = new ImapFlow(getImapConfig(account))

  try {
    await client.connect()
    const messages: NormalizedMessage[] = []

    // Search across INBOX and common Sent mailbox names
    const mailboxes = ['INBOX', 'Sent', 'Sent Messages', 'Sent Items', '[Gmail]/Sent Mail']
    for (const mailbox of mailboxes) {
      let lock: { release: () => void }
      try {
        lock = await client.getMailboxLock(mailbox)
      } catch {
        // Mailbox doesn't exist on this server — skip
        continue
      }
      try {
        // providerThreadId is the normalised subject key
        const uids = await client.search({ subject: providerThreadId })
        if (!uids || !(uids as number[]).length) continue

        for await (const msg of client.fetch((uids as number[]).slice(0, 50), {
          envelope: true,
          source: true,
          flags: true,
        })) {
          messages.push(parseImapMessage(msg as ImapMessage, getAccountEmail(account), mailbox))
        }
      } finally {
        lock.release()
      }
    }

    // Sort ascending so conversation reads top-to-bottom
    messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Deduplicate: same message can appear in both INBOX and Sent
    const seen = new Set<string>()
    const deduped = messages.filter((m) => {
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

export async function sendReply(account: CustomAccount, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }: { to: EmailAddress[]; cc: EmailAddress[]; bcc: EmailAddress[]; subject: string; bodyHtml: string; bodyText: string; inReplyTo: string | null; references: string | null }) {
  if ([subject, inReplyTo].some(hasHeaderInjection)) {
    throw new Error('Invalid email header value')
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- nodemailer has no type declarations
  const transporter = nodemailer.createTransport(getSmtpConfig(account))

  const formatAddr = (a: EmailAddress) => (a.name ? `"${a.name}" <${a.email}>` : a.email)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- nodemailer has no type declarations
  const info = await transporter.sendMail({
    from: account.display_name
      ? `"${account.display_name}" <${getAccountEmail(account)}>`
      : getAccountEmail(account),
    to: to.map(formatAddr).join(', '),
    cc: cc?.length ? cc.map(formatAddr).join(', ') : undefined,
    bcc: bcc?.length ? bcc.map(formatAddr).join(', ') : undefined,
    subject,
    text: bodyText || '',
    html: bodyHtml || undefined,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
  })

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- nodemailer has no type declarations
  const rawId = (info.messageId as string) || `<smtp_${Date.now()}@${account.smtp_host}>`
  return {
    providerMessageId: rawId.replace(/[<>]/g, ''),
    messageId: rawId,
  }
}

export async function sendNew(account: CustomAccount, { to, cc, bcc, subject, bodyHtml, bodyText }: { to: EmailAddress[]; cc: EmailAddress[]; bcc: EmailAddress[]; subject: string; bodyHtml: string; bodyText: string }) {
  return sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo: null, references: null })
}
