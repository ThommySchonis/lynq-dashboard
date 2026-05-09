import { decrypt, encrypt } from '../encryption'
import { supabaseAdmin } from '../supabaseAdmin'

const GRAPH_API = 'https://graph.microsoft.com/v1.0/me'

async function getAccessToken(account) {
  const accessToken = decrypt(account.access_token)
  const refreshToken = decrypt(account.refresh_token)

  // Refresh if the token expires within the next 5 minutes
  if (account.expires_at && new Date(account.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'Mail.ReadWrite Mail.Send offline_access',
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) {
      throw new Error(`Outlook token refresh failed: ${data.error || res.status}`)
    }

    await supabaseAdmin
      .from('email_accounts')
      .update({
        access_token: encrypt(data.access_token),
        refresh_token: data.refresh_token ? encrypt(data.refresh_token) : account.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      })
      .eq('id', account.id)

    return data.access_token
  }

  return accessToken
}

function parseOutlookMessage(msg, accountEmail) {
  const from = {
    email: msg.from?.emailAddress?.address || '',
    name: msg.from?.emailAddress?.name || '',
  }
  const to = (msg.toRecipients || []).map(r => ({
    email: r.emailAddress?.address || '',
    name: r.emailAddress?.name || '',
  }))
  const cc = (msg.ccRecipients || []).map(r => ({
    email: r.emailAddress?.address || '',
    name: r.emailAddress?.name || '',
  }))

  const isOutbound = from.email.toLowerCase() === (accountEmail || '').toLowerCase()

  return {
    providerMessageId: msg.id,
    messageId: msg.internetMessageId || msg.id,
    from,
    to,
    cc,
    subject: msg.subject || '(no subject)',
    bodyHtml: msg.body?.contentType?.toLowerCase() === 'html' ? msg.body.content : '',
    bodyText: msg.body?.contentType?.toLowerCase() === 'text' ? msg.body.content : '',
    date: msg.receivedDateTime || msg.sentDateTime || new Date().toISOString(),
    isOutbound,
  }
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

  let url = `${GRAPH_API}/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId,internetMessageId,body,isRead`
  if (since && !pageToken) {
    url += `&$filter=receivedDateTime ge ${new Date(since).toISOString()}`
  }
  // pageToken is a full @odata.nextLink URL — use it directly
  if (pageToken) {
    url = pageToken
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Outlook fetchThreads failed: ${res.status}`)
  const data = await res.json()

  const threadMap = new Map()
  for (const msg of (data.value || [])) {
    const cid = msg.conversationId || msg.id
    if (!threadMap.has(cid)) {
      threadMap.set(cid, { messages: [], bodyPreview: msg.bodyPreview || '' })
    }
    threadMap.get(cid).messages.push(parseOutlookMessage(msg, account.email_address))
  }

  const threads = Array.from(threadMap.entries()).map(([cid, { messages, bodyPreview }]) => {
    messages.sort((a, b) => new Date(a.date) - new Date(b.date))
    const lastMsg = messages[messages.length - 1]
    return {
      providerThreadId: cid,
      messages,
      subject: messages[0]?.subject || '(no subject)',
      snippet: bodyPreview,
      lastMessageAt: lastMsg?.date || new Date().toISOString(),
    }
  })

  return {
    threads,
    nextPageToken: data['@odata.nextLink'] || null,
  }
}

export async function fetchThread(account, providerThreadId) {
  const token = await getAccessToken(account)

  // Sanitize conversationId to prevent OData injection
  const safeConversationId = String(providerThreadId || '').replace(/'/g, "''")

  const url = `${GRAPH_API}/messages?$filter=conversationId eq '${safeConversationId}'&$orderby=receivedDateTime asc&$top=50&$select=id,subject,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,internetMessageId`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Outlook fetchThread failed: ${res.status} ${err?.error?.message || ''}`)
  }
  const data = await res.json()

  return {
    messages: (data.value || []).map(m => parseOutlookMessage(m, account.email_address)),
  }
}

export async function sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo }) {
  const token = await getAccessToken(account)

  // If inReplyTo is a provider message ID, use the Graph reply endpoint to
  // preserve threading headers automatically. Otherwise fall back to sendMail.
  if (inReplyTo) {
    const res = await fetch(`${GRAPH_API}/messages/${encodeURIComponent(inReplyTo)}/reply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: bodyHtml || bodyText || '',
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Outlook reply failed: ${res.status} ${err}`)
    }
    return {
      providerMessageId: `outlook_reply_${Date.now()}`,
      messageId: `<outlook_reply_${Date.now()}@graph.microsoft.com>`,
    }
  }

  // Compose a new message (no inReplyTo) using sendMail
  const message = {
    subject,
    body: { contentType: 'HTML', content: bodyHtml || bodyText || '' },
    toRecipients: (to || []).map(a => ({ emailAddress: { address: a.email, name: a.name } })),
    ccRecipients: (cc || []).map(a => ({ emailAddress: { address: a.email, name: a.name } })),
    bccRecipients: (bcc || []).map(a => ({ emailAddress: { address: a.email, name: a.name } })),
  }

  const res = await fetch(`${GRAPH_API}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Outlook send failed: ${res.status} ${err}`)
  }

  return {
    providerMessageId: `outlook_sent_${Date.now()}`,
    messageId: `<outlook_${Date.now()}@graph.microsoft.com>`,
  }
}

export async function sendNew(account, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  return sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText })
}
