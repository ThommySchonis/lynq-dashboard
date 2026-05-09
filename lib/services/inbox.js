import { getAdapter } from '../providers'

/**
 * Send a reply in a thread.
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {{ to: string, cc?: string[], bcc?: string[], subject: string, bodyHtml: string, bodyText: string, inReplyTo: string, references: string }} message
 */
export async function sendReply(provider, account, message) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.sendReply(refreshed, message)
}

/**
 * Fetch threads for a workspace.
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {{ since?: string, pageToken?: string, limit?: number }} filters
 */
export async function getThreads(provider, account, filters = {}) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.fetchThreads(refreshed, filters)
}

/**
 * Fetch a single thread with all messages.
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {string} threadId - Provider-specific thread ID
 */
export async function getThread(provider, account, threadId) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.fetchThread(refreshed, threadId)
}

/**
 * Mark a thread as resolved.
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {string} threadId - Provider-specific thread ID
 * @param {string} agentId - Agent who resolved
 */
export async function resolveThread(provider, account, threadId, agentId) {
  // Thread resolution is handled by conversationEngine, not provider adapters.
  // This is a pass-through for Part 2 analytics instrumentation.
  const { resolveThread: resolve } = await import('../conversationEngine')
  return resolve(threadId, agentId)
}

/**
 * Send a new message (not a reply).
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {{ to: string[], cc?: string[], bcc?: string[], subject: string, bodyHtml: string, bodyText: string }} message
 */
export async function sendNew(provider, account, message) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.sendNew(refreshed, message)
}
