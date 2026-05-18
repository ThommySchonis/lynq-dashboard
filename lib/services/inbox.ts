import { getAdapter } from '../providers'
import type { ProviderAccount } from '../providers'

// ── Types for email messages/accounts ────────────────────────────────────────

interface EmailAddress {
  email: string
  name?: string
}

interface EmailMessage {
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  bodyHtml: string
  bodyText: string
}

interface EmailReplyMessage extends EmailMessage {
  inReplyTo?: string
  references?: string
}

/**
 * Send a reply in a thread.
 */
export async function sendReply(provider: string, account: ProviderAccount, message: EmailReplyMessage) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.sendReply(refreshed, message as unknown as Record<string, unknown>)
}

/**
 * Fetch threads for a workspace.
 */
export async function getThreads(provider: string, account: ProviderAccount, filters: Record<string, unknown> = {}) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.fetchThreads(refreshed, filters)
}

/**
 * Fetch a single thread with all messages.
 */
export async function getThread(provider: string, account: ProviderAccount, threadId: string) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.fetchThread(refreshed, threadId)
}

/**
 * Mark a thread as resolved.
 */
export async function resolveThread(_provider: string, _account: ProviderAccount, threadId: string, agentId: string) {
  // Thread resolution is handled by conversationEngine, not provider adapters.
  // This is a pass-through for Part 2 analytics instrumentation.
  const engine: { resolveThread: (workspaceId: string, conversationId: string, status: string) => Promise<{ success: boolean }> } = await import('../conversationEngine')
  return engine.resolveThread(threadId, agentId, 'resolved')
}

/**
 * Send a new message (not a reply).
 */
export async function sendNew(provider: string, account: ProviderAccount, message: EmailMessage) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.sendNew(refreshed, message as unknown as Record<string, unknown>)
}
