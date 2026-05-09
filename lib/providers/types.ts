/**
 * @typedef {Object} NormalizedMessage
 * @property {string} providerMessageId - Provider-specific unique ID
 * @property {string} messageId - RFC 2822 Message-ID header
 * @property {{email: string, name: string}} from
 * @property {{email: string, name: string}[]} to
 * @property {{email: string, name: string}[]} cc
 * @property {string} subject
 * @property {string} bodyHtml
 * @property {string} bodyText
 * @property {string} date - ISO timestamp
 * @property {boolean} isOutbound
 */

/**
 * @typedef {Object} FetchThreadsResult
 * @property {Object[]} threads - Array of { providerThreadId, messages: NormalizedMessage[], subject, snippet, lastMessageAt }
 * @property {string|null} nextPageToken
 */

/**
 * @typedef {Object} SendResult
 * @property {string} providerMessageId
 * @property {string} messageId - RFC 2822 Message-ID
 */

/**
 * Provider adapter interface (implemented by gmail.js, outlook.js, custom.js)
 *
 * All adapters must implement:
 *   fetchThreads(account, { since, pageToken, limit }) → FetchThreadsResult
 *   fetchThread(account, providerThreadId) → { messages: NormalizedMessage[] }
 *   sendReply(account, { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, references }) → SendResult
 *   sendNew(account, { to, cc, bcc, subject, bodyHtml, bodyText }) → SendResult
 *   refreshTokenIfNeeded(account) → account (updated if refreshed)
 */

export const PROVIDERS = {
  GMAIL: 'gmail',
  OUTLOOK: 'outlook',
  CUSTOM: 'custom',
}
