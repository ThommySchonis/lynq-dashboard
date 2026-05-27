import type { ProviderAccount } from './index'

interface EmailAddress {
  email: string
  name?: string
}

async function getResend() {
  const { Resend } = await import('resend')
  return new Resend(process.env.RESEND_API_KEY)
}

export async function refreshTokenIfNeeded(account: ProviderAccount) {
  return account
}

export async function fetchThreads() {
  return { threads: [], nextPageToken: null }
}

export async function fetchThread() {
  return { messages: [] }
}

export async function sendReply(
  account: ProviderAccount,
  { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }: {
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    subject: string
    bodyHtml: string
    bodyText: string
    inReplyTo: string | null
    references: string | null
  }
) {
  const resend = await getResend()
  const fromEmail = account.email_address || account.email || ''
  const formatAddr = (a: EmailAddress) => (a.name ? `${a.name} <${a.email}>` : a.email)

  const headers: Record<string, string> = {}
  if (inReplyTo) headers['In-Reply-To'] = inReplyTo
  if (references) headers['References'] = references

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Resend SDK union type requires cast
  const result = await resend.emails.send({
    from: account.display_name
      ? `${account.display_name} <${fromEmail}>`
      : fromEmail,
    to: to.map(formatAddr),
    cc: cc?.length ? cc.map(formatAddr) : undefined,
    bcc: bcc?.length ? bcc.map(formatAddr) : undefined,
    subject,
    html: bodyHtml || undefined,
    text: bodyText || undefined,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  } as Parameters<typeof resend.emails.send>[0])

  const messageId = result.data?.id
    ? `<${result.data.id}@resend.dev>`
    : `<resend_${Date.now()}@resend.dev>`

  return {
    providerMessageId: messageId.replace(/[<>]/g, ''),
    messageId,
  }
}

export async function sendNew(
  account: ProviderAccount,
  message: {
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    subject: string
    bodyHtml: string
    bodyText: string
  }
) {
  return sendReply(account, { ...message, inReplyTo: null, references: null })
}
