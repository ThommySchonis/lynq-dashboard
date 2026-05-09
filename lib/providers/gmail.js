import { decrypt, encrypt } from '../encryption'
import { supabaseAdmin } from '../supabaseAdmin'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

async function getAccessToken(account) {
  const accessToken = decrypt(account.access_token)
  const refreshToken = decrypt(account.refresh_token)

  // Refresh proactively if token expires within 5 minutes
  const expiresAt = account.expires_at ? new Date(account.expires_at) : null
  const needsRefresh = expiresAt && expiresAt < new Date(Date.now() + 5 * 60 * 1000)
  console.log('[gmail] Token expires_at:', account.expires_at, 'needsRefresh:', needsRefresh)
  if (needsRefresh) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID?.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) throw new Error(`Gmail token refresh failed: ${data.error}`)

    await supabaseAdmin
      .from('email_accounts')
      .update({
        access_token: encrypt(data.access_token),
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      })
      .eq('id', account.id)

    return data.access_token
  }

  return accessToken
}

function decodeBase64(str) {
  if (!str) return ''
  // Normalize URL-safe base64 to standard base64
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

// Recursively extract body, preferring text/plain over text/html, with nested fallback
function extractBodyParts(payload) {
  if (!payload) return { bodyHtml: '', bodyText: '' }

  // Direct single-part body
  if (payload.body?.data) {
    const content = decodeBase64(payload.body.data)
    if (payload.mimeType === 'text/html') return { bodyHtml: content, bodyText: '' }
    return { bodyHtml: '', bodyText: content }
  }

  if (!payload.parts) return { bodyHtml: '', bodyText: '' }

  let bodyHtml = ''
  let bodyText = ''

  for (const part of payload.parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText = decodeBase64(part.body.data)
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml = decodeBase64(part.body.data)
    } else if (part.mimeType?.startsWith('multipart/')) {
      // Recurse into nested multipart parts
      const nested = extractBodyParts(part)
      if (!bodyText && nested.bodyText) bodyText = nested.bodyText
      if (!bodyHtml && nested.bodyHtml) bodyHtml = nested.bodyHtml
    }
  }

  return { bodyHtml, bodyText }
}

function parseEmailAddress(str) {
  if (!str) return { email: '', name: '' }
  const match = str.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2].trim() }
  return { email: str.trim(), name: '' }
}

function parseEmailAddresses(str) {
  if (!str) return []
  return str.split(',').map(s => parseEmailAddress(s.trim())).filter(a => a.email)
}

function parseGmailMessage(msg, accountEmail) {
  const headers = msg.payload?.headers || []
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  const from = parseEmailAddress(getHeader('From'))
  const to = parseEmailAddresses(getHeader('To'))
  const cc = parseEmailAddresses(getHeader('Cc'))
  const subject = getHeader('Subject')
  const messageId = getHeader('Message-ID') || getHeader('Message-Id')
  const date = getHeader('Date')

  const { bodyHtml, bodyText } = extractBodyParts(msg.payload)

  const isOutbound = from.email.toLowerCase() === accountEmail.toLowerCase()

  return {
    providerMessageId: msg.id,
    messageId,
    from,
    to,
    cc,
    subject,
    bodyHtml,
    bodyText,
    date: date ? new Date(date).toISOString() : new Date(parseInt(msg.internalDate)).toISOString(),
    isOutbound,
  }
}

function hasHeaderInjection(value) {
  return /[\r\n]/.test(String(value || ''))
}

export async function refreshTokenIfNeeded(account) {
  await getAccessToken(account)
  const { data } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('id', account.id)
    .single()
  return data
}

export async function fetchThreads(account, { since, pageToken, limit = 20 } = {}) {
  const token = await getAccessToken(account)

  const listUrl = new URL(`${GMAIL_API}/threads`)
  listUrl.searchParams.set('maxResults', String(Math.min(Math.max(limit, 1), 50)))
  if (pageToken) listUrl.searchParams.set('pageToken', pageToken)
  if (since) {
    const epoch = Math.floor(new Date(since).getTime() / 1000)
    listUrl.searchParams.set('q', `after:${epoch}`)
  }

  console.log('[gmail] fetchThreads URL:', listUrl.toString())
  console.log('[gmail] Token starts with:', token?.substring(0, 20))
  const res = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const errBody = await res.text()
    console.error('[gmail] fetchThreads failed:', res.status, errBody)
    throw new Error(`Gmail fetchThreads failed: ${res.status}`)
  }
  const data = await res.json()
  console.log('[gmail] threads count:', data.threads?.length ?? 0, 'nextPage:', !!data.nextPageToken)

  if (!data.threads?.length) return { threads: [], nextPageToken: null }

  const threads = await Promise.all(
    data.threads.map(async (t) => {
      const threadRes = await fetch(`${GMAIL_API}/threads/${t.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!threadRes.ok) return null
      const threadData = await threadRes.json()

      const messages = threadData.messages.map(m => parseGmailMessage(m, account.email_address))
      const lastMsg = messages[messages.length - 1]

      return {
        providerThreadId: t.id,
        messages,
        subject: messages[0]?.subject || '(no subject)',
        snippet: threadData.snippet || '',
        lastMessageAt: lastMsg?.date || new Date().toISOString(),
      }
    })
  )

  return {
    threads: threads.filter(Boolean),
    nextPageToken: data.nextPageToken || null,
  }
}

export async function fetchThread(account, providerThreadId) {
  const token = await getAccessToken(account)

  const res = await fetch(`${GMAIL_API}/threads/${providerThreadId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Gmail fetchThread failed: ${res.status}`)
  const data = await res.json()

  return {
    messages: data.messages.map(m => parseGmailMessage(m, account.email_address)),
  }
}

export async function sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }) {
  // Guard against header injection
  if ([subject, inReplyTo, references].some(hasHeaderInjection)) {
    throw new Error('Invalid email header value: possible header injection detected')
  }

  const token = await getAccessToken(account)

  const boundary = `lynq_${Date.now()}`
  const toHeader = to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ')
  const ccHeader = cc?.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ') || ''

  // Derive plain text from HTML if not provided
  const plainText = bodyText || (bodyHtml
    ? bodyHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
    : '')

  const headerLines = [
    `From: ${account.display_name || account.email_address} <${account.email_address}>`,
    `To: ${toHeader}`,
    ccHeader ? `Cc: ${ccHeader}` : null,
    `Subject: ${subject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    (inReplyTo || references) ? `References: ${references || inReplyTo}` : null,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(line => line !== null)

  const emailBody = [
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    plainText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    bodyHtml || `<html><body>${plainText}</body></html>`,
    '',
    `--${boundary}--`,
  ].join('\r\n')

  // Encode as URL-safe base64 (RFC 4648)
  const raw = Buffer.from(headerLines.join('\r\n') + emailBody)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(`Gmail send failed: ${errData.error?.message || res.status}`)
  }
  const data = await res.json()

  return {
    providerMessageId: data.id,
    messageId: data.id,
  }
}

export async function sendNew(account, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  return sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo: null, references: null })
}
